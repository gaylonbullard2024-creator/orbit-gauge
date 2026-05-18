import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { computeZScore, powerLawStatus, powerLawStatusColor } from '@/lib/powerLaw';
import type { HistoricalPoint } from '@/hooks/useDashboard';

interface PowerLawBacktestProps {
  priceHistory: HistoricalPoint[];
}

interface Transition {
  date: string;
  from: string;
  to: string;
  price: number;
  ret30: number | null;
  ret90: number | null;
}

interface BucketStat {
  status: string;
  count: number;
  avg30: number | null;
  avg90: number | null;
  win30: number | null;
  win90: number | null;
}

const PCT = (v: number | null) =>
  v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;

function color(v: number | null) {
  if (v == null) return 'text-muted-foreground';
  return v >= 0 ? 'text-[hsl(152,60%,45%)]' : 'text-[hsl(0,72%,55%)]';
}

export function PowerLawBacktest({ priceHistory }: PowerLawBacktestProps) {
  const { transitions, buckets } = useMemo(() => {
    if (priceHistory.length < 30) return { transitions: [], buckets: [] };

    // Index by date for fast forward-return lookup
    const series = priceHistory
      .map((p) => {
        const z = computeZScore(p.value, p.date);
        return z == null ? null : { date: p.date, price: p.value, status: powerLawStatus(z) };
      })
      .filter(Boolean) as Array<{ date: string; price: number; status: string }>;

    if (series.length < 30) return { transitions: [], buckets: [] };

    const fwd = (i: number, days: number): number | null => {
      const target = i + days;
      if (target >= series.length) return null;
      return series[target].price / series[i].price - 1;
    };

    // Detect status transitions
    const trans: Transition[] = [];
    for (let i = 1; i < series.length; i++) {
      if (series[i].status !== series[i - 1].status) {
        trans.push({
          date: series[i].date,
          from: series[i - 1].status,
          to: series[i].status,
          price: series[i].price,
          ret30: fwd(i, 30),
          ret90: fwd(i, 90),
        });
      }
    }

    // Bucket aggregate: forward returns conditional on current status (every day)
    const groups = new Map<string, { r30: number[]; r90: number[] }>();
    for (let i = 0; i < series.length; i++) {
      const g = groups.get(series[i].status) ?? { r30: [], r90: [] };
      const r30 = fwd(i, 30);
      const r90 = fwd(i, 90);
      if (r30 != null) g.r30.push(r30);
      if (r90 != null) g.r90.push(r90);
      groups.set(series[i].status, g);
    }
    const order = ['Deep Value', 'Accumulation', 'Fair Value', 'Overheated', 'Cycle Top Risk'];
    const buckets: BucketStat[] = order
      .filter((s) => groups.has(s))
      .map((s) => {
        const g = groups.get(s)!;
        const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
        const win = (arr: number[]) => (arr.length ? arr.filter((v) => v > 0).length / arr.length : null);
        return {
          status: s,
          count: g.r30.length,
          avg30: avg(g.r30),
          avg90: avg(g.r90),
          win30: win(g.r30),
          win90: win(g.r90),
        };
      });

    return { transitions: trans.reverse(), buckets };
  }, [priceHistory]);

  if (!transitions.length) return null;

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <span className="text-lg">🧪</span>
            Power Law Backtest
          </CardTitle>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[280px] text-xs">
                Forward 30-day and 90-day BTC returns conditional on Power Law status, plus every historical status transition. Computed from daily BTC closes.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Aggregate stats by status */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-2">
            Average forward returns by status
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead className="text-[11px]">Status</TableHead>
                  <TableHead className="text-[11px] text-right">Days</TableHead>
                  <TableHead className="text-[11px] text-right">Avg +30d</TableHead>
                  <TableHead className="text-[11px] text-right">Win% 30d</TableHead>
                  <TableHead className="text-[11px] text-right">Avg +90d</TableHead>
                  <TableHead className="text-[11px] text-right">Win% 90d</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buckets.map((b) => (
                  <TableRow key={b.status} className="border-border/30">
                    <TableCell className="py-2">
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={{
                          backgroundColor: powerLawStatusColor(statusToZ(b.status)) + '22',
                          color: powerLawStatusColor(statusToZ(b.status)),
                        }}
                      >
                        {b.status}
                      </span>
                    </TableCell>
                    <TableCell className="py-2 text-right font-mono text-xs text-muted-foreground">{b.count}</TableCell>
                    <TableCell className={`py-2 text-right font-mono text-xs ${color(b.avg30)}`}>{PCT(b.avg30)}</TableCell>
                    <TableCell className="py-2 text-right font-mono text-xs text-muted-foreground">
                      {b.win30 == null ? '—' : `${(b.win30 * 100).toFixed(0)}%`}
                    </TableCell>
                    <TableCell className={`py-2 text-right font-mono text-xs ${color(b.avg90)}`}>{PCT(b.avg90)}</TableCell>
                    <TableCell className="py-2 text-right font-mono text-xs text-muted-foreground">
                      {b.win90 == null ? '—' : `${(b.win90 * 100).toFixed(0)}%`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Transitions */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-2">
            Status transitions ({transitions.length}) — most recent first
          </p>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto rounded-md border border-border/40">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead className="text-[11px]">Date</TableHead>
                  <TableHead className="text-[11px]">Transition</TableHead>
                  <TableHead className="text-[11px] text-right">Price</TableHead>
                  <TableHead className="text-[11px] text-right">+30d</TableHead>
                  <TableHead className="text-[11px] text-right">+90d</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transitions.map((t) => (
                  <TableRow key={t.date} className="border-border/30">
                    <TableCell className="py-2 font-mono text-xs text-muted-foreground">{t.date}</TableCell>
                    <TableCell className="py-2 text-xs">
                      <span style={{ color: powerLawStatusColor(statusToZ(t.from)) }}>{t.from}</span>
                      <span className="text-muted-foreground"> → </span>
                      <span style={{ color: powerLawStatusColor(statusToZ(t.to)) }}>{t.to}</span>
                    </TableCell>
                    <TableCell className="py-2 text-right font-mono text-xs text-foreground">
                      ${t.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell className={`py-2 text-right font-mono text-xs ${color(t.ret30)}`}>{PCT(t.ret30)}</TableCell>
                    <TableCell className={`py-2 text-right font-mono text-xs ${color(t.ret90)}`}>{PCT(t.ret90)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground/60">
          Backtest is informational. Past performance does not guarantee future results.
        </p>
      </CardContent>
    </Card>
  );
}

// Map status label back to a representative z for coloring
function statusToZ(status: string): number {
  switch (status) {
    case 'Cycle Top Risk': return 2.5;
    case 'Overheated': return 1.5;
    case 'Fair Value': return 0;
    case 'Accumulation': return -1.5;
    case 'Deep Value': return -2.5;
    default: return 0;
  }
}
