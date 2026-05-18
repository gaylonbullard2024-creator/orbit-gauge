import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import type { HistoricalPoint } from '@/hooks/useDashboard';
import { computePowerLaw, computeZScore, powerLawStatus, powerLawStatusColor } from '@/lib/powerLaw';

const RANGES = [
  { label: '1Y', days: 365 },
  { label: '2Y', days: 730 },
  { label: '5Y', days: 1825 },
  { label: 'All', days: 0 },
] as const;

interface PowerLawChartProps {
  priceHistory: HistoricalPoint[];
}

const COLORS = {
  fair: '#f7931a',
  s1: '#22c55e',
  s2: '#eab308',
  s3up: '#ef4444',
  s3dn: '#3b82f6',
  price: '#ffffff',
};

export function PowerLawChart({ priceHistory }: PowerLawChartProps) {
  const [range, setRange] = useState<string>('All');

  const cutoffDate = useMemo(() => {
    const r = RANGES.find((r) => r.label === range);
    if (!r || r.days === 0) return null;
    const d = new Date();
    d.setDate(d.getDate() - r.days);
    return d.toISOString().slice(0, 10);
  }, [range]);

  const data = useMemo(() => {
    const filtered = cutoffDate
      ? priceHistory.filter((p) => p.date >= cutoffDate)
      : priceHistory;
    return filtered
      .map((p) => {
        const pl = computePowerLaw(p.date);
        if (!pl) return null;
        return {
          date: p.date,
          price: p.value,
          fair: pl.fair,
          p1: pl.bands.p1,
          n1: pl.bands.n1,
          p2: pl.bands.p2,
          n2: pl.bands.n2,
          p3: pl.bands.p3,
          n3: pl.bands.n3,
          // stacked-like band ranges for filled Areas
          band_n3_n2: [pl.bands.n3, pl.bands.n2],
          band_n2_n1: [pl.bands.n2, pl.bands.n1],
          band_n1_fair: [pl.bands.n1, pl.fair],
          band_fair_p1: [pl.fair, pl.bands.p1],
          band_p1_p2: [pl.bands.p1, pl.bands.p2],
          band_p2_p3: [pl.bands.p2, pl.bands.p3],
        };
      })
      .filter(Boolean) as Array<Record<string, number | string | [number, number]>>;
  }, [priceHistory, cutoffDate]);

  const latest = priceHistory[priceHistory.length - 1];
  const z = latest ? computeZScore(latest.value, latest.date) : null;
  const status = powerLawStatus(z);
  const statusColor = powerLawStatusColor(z);
  const pl = computePowerLaw(latest?.date ?? new Date());

  if (data.length < 2) return null;

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-2">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <span className="text-lg">📐</span>
              Bitcoin Power Law
            </CardTitle>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[260px] text-xs">
                  Log-log regression of price vs days since genesis (Burger / PlanB). Bands are ±1σ, ±2σ, ±3σ in log10 space.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {RANGES.map((r) => (
              <button
                key={r.label}
                onClick={() => setRange(r.label)}
                className={`rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  range === r.label
                    ? 'border-primary/50 bg-primary/10 text-primary'
                    : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                {r.label}
              </button>
            ))}
            {z != null && (
              <span className="ml-auto text-xs font-semibold flex items-center gap-2">
                <span className="text-muted-foreground font-mono">z={z.toFixed(2)}σ</span>
                <span
                  className="inline-block rounded-full px-2 py-0.5 text-xs"
                  style={{ backgroundColor: statusColor + '22', color: statusColor }}
                >
                  {status}
                </span>
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300} className="sm:!h-[360px]">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            {/* Bands — bottom to top */}
            <Area dataKey="band_n3_n2" stroke="none" fill={COLORS.s3dn} fillOpacity={0.18} isAnimationActive={false} activeDot={false} />
            <Area dataKey="band_n2_n1" stroke="none" fill={COLORS.s3dn} fillOpacity={0.28} isAnimationActive={false} activeDot={false} />
            <Area dataKey="band_n1_fair" stroke="none" fill={COLORS.s1} fillOpacity={0.22} isAnimationActive={false} activeDot={false} />
            <Area dataKey="band_fair_p1" stroke="none" fill={COLORS.s1} fillOpacity={0.22} isAnimationActive={false} activeDot={false} />
            <Area dataKey="band_p1_p2" stroke="none" fill={COLORS.s2} fillOpacity={0.28} isAnimationActive={false} activeDot={false} />
            <Area dataKey="band_p2_p3" stroke="none" fill={COLORS.s3up} fillOpacity={0.28} isAnimationActive={false} activeDot={false} />

            {/* Reference lines */}
            <Line type="monotone" dataKey="fair" stroke={COLORS.fair} strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
            <Line type="monotone" dataKey="p2" stroke={COLORS.s3up} strokeWidth={1} dot={false} strokeOpacity={0.6} />
            <Line type="monotone" dataKey="n2" stroke={COLORS.s3dn} strokeWidth={1} dot={false} strokeOpacity={0.6} />

            {/* BTC price */}
            <Line
              type="monotone"
              dataKey="price"
              stroke={COLORS.price}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 3, fill: COLORS.price }}
              style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.6))' }}
            />

            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'hsl(215, 15%, 55%)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(d: string) =>
                new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
              }
              minTickGap={50}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'hsl(215, 15%, 55%)' }}
              tickLine={false}
              axisLine={false}
              scale="log"
              domain={['auto', 'auto']}
              tickFormatter={(v: number) =>
                v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v.toFixed(2)}`
              }
              width={55}
            />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: 'hsl(220, 14%, 11%)',
                border: '1px solid hsl(220, 12%, 18%)',
                borderRadius: '8px',
                fontSize: '11px',
                color: 'hsl(210, 20%, 92%)',
              }}
              labelFormatter={(d: string) => new Date(d).toLocaleDateString()}
              formatter={(v: unknown, name: string) => {
                const labels: Record<string, string> = {
                  price: 'BTC Price',
                  fair: 'Fair Value',
                  p2: '+2σ',
                  n2: '−2σ',
                };
                if (!labels[name]) return [null, null] as unknown as [string, string];
                const num = Number(v);
                return [`$${num.toLocaleString(undefined, { maximumFractionDigits: num < 10 ? 2 : 0 })}`, labels[name]];
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Legend / readout */}
        {pl && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
            <Readout label="Fair Value" value={pl.fair} color={COLORS.fair} />
            <Readout label="+1σ" value={pl.bands.p1} color={COLORS.s1} />
            <Readout label="+2σ" value={pl.bands.p2} color={COLORS.s2} />
            <Readout label="+3σ" value={pl.bands.p3} color={COLORS.s3up} />
            <Readout label="−1σ" value={pl.bands.n1} color={COLORS.s1} />
            <Readout label="−2σ" value={pl.bands.n2} color={COLORS.s3dn} />
            <Readout label="−3σ" value={pl.bands.n3} color={COLORS.s3dn} />
            <Readout label="Days since genesis" value={Math.round(pl.days)} color="hsl(215, 15%, 55%)" raw />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Readout({ label, value, color, raw }: { label: string; value: number; color: string; raw?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-secondary/30 px-2 py-1.5">
      <div className="flex items-center gap-1.5 min-w-0">
        <div className="h-2 w-2 rounded-sm shrink-0" style={{ backgroundColor: color }} />
        <span className="text-muted-foreground truncate">{label}</span>
      </div>
      <span className="font-mono text-foreground">
        {raw ? value.toLocaleString() : `$${value.toLocaleString(undefined, { maximumFractionDigits: value < 10 ? 2 : 0 })}`}
      </span>
    </div>
  );
}
