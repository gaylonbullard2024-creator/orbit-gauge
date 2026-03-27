import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { HistoricalPoint } from '@/hooks/useDashboard';
import { useMemo, useState } from 'react';

const RANGES = [
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'All', days: 0 },
] as const;

interface PriceTrendChartProps {
  priceHistory: HistoricalPoint[];
  maHistory: HistoricalPoint[];
}

export function PriceTrendChart({ priceHistory, maHistory }: PriceTrendChartProps) {
  const [logScale, setLogScale] = useState(false);
  const [range, setRange] = useState<string>('1Y');

  const cutoffDate = useMemo(() => {
    const r = RANGES.find((r) => r.label === range);
    if (!r || r.days === 0) return null;
    const d = new Date();
    d.setDate(d.getDate() - r.days);
    return d.toISOString().slice(0, 10);
  }, [range]);

  if (!priceHistory.length) return null;

  // Merge price + MA data by date, filtered by range
  const maMap = new Map(maHistory.map((p) => [p.date, p.value]));
  const merged = priceHistory
    .filter((p) => !cutoffDate || p.date >= cutoffDate)
    .map((p) => ({
      date: p.date,
      price: p.value,
      ma200w: maMap.get(p.date) ?? null,
    }));

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-2">
        <div className="space-y-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <span className="text-lg">📈</span>
            <span className="hidden sm:inline">BTC Price vs 200-Week Moving Average</span>
            <span className="sm:hidden">BTC vs 200W MA</span>
          </CardTitle>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setLogScale((v) => !v)}
              className={`rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                logScale
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
            >
              {logScale ? 'LOG' : 'LIN'}
            </button>
            <span className="mx-0.5 h-3 w-px bg-border" />
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
            <span className="ml-auto flex items-center gap-3 text-[10px] font-normal">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-4 rounded-sm bg-primary" />
                Price
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-4 rounded-sm" style={{ backgroundColor: 'hsl(45, 90%, 55%)' }} />
                200W MA
              </span>
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220} className="sm:!h-[280px]">
          <ComposedChart data={merged} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="grad-price" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
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
              scale={logScale ? 'log' : 'auto'}
              domain={logScale ? ['auto', 'auto'] : ['dataMin', 'dataMax']}
              tick={{ fontSize: 10, fill: 'hsl(215, 15%, 55%)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
              width={50}
              allowDataOverflow
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(220, 14%, 11%)',
                border: '1px solid hsl(220, 12%, 18%)',
                borderRadius: '8px',
                fontSize: '11px',
                color: 'hsl(210, 20%, 92%)',
              }}
              labelFormatter={(d: string) => new Date(d).toLocaleDateString()}
              formatter={(v: number, name: string) => [
                `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                name === 'price' ? 'BTC Price' : '200W MA',
              ]}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke="hsl(var(--primary))"
              strokeWidth={1.5}
              fill="url(#grad-price)"
              dot={false}
              activeDot={{ r: 3, fill: 'hsl(var(--primary))' }}
            />
            <Line
              type="monotone"
              dataKey="ma200w"
              stroke="hsl(45, 90%, 55%)"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              activeDot={{ r: 3, fill: 'hsl(45, 90%, 55%)' }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
