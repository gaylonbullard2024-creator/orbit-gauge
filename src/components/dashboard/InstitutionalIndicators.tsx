import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';

interface Row {
  date: string;
  btc_close_usd: number | null;
  mvrv_value: number | null;
  realized_price: number | null;
  nupl: number | null;
  puell_value: number | null;
  reserve_risk: number | null;
  lth_sopr_value: number | null;
  exchange_inflow: number | null;
  exchange_outflow: number | null;
  whale_accumulation: number | null;
  whale_distribution: number | null;
}

type Interp = 'Bullish' | 'Neutral' | 'Bearish';

interface IndicatorDef {
  key: keyof Row;
  name: string;
  description: string;
  fmt: (n: number) => string;
  interpret: (v: number) => Interp;
  awaiting?: boolean;          // requires paid feed
  paidNote?: string;
}

const INDICATORS: IndicatorDef[] = [
  {
    key: 'mvrv_value', name: 'MVRV',
    description: 'Market value vs realized value',
    fmt: (v) => v.toFixed(2),
    interpret: (v) => (v < 1 ? 'Bullish' : v < 2.4 ? 'Neutral' : 'Bearish'),
  },
  {
    key: 'puell_value', name: 'Puell Multiple',
    description: 'Miner revenue vs 365d MA',
    fmt: (v) => v.toFixed(2),
    interpret: (v) => (v < 0.5 ? 'Bullish' : v < 4 ? 'Neutral' : 'Bearish'),
  },
  {
    key: 'lth_sopr_value', name: 'LTH-SOPR',
    description: 'Long-term holder profit ratio',
    fmt: (v) => v.toFixed(3),
    interpret: (v) => (v < 1 ? 'Bullish' : v < 1.05 ? 'Neutral' : 'Bearish'),
    awaiting: true, paidNote: 'Requires Glassnode',
  },
  {
    key: 'exchange_inflow', name: 'Exchange Inflows',
    description: 'BTC sent to exchanges (sell pressure)',
    fmt: (v) => `${(v / 1000).toFixed(1)}k BTC`,
    interpret: (v) => (v > 50000 ? 'Bearish' : v > 20000 ? 'Neutral' : 'Bullish'),
    awaiting: true, paidNote: 'Requires CryptoQuant',
  },
  {
    key: 'exchange_outflow', name: 'Exchange Outflows',
    description: 'BTC withdrawn from exchanges (accumulation)',
    fmt: (v) => `${(v / 1000).toFixed(1)}k BTC`,
    interpret: (v) => (v > 50000 ? 'Bullish' : v > 20000 ? 'Neutral' : 'Bearish'),
    awaiting: true, paidNote: 'Requires CryptoQuant',
  },
  {
    key: 'whale_accumulation', name: 'Whale Accumulation',
    description: 'Net BTC added by 1k+ BTC cohort',
    fmt: (v) => `${v.toFixed(2)}`,
    interpret: (v) => (v > 0.6 ? 'Bullish' : v > 0.4 ? 'Neutral' : 'Bearish'),
    awaiting: true, paidNote: 'Requires Glassnode',
  },
  {
    key: 'whale_distribution', name: 'Whale Distribution',
    description: 'Net BTC removed by 1k+ BTC cohort',
    fmt: (v) => `${v.toFixed(2)}`,
    interpret: (v) => (v > 0.6 ? 'Bearish' : v > 0.4 ? 'Neutral' : 'Bullish'),
    awaiting: true, paidNote: 'Requires Glassnode',
  },
  {
    key: 'realized_price', name: 'Realized Price',
    description: 'On-chain cost basis of all BTC supply',
    fmt: (v) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    interpret: () => 'Neutral',
  },
  {
    key: 'nupl', name: 'NUPL',
    description: 'Net Unrealized Profit/Loss',
    fmt: (v) => v.toFixed(3),
    interpret: (v) => (v < 0.25 ? 'Bullish' : v < 0.75 ? 'Neutral' : 'Bearish'),
  },
  {
    key: 'reserve_risk', name: 'Reserve Risk',
    description: 'Long-term holder conviction vs price',
    fmt: (v) => v.toFixed(4),
    interpret: (v) => (v < 0.005 ? 'Bullish' : v < 0.02 ? 'Neutral' : 'Bearish'),
    awaiting: true, paidNote: 'Requires Glassnode',
  },


async function fetchInstitutional(): Promise<Row[]> {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 4); // 4-year history for percentile/historical
  const { data, error } = await supabase
    .from('dashboard_snapshots')
    .select('date, btc_close_usd, mvrv_value, realized_price, nupl, puell_value, reserve_risk, lth_sopr_value, exchange_inflow, exchange_outflow, whale_accumulation, whale_distribution')
    .gte('date', since.toISOString().slice(0, 10))
    .order('date', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Row[];
}

function percentileOf(value: number, sortedAsc: number[]): number {
  if (sortedAsc.length === 0) return 0;
  // binary search for first index >= value
  let lo = 0, hi = sortedAsc.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sortedAsc[mid] < value) lo = mid + 1; else hi = mid;
  }
  return Math.round((lo / sortedAsc.length) * 100);
}

