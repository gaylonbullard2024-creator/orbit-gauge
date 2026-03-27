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

const RAINBOW_BANDS = [
  { key: 'fire_sale', label: 'Fire Sale', color: 'hsl(220, 70%, 50%)' },
  { key: 'accumulate', label: 'Accumulate', color: 'hsl(152, 60%, 42%)' },
  { key: 'hold', label: 'Hold', color: 'hsl(50, 85%, 50%)' },
  { key: 'bubble', label: 'Bubble Forming', color: 'hsl(28, 90%, 55%)' },
  { key: 'top', label: 'Cycle Top Risk', color: 'hsl(0, 72%, 51%)' },
];

const RANGES = [
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'All', days: 0 },
] as const;

interface RainbowChartProps {
  priceHistory: HistoricalPoint[];
  currentBand: string | null;
}

/**
 * Generate logarithmic rainbow bands based on price data.
 * Uses a simplified log regression approach — bands are proportional
 * multiples of the 200W MA / long-term trend line.
 */
function generateBands(priceHistory: HistoricalPoint[]) {
  if (priceHistory.length < 2) return [];

  // Calculate a rolling "fair value" as a smoothed trendline
  const prices = priceHistory.map((p) => p.value);
  const smoothWindow = Math.min(60, Math.floor(prices.length / 3));

  const smoothed: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    const start = Math.max(0, i - smoothWindow);
    const slice = prices.slice(start, i + 1);
    smoothed.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }

  return priceHistory.map((p, i) => {
    const base = smoothed[i];
    return {
      date: p.date,
      price: p.value,
      fire_sale: [base * 0.4, base * 0.65],
      accumulate: [base * 0.65, base * 0.85],
      hold: [base * 0.85, base * 1.15],
      bubble: [base * 1.15, base * 1.5],
      top: [base * 1.5, base * 2.2],
    };
  });
}

export function RainbowChart({ priceHistory, currentBand }: RainbowChartProps) {
  const [range, setRange] = useState<string>('1Y');

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
    return generateBands(filtered);
  }, [priceHistory, cutoffDate]);

  if (data.length < 2) return null;

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-2">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <span className="text-lg">🌈</span>
              Bitcoin Rainbow Chart
            </CardTitle>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[250px] text-xs">
                  Logarithmic price band model showing where BTC sits relative to its long-term growth curve. Simple but effective for cycle positioning.
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

            {/* Current band badge */}
            {currentBand && (
              <span className="ml-auto text-xs font-semibold">
                Current:{' '}
                <span
                  className="inline-block rounded-full px-2 py-0.5 text-xs"
                  style={{
                    backgroundColor: getBandColor(currentBand) + '22',
                    color: getBandColor(currentBand),
                  }}
                >
                  {currentBand}
                </span>
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280} className="sm:!h-[340px]">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            {/* Rainbow band areas */}
            {RAINBOW_BANDS.map((band) => (
              <Area
                key={band.key}
                type="monotone"
                dataKey={band.key}
                stroke="none"
                fill={band.color}
                fillOpacity={0.15}
                activeDot={false}
                dot={false}
                isAnimationActive={false}
              />
            ))}

            {/* BTC Price line */}
            <Line
              type="monotone"
              dataKey="price"
              stroke="hsl(var(--foreground))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: 'hsl(var(--primary))' }}
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
              tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
              width={50}
              domain={['dataMin', 'dataMax']}
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
                if (name === 'price') return [`$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 'BTC Price'];
                if (Array.isArray(v)) {
                  const band = RAINBOW_BANDS.find((b) => b.key === name);
                  return [`$${Number(v[0]).toLocaleString(undefined, { maximumFractionDigits: 0 })} – $${Number(v[1]).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, band?.label ?? name];
                }
                return [String(v), name];
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Band legend + interpretation */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-5 gap-2">
          {RAINBOW_BANDS.map((band) => (
            <div
              key={band.key}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-all ${
                currentBand && bandMatchesKey(currentBand, band.key)
                  ? 'bg-secondary/80 ring-1 ring-primary/30'
                  : 'bg-secondary/30'
              }`}
            >
              <div className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: band.color }} />
              <div>
                <p className="font-semibold text-foreground">{band.label}</p>
                <p className="text-muted-foreground text-[10px]">{getBandAction(band.key)}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function getBandColor(band: string): string {
  const map: Record<string, string> = {
    'Fire Sale': 'hsl(220, 70%, 50%)',
    'Accumulate': 'hsl(152, 60%, 42%)',
    'Growth': 'hsl(50, 85%, 50%)',
    'Hold': 'hsl(50, 85%, 50%)',
    'Overheated': 'hsl(28, 90%, 55%)',
    'Bubble Risk': 'hsl(0, 72%, 51%)',
    'Bubble Forming': 'hsl(28, 90%, 55%)',
    'Cycle Top Risk': 'hsl(0, 72%, 51%)',
  };
  return map[band] ?? 'hsl(45, 90%, 50%)';
}

function bandMatchesKey(bandLabel: string, key: string): boolean {
  const map: Record<string, string[]> = {
    fire_sale: ['Fire Sale'],
    accumulate: ['Accumulate'],
    hold: ['Growth', 'Hold'],
    bubble: ['Overheated', 'Bubble Forming', 'Bubble Risk'],
    top: ['Cycle Top Risk'],
  };
  return map[key]?.includes(bandLabel) ?? false;
}

function getBandAction(key: string): string {
  const actions: Record<string, string> = {
    fire_sale: 'Maximum accumulation zone',
    accumulate: 'Build positions gradually',
    hold: 'Maintain exposure',
    bubble: 'Reduce risk, take profits',
    top: 'Exit or hedge positions',
  };
  return actions[key] ?? '';
}
