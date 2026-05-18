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
  up1: '#22c55e',
  up2: '#eab308',
  up3: '#ef4444',
  dn1: '#0ea5e9',
  dn2: '#3b82f6',
  dn3: '#6366f1',
  price: '#ffffff',
};

const TOOLTIP_LABELS: Record<string, string> = {
  price: 'BTC Price',
  fair: 'Fair Value',
  p1: '+1σ',
  n1: '−1σ',
  p2: '+2σ',
  n2: '−2σ',
  p3: '+3σ',
  n3: '−3σ',
  band_dn3_dn2: 'Deep Value Zone (−3σ to −2σ)',
  band_dn2_dn1: 'Accumulation Zone (−2σ to −1σ)',
  band_dn1_fair: 'Below Fair (−1σ to Fair)',
  band_fair_up1: 'Above Fair (Fair to +1σ)',
  band_up1_up2: 'Overheated Zone (+1σ to +2σ)',
  band_up2_up3: 'Extreme Overvalued (+2σ to +3σ)',
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
          band_dn3_dn2: [pl.bands.n3, pl.bands.n2],
          band_dn2_dn1: [pl.bands.n2, pl.bands.n1],
          band_dn1_fair: [pl.bands.n1, pl.fair],
          band_fair_up1: [pl.fair, pl.bands.p1],
          band_up1_up2: [pl.bands.p1, pl.bands.p2],
          band_up2_up3: [pl.bands.p2, pl.bands.p3],
        };
      })
      .filter(Boolean) as Array<Record<string, unknown>>;
  }, [priceHistory, cutoffDate]);

  const latest = priceHistory[priceHistory.length - 1];
  const z = latest ? computeZScore(latest.value, latest.date) : null;
  const status = powerLawStatus(z);
  const statusColor = powerLawStatusColor(z);
  const pl = computePowerLaw(latest?.date ?? new Date());
  const premium = z != null && pl ? ((latest.value - pl.fair) / pl.fair) * 100 : null;

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
            <Area dataKey="band_dn3_dn2" stroke="none" fill={COLORS.dn3} fillOpacity={0.18} isAnimationActive={false} activeDot={false} />
            <Area dataKey="band_dn2_dn1" stroke="none" fill={COLORS.dn2} fillOpacity={0.28} isAnimationActive={false} activeDot={false} />
            <Area dataKey="band_dn1_fair" stroke="none" fill={COLORS.dn1} fillOpacity={0.22} isAnimationActive={false} activeDot={false} />
            <Area dataKey="band_fair_up1" stroke="none" fill={COLORS.up1} fillOpacity={0.22} isAnimationActive={false} activeDot={false} />
            <Area dataKey="band_up1_up2" stroke="none" fill={COLORS.up2} fillOpacity={0.28} isAnimationActive={false} activeDot={false} />
            <Area dataKey="band_up2_up3" stroke="none" fill={COLORS.up3} fillOpacity={0.28} isAnimationActive={false} activeDot={false} />

            {/* Reference lines */}
            <Line type="monotone" dataKey="fair" stroke={COLORS.fair} strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
            <Line type="monotone" dataKey="p2" stroke={COLORS.up3} strokeWidth={1} dot={false} strokeOpacity={0.6} />
            <Line type="monotone" dataKey="n2" stroke={COLORS.dn2} strokeWidth={1} dot={false} strokeOpacity={0.6} />

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
                if (!TOOLTIP_LABELS[name]) return [null, null] as unknown as [string, string];
                const label = TOOLTIP_LABELS[name];
                // band ranges come as [min, max]
                if (Array.isArray(v)) {
                  const low = Number(v[0]);
                  const high = Number(v[1]);
                  return [
                    `$${low.toLocaleString(undefined, { maximumFractionDigits: 0 })} – $${high.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                    label,
                  ];
                }
                const num = Number(v);
                return [`$${num.toLocaleString(undefined, { maximumFractionDigits: num < 10 ? 2 : 0 })}`, label];
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Today's Position Highlight */}
        {pl && latest && (
          <div className="mt-4 rounded-lg border border-border/40 bg-card/60 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Today vs Fair Value</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground/70 mb-0.5">BTC Price</p>
                <p className="font-mono text-sm font-semibold text-foreground">${latest.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </div>
              <div>
                <p className="text-muted-foreground/70 mb-0.5">Fair Value</p>
                <p className="font-mono text-sm font-semibold" style={{ color: COLORS.fair }}>${pl.fair.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </div>
              <div>
                <p className="text-muted-foreground/70 mb-0.5">Premium / Discount</p>
                <p className={`font-mono text-sm font-semibold ${premium != null && premium >= 0 ? 'text-[hsl(0,72%,55%)]' : 'text-[hsl(152,60%,45%)]'}`}>
                  {premium != null ? `${premium >= 0 ? '+' : ''}${premium.toFixed(1)}%` : '—'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground/70 mb-0.5">Z-Score</p>
                <p className="font-mono text-sm font-semibold" style={{ color: statusColor }}>
                  {z != null ? `${z >= 0 ? '+' : ''}${z.toFixed(2)}σ` : '—'}
                </p>
              </div>
            </div>
            {/* Sigma band position bar */}
            {z != null && (
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground/60 font-mono">
                  <span>−3σ</span>
                  <span>−2σ</span>
                  <span>−1σ</span>
                  <span>Fair</span>
                  <span>+1σ</span>
                  <span>+2σ</span>
                  <span>+3σ</span>
                </div>
                <div className="relative h-3 rounded-full overflow-hidden flex">
                  <div className="flex-1 h-full" style={{ backgroundColor: COLORS.dn3, opacity: 0.3 }} />
                  <div className="flex-1 h-full" style={{ backgroundColor: COLORS.dn2, opacity: 0.4 }} />
                  <div className="flex-1 h-full" style={{ backgroundColor: COLORS.dn1, opacity: 0.5 }} />
                  <div className="flex-1 h-full" style={{ backgroundColor: COLORS.up1, opacity: 0.5 }} />
                  <div className="flex-1 h-full" style={{ backgroundColor: COLORS.up2, opacity: 0.4 }} />
                  <div className="flex-1 h-full" style={{ backgroundColor: COLORS.up3, opacity: 0.3 }} />
                </div>
                {/* Position marker */}
                <div className="relative h-0">
                  <div
                    className="absolute top-[-15px] -translate-x-1/2"
                    style={{
                      left: `${Math.max(0, Math.min(100, ((z + 3) / 6) * 100))}%`,
                    }}
                  >
                    <div className="flex flex-col items-center">
                      <div className="w-0.5 h-3 bg-white/80" />
                      <div className="w-2 h-2 rounded-full bg-white border-2 border-background shadow-sm" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        {pl && (
          <div className="mt-3 space-y-2">
            {/* Sigma bands */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="text-muted-foreground/70 text-[10px] uppercase tracking-wider mr-1">Bands:</span>
              <LegendDot color={COLORS.fair} label="Fair Value" dash />
              <LegendDot color={COLORS.dn1} label="−1σ" />
              <LegendDot color={COLORS.dn2} label="−2σ" />
              <LegendDot color={COLORS.dn3} label="−3σ" />
              <LegendDot color={COLORS.up1} label="+1σ" />
              <LegendDot color={COLORS.up2} label="+2σ" />
              <LegendDot color={COLORS.up3} label="+3σ" />
              <LegendDot color={COLORS.price} label="BTC Price" />
            </div>
            {/* Price readouts */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
              <Readout label="Fair Value" value={pl.fair} color={COLORS.fair} />
              <Readout label="+1σ" value={pl.bands.p1} color={COLORS.up1} />
              <Readout label="+2σ" value={pl.bands.p2} color={COLORS.up2} />
              <Readout label="+3σ" value={pl.bands.p3} color={COLORS.up3} />
              <Readout label="−1σ" value={pl.bands.n1} color={COLORS.dn1} />
              <Readout label="−2σ" value={pl.bands.n2} color={COLORS.dn2} />
              <Readout label="−3σ" value={pl.bands.n3} color={COLORS.dn3} />
              <Readout label="Days since genesis" value={Math.round(pl.days)} color="hsl(215, 15%, 55%)" raw />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LegendDot({ color, label, dash }: { color: string; label: string; dash?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="h-0.5 w-4 rounded-full shrink-0"
        style={{
          backgroundColor: color,
          border: dash ? undefined : 'none',
          ...(dash ? { borderTop: `2px dashed ${color}`, backgroundColor: 'transparent', height: '2px' } : {}),
        }}
      />
      <span className="text-muted-foreground text-[10px]">{label}</span>
    </div>
  );
}

function Readout({ label, value, color, raw }: { label: string; value: number; color: string; raw?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-secondary/30 px-2 py-1.5">
      <div className="flex items-center gap-1.5 min-w-0">
        <div className="h-2 w-2 rounded-sm shrink-0" style={{ backgroundColor: color }} />
        <span className="text-muted-foreground truncate text-[11px]">{label}</span>
      </div>
      <span className="font-mono text-foreground text-[11px]">
        {raw ? value.toLocaleString() : `$${value.toLocaleString(undefined, { maximumFractionDigits: value < 10 ? 2 : 0 })}`}
      </span>
    </div>
  );
}
