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
  { key: 'band_9', label: 'Maximum Bubble Territory', color: '#882255' },
  { key: 'band_8', label: 'Sell. Seriously, SELL!', color: '#DC143C' },
  { key: 'band_7', label: 'FOMO Intensifies', color: '#FF4500' },
  { key: 'band_6', label: 'Is this a bubble?', color: '#FF8C00' },
  { key: 'band_5', label: 'HODL!', color: '#FFD700' },
  { key: 'band_4', label: 'Still Cheap', color: '#9ACD32' },
  { key: 'band_3', label: 'Accumulate', color: '#2E8B57' },
  { key: 'band_2', label: 'BUY!', color: '#20B2AA' },
  { key: 'band_1', label: 'Fire Sale', color: '#1E3A8A' },
];

const BAND_MULTIPLIERS = [
  { floor: 0.3, ceil: 0.45 },   // band_1: Fire Sale
  { floor: 0.45, ceil: 0.6 },   // band_2: BUY!
  { floor: 0.6, ceil: 0.78 },   // band_3: Accumulate
  { floor: 0.78, ceil: 0.95 },  // band_4: Still Cheap
  { floor: 0.95, ceil: 1.15 },  // band_5: HODL!
  { floor: 1.15, ceil: 1.4 },   // band_6: Is this a bubble?
  { floor: 1.4, ceil: 1.75 },   // band_7: FOMO Intensifies
  { floor: 1.75, ceil: 2.2 },   // band_8: Sell. Seriously, SELL!
  { floor: 2.2, ceil: 3.0 },    // band_9: Maximum Bubble Territory
];

const RANGES = [
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: '2Y', days: 730 },
  { label: '5Y', days: 1825 },
  { label: 'All', days: 0 },
] as const;

interface RainbowChartProps {
  priceHistory: HistoricalPoint[];
  currentBand: string | null;
}

function generateBands(priceHistory: HistoricalPoint[]) {
  if (priceHistory.length < 2) return [];

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
    const point: Record<string, unknown> = {
      date: p.date,
      price: p.value,
    };
    // Bands rendered bottom-to-top; reversed array so band_1 is first
    const reversed = [...BAND_MULTIPLIERS].reverse();
    reversed.forEach((m, idx) => {
      const key = `band_${BAND_MULTIPLIERS.length - idx}`;
      point[key] = [base * m.floor, base * m.ceil];
    });
    return point;
  });
}

export function RainbowChart({ priceHistory, currentBand }: RainbowChartProps) {
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
    return generateBands(filtered);
  }, [priceHistory, cutoffDate]);

  if (data.length < 2) return null;

  // Render bands bottom-to-top (Fire Sale first, then layered upward)
  const bandsBottomUp = [...RAINBOW_BANDS].reverse();

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
                  Logarithmic regression rainbow band model. Shows where BTC sits relative to its long-term growth curve.
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
            {/* Rainbow bands — bottom to top */}
            {bandsBottomUp.map((band) => (
              <Area
                key={band.key}
                type="monotone"
                dataKey={band.key}
                stroke="none"
                fill={band.color}
                fillOpacity={0.85}
                activeDot={false}
                dot={false}
                isAnimationActive={false}
              />
            ))}

            {/* BTC Price line — white with glow */}
            <Line
              type="monotone"
              dataKey="price"
              stroke="#ffffff"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 3, fill: '#ffffff', stroke: '#ffffff' }}
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
                v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v.toFixed(0)}`
              }
              width={50}
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
                if (name === 'price')
                  return [`$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 'BTC Price'];
                if (Array.isArray(v)) {
                  const band = RAINBOW_BANDS.find((b) => b.key === name);
                  return [
                    `$${Number(v[0]).toLocaleString(undefined, { maximumFractionDigits: 0 })} – $${Number(v[1]).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                    band?.label ?? name,
                  ];
                }
                return [String(v), name];
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* 9-band legend — 3×3 grid */}
        <div className="mt-4 grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2">
          {RAINBOW_BANDS.map((band) => (
            <div
              key={band.key}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[10px] sm:text-xs transition-all ${
                currentBand && bandMatchesKey(currentBand, band.key)
                  ? 'bg-secondary/80 ring-1 ring-primary/30'
                  : 'bg-secondary/30'
              }`}
            >
              <div
                className="h-2.5 w-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: band.color }}
              />
              <span className="font-medium text-foreground truncate">{band.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function getBandColor(band: string): string {
  const map: Record<string, string> = {
    'Maximum Bubble Territory': '#882255',
    'Sell. Seriously, SELL!': '#DC143C',
    'FOMO Intensifies': '#FF4500',
    'Is this a bubble?': '#FF8C00',
    'HODL!': '#FFD700',
    'Still Cheap': '#9ACD32',
    'Accumulate': '#2E8B57',
    'BUY!': '#20B2AA',
    'Fire Sale': '#1E3A8A',
    // Legacy mappings
    'Growth': '#FFD700',
    'Hold': '#FFD700',
    'Overheated': '#FF8C00',
    'Bubble Risk': '#DC143C',
    'Bubble Forming': '#FF4500',
    'Cycle Top Risk': '#882255',
  };
  return map[band] ?? '#FFD700';
}

function bandMatchesKey(bandLabel: string, key: string): boolean {
  const map: Record<string, string[]> = {
    band_1: ['Fire Sale'],
    band_2: ['BUY!'],
    band_3: ['Accumulate'],
    band_4: ['Still Cheap'],
    band_5: ['HODL!', 'Hold', 'Growth'],
    band_6: ['Is this a bubble?'],
    band_7: ['FOMO Intensifies', 'Bubble Forming'],
    band_8: ['Sell. Seriously, SELL!', 'Overheated', 'Bubble Risk'],
    band_9: ['Maximum Bubble Territory', 'Cycle Top Risk'],
  };
  return map[key]?.includes(bandLabel) ?? false;
}