function confidenceFor(rows: Row[], key: keyof Row): { label: string; tone: string } {
  const populated = rows.filter((r) => r[key] != null).length;
  if (populated === 0) return { label: 'No data', tone: 'text-muted-foreground/60' };
  if (populated < 90) return { label: 'Low', tone: 'text-rose-400' };
  if (populated < 365) return { label: 'Medium', tone: 'text-amber-400' };
  return { label: 'High', tone: 'text-emerald-400' };
}

function interpTone(i: Interp): string {
  return i === 'Bullish'
    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    : i === 'Bearish'
    ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
    : 'text-amber-400 bg-amber-500/10 border-amber-500/30';
}

export function InstitutionalIndicators() {
  const { data: rows, isLoading } = useQuery({
    queryKey: ['institutional-indicators-v1'],
    queryFn: fetchInstitutional,
    staleTime: 30 * 60 * 1000,
  });

  const cards = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    const latest = rows[rows.length - 1];
    // 30 days ago (or earliest available)
    const histRow = rows[Math.max(0, rows.length - 31)];

    return INDICATORS.map((def) => {
      const currentVal = latest[def.key] as number | null;
      const histVal = histRow[def.key] as number | null;
      const conf = confidenceFor(rows, def.key);
      const series = rows
        .map((r) => r[def.key])
        .filter((v): v is number => v != null && Number.isFinite(v))
        .sort((a, b) => a - b);
      const pct = currentVal != null ? percentileOf(currentVal, series) : null;
      const interp = currentVal != null && !def.awaiting ? def.interpret(currentVal) : null;
      const delta = currentVal != null && histVal != null ? currentVal - histVal : null;

      return { def, currentVal, histVal, pct, interp, conf, delta };
    });
  }, [rows]);

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <span className="text-lg">🏦</span>
          Institutional Indicators
        </CardTitle>
        <p className="text-xs text-muted-foreground/70">
          Ten on-chain signals scored alongside the Cycle Gauge. Greyed cards await a paid
          Glassnode / CryptoQuant feed.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading || !rows ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map(({ def, currentVal, histVal, pct, interp, conf, delta }) => {
              const dim = def.awaiting || currentVal == null;
              return (
                <div
                  key={def.name}
                  className={`rounded-lg border p-3 ${
                    dim ? 'border-border/30 bg-muted/10 opacity-70' : 'border-border/50 bg-muted/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-foreground truncate">{def.name}</div>
                      <div className="text-[10px] text-muted-foreground/80 truncate">
                        {def.description}
                      </div>
                    </div>
                    {def.awaiting ? (
                      <span className="rounded border border-border/60 bg-background/40 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                        {def.paidNote}
                      </span>
                    ) : interp ? (
                      <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${interpTone(interp)}`}>
                        {interp}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 flex items-baseline gap-2">
                    <div className="text-xl font-bold text-foreground">
                      {currentVal != null ? def.fmt(currentVal) : '—'}
                    </div>
                    {delta != null && currentVal != null && histVal != null && histVal !== 0 && (
                      <div
                        className={`text-[10px] font-medium ${
                          delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {delta >= 0 ? '▲' : '▼'}{' '}
                        {Math.abs((delta / Math.abs(histVal)) * 100).toFixed(1)}% 30d
                      </div>
                    )}
                  </div>

                  <div className="mt-1 text-[10px] text-muted-foreground/80">
                    30d ago: {histVal != null ? def.fmt(histVal) : '—'}
                  </div>

                  <div className="mt-3 space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">Historical percentile</span>
                      <span className="font-mono text-foreground/90">
                        {pct != null ? `${pct}%` : '—'}
                      </span>
                    </div>
                    <Progress value={pct ?? 0} className="h-1" />
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">Confidence</span>
                    <span className={`font-semibold ${conf.tone}`}>{conf.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
