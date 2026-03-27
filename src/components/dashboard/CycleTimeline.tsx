import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Area,
  AreaChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DashboardSnapshot } from '@/hooks/useDashboard';
import { useMemo } from 'react';

interface CycleTimelineProps {
  snapshots: DashboardSnapshot[];
}

const PHASE_BANDS = [
  { y1: 0, y2: 5, color: 'hsl(220, 70%, 45%)', label: 'Deep Value' },
  { y1: 5, y2: 9, color: 'hsl(152, 60%, 40%)', label: 'Accumulation' },
  { y1: 9, y2: 13, color: 'hsl(45, 90%, 50%)', label: 'Bull Trend' },
  { y1: 13, y2: 17, color: 'hsl(28, 90%, 55%)', label: 'Overheated' },
  { y1: 17, y2: 20, color: 'hsl(0, 72%, 51%)', label: 'Cycle Top' },
];

export function CycleTimeline({ snapshots }: CycleTimelineProps) {
  const data = useMemo(
    () =>
      snapshots
        .filter((s) => s.cycle_total_score != null)
        .map((s) => ({ date: s.date, score: s.cycle_total_score! })),
    [snapshots]
  );

  if (data.length < 2) return null;

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <span className="text-lg">📊</span>
          Cycle Score Over Time
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220} className="sm:!h-[260px]">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="grad-cycle" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            {/* Phase background bands */}
            {PHASE_BANDS.map((band) => (
              <ReferenceArea
                key={band.label}
                y1={band.y1}
                y2={band.y2}
                fill={band.color}
                fillOpacity={0.08}
              />
            ))}
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
              domain={[0, 20]}
              tick={{ fontSize: 10, fill: 'hsl(215, 15%, 55%)' }}
              tickLine={false}
              axisLine={false}
              width={30}
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
              formatter={(v: number) => [v, 'Cycle Score']}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#grad-cycle)"
              dot={false}
              activeDot={{ r: 3, fill: 'hsl(var(--primary))' }}
            />
          </AreaChart>
        </ResponsiveContainer>
        {/* Phase legend */}
        <div className="flex flex-wrap justify-center gap-3 mt-3">
          {PHASE_BANDS.map((band) => (
            <div key={band.label} className="flex items-center gap-1.5 text-[10px]">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: band.color }} />
              <span className="text-muted-foreground">{band.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
