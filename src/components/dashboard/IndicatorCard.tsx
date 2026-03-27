import { useState } from 'react';
import { Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Area, AreaChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import type { HistoricalPoint } from '@/hooks/useDashboard';

interface IndicatorCardProps {
  title: string;
  value: string | number;
  score: number;
  maxScore: number;
  status: string;
  statusColor: string;
  icon: string;
  subtitle?: string;
  disabled?: boolean;
  history?: HistoricalPoint[];
  chartLabel?: string;
  formatValue?: (v: number) => string;
  tooltip?: string;
  previousValue?: string | number | null;
  previousScore?: number | null;
}

export function IndicatorCard({
  title,
  value,
  score,
  maxScore,
  status,
  statusColor,
  icon,
  subtitle,
  disabled,
  history,
  chartLabel,
  formatValue,
  tooltip,
  previousValue,
  previousScore,
}: IndicatorCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasChart = !disabled && history && history.length > 1;

  const scoreDelta = previousScore != null ? score - previousScore : null;

  return (
    <Card
      className={`border-border/50 bg-card/80 transition-all hover:border-primary/30 ${disabled ? 'opacity-50' : ''} ${hasChart ? 'cursor-pointer' : ''}`}
      onClick={() => hasChart && setExpanded(!expanded)}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-1.5">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          {tooltip && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px] text-xs">
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex items-center gap-1">
          {hasChart && (
            <span className="text-[10px] text-muted-foreground/50">
              {expanded ? '▲' : '▼'}
            </span>
          )}
          <span className="text-lg">{icon}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xl sm:text-2xl font-bold text-foreground">
            {disabled ? '—' : value}
          </span>
          {!disabled && previousValue != null && previousValue !== value && (
            <span className="text-xs text-muted-foreground font-mono">
              ← {previousValue}
            </span>
          )}
          {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        </div>
        <div className="flex items-center justify-between">
          <span
            className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{ backgroundColor: statusColor + '22', color: statusColor }}
          >
            {disabled ? 'Coming Soon' : status}
          </span>
          <div className="flex items-center gap-1.5">
            {scoreDelta != null && scoreDelta !== 0 && (
              <span className={`font-mono text-[10px] font-semibold ${scoreDelta > 0 ? 'text-[hsl(0,72%,51%)]' : 'text-[hsl(152,60%,40%)]'}`}>
                {scoreDelta > 0 ? '↑' : '↓'}{Math.abs(scoreDelta)}
              </span>
            )}
            <span className="font-mono text-xs text-muted-foreground">
              {disabled ? '—' : score} / {maxScore}
            </span>
          </div>
        </div>
        {/* Score bar */}
        <div className="h-1.5 w-full rounded-full bg-secondary">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: disabled ? '0%' : `${(score / maxScore) * 100}%`,
              backgroundColor: statusColor,
            }}
          />
        </div>

        {/* Expandable chart */}
        {expanded && hasChart && (
          <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <p className="text-[10px] text-muted-foreground mb-1">{chartLabel ?? title} — Past Year</p>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={history} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`grad-${title.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={statusColor} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={statusColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: 'hsl(215, 15%, 55%)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(d: string) => {
                    const dt = new Date(d);
                    return dt.toLocaleDateString('en-US', { month: 'short' });
                  }}
                  minTickGap={40}
                />
                <YAxis
                  hide
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
                  formatter={(v: number) => [
                    formatValue ? formatValue(v) : v.toLocaleString(),
                    chartLabel ?? title,
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={statusColor}
                  strokeWidth={1.5}
                  fill={`url(#grad-${title.replace(/\s/g, '')})`}
                  dot={false}
                  activeDot={{ r: 3, fill: statusColor }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
