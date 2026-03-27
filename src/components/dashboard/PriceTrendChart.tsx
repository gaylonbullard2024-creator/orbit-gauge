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
import { useState } from 'react';

interface PriceTrendChartProps {
  priceHistory: HistoricalPoint[];
  maHistory: HistoricalPoint[];
}

export function PriceTrendChart({ priceHistory, maHistory }: PriceTrendChartProps) {
  const [logScale, setLogScale] = useState(false);

  if (!priceHistory.length) return null;

  // Merge price + MA data by date
  const maMap = new Map(maHistory.map((p) => [p.date, p.value]));
  const merged = priceHistory.map((p) => ({
    date: p.date,
    price: p.value,
    ma200w: maMap.get(p.date) ?? null,
  }));

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <span className="text-lg">📈</span>
          BTC Price vs 200-Week Moving Average
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
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
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
              tick={{ fontSize: 10, fill: 'hsl(215, 15%, 55%)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
              domain={['dataMin', 'dataMax']}
              width={50}
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
