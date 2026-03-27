import { useMemo } from 'react';
import { Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Area, AreaChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import type { HistoricalPoint } from '@/hooks/useDashboard';

interface FearGreedGaugeProps {
  value: number;
  score: number;
  previousValue?: number | null;
  previousScore?: number | null;
  history?: HistoricalPoint[];
  tooltip?: string;
}

const ZONES = [
  { label: 'Extreme Fear', min: 0, max: 25, color: 'hsl(0, 72%, 51%)' },
  { label: 'Fear', min: 25, max: 40, color: 'hsl(28, 90%, 55%)' },
  { label: 'Neutral', min: 40, max: 60, color: 'hsl(45, 90%, 50%)' },
  { label: 'Greed', min: 60, max: 75, color: 'hsl(152, 60%, 50%)' },
  { label: 'Extreme Greed', min: 75, max: 100, color: 'hsl(152, 60%, 35%)' },
];

function getClassification(v: number): string {
  if (v <= 25) return 'Extreme Fear';
  if (v <= 40) return 'Fear';
  if (v <= 60) return 'Neutral';
  if (v <= 75) return 'Greed';
  return 'Extreme Greed';
}

function getColor(v: number): string {
  const zone = ZONES.find((z) => v >= z.min && v <= z.max);
  return zone?.color ?? 'hsl(45, 90%, 50%)';
}

export function FearGreedGauge({
  value,
  score,
  previousValue,
  previousScore,
  history,
  tooltip,
}: FearGreedGaugeProps) {
  const classification = getClassification(value);
  const color = getColor(value);
  const scoreDelta = previousScore != null ? score - previousScore : null;
  const valueDelta = previousValue != null ? value - previousValue : null;

  const needleAngle = useMemo(() => {
    const pct = Math.min(Math.max(value / 100, 0), 1);
    return -90 + pct * 180;
  }, [value]);

  return (
    <Card className="border-border/50 bg-card/80 transition-all hover:border-primary/30 col-span-1 sm:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between pb-1">
        <div className="flex items-center gap-1.5">
          <CardTitle className="text-sm font-medium text-muted-foreground">Fear & Greed Index</CardTitle>
          {tooltip && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px] text-xs">
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {scoreDelta != null && scoreDelta !== 0 && (
            <span className={`font-mono text-[10px] font-semibold ${scoreDelta > 0 ? 'text-[hsl(0,72%,51%)]' : 'text-[hsl(152,60%,40%)]'}`}>
              {scoreDelta > 0 ? '↑' : '↓'}{Math.abs(scoreDelta)}
            </span>
          )}
          <span className="font-mono text-xs text-muted-foreground">{score} / 4</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {/* Gauge */}
          <div className="relative w-full max-w-[200px] aspect-[2/1.2] shrink-0">
            <svg viewBox="0 0 200 120" className="w-full h-full">
              {/* Zone arcs */}
              {ZONES.map((zone, i) => {
                const totalRange = 100;
                const startPct = zone.min / totalRange;
                const endPct = zone.max / totalRange;
                const startAngle = -90 + startPct * 180;
                const endAngle = -90 + endPct * 180;
                const startRad = (startAngle * Math.PI) / 180;
                const endRad = (endAngle * Math.PI) / 180;
                const r = 75;
                const cx = 100;
                const cy = 100;
                return (
                  <path
                    key={i}
                    d={`M ${cx + r * Math.cos(startRad)} ${cy + r * Math.sin(startRad)} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(endRad)} ${cy + r * Math.sin(endRad)}`}
                    fill="none"
                    stroke={zone.color}
                    strokeWidth="14"
                    strokeLinecap="butt"
                    opacity={classification === zone.label ? 1 : 0.3}
                  />
                );
              })}
              {/* Value text */}
              <text
                x="100"
                y="80"
                textAnchor="middle"
                style={{ fontSize: '28px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fill: color }}
              >
                {value}
              </text>
              <text
                x="100"
                y="96"
                textAnchor="middle"
                style={{ fontSize: '9px', fontFamily: "'Inter', sans-serif", fontWeight: 500 }}
                className="fill-muted-foreground"
              >
                / 100
              </text>
              {/* Needle */}
              <g transform={`rotate(${needleAngle}, 100, 100)`}>
                <line x1="100" y1="100" x2="100" y2="32" stroke="hsl(var(--foreground))" strokeWidth="2" strokeLinecap="round" />
                <circle cx="100" cy="100" r="4" fill={color} />
              </g>
              {/* Axis labels */}
              <text x="18" y="108" textAnchor="middle" style={{ fontSize: '8px' }} className="fill-muted-foreground">0</text>
              <text x="182" y="108" textAnchor="middle" style={{ fontSize: '8px' }} className="fill-muted-foreground">100</text>
            </svg>
          </div>

          {/* Right side: classification + delta + mini chart */}
          <div className="flex-1 w-full space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-block rounded-full px-3 py-1 text-sm font-bold"
                style={{ backgroundColor: color + '22', color }}
              >
                {classification}
              </span>
              {valueDelta != null && valueDelta !== 0 && (
                <span className={`font-mono text-sm font-semibold ${valueDelta > 0 ? 'text-[hsl(152,60%,40%)]' : 'text-[hsl(0,72%,51%)]'}`}>
                  {valueDelta > 0 ? '+' : ''}{valueDelta} pts
                </span>
              )}
            </div>

            {/* Zone legend */}
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {ZONES.map((zone) => (
                <div key={zone.label} className="flex items-center gap-1 text-[10px]">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: zone.color, opacity: classification === zone.label ? 1 : 0.4 }}
                  />
                  <span className={classification === zone.label ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                    {zone.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Mini sparkline */}
            {history && history.length > 1 && (
              <div>
                <p className="text-[10px] text-muted-foreground mb-0.5">Past Year</p>
                <ResponsiveContainer width="100%" height={60}>
                  <AreaChart data={history} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="grad-fg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <YAxis hide domain={[0, 100]} />
                    <XAxis dataKey="date" hide />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: 'hsl(220, 14%, 11%)',
                        border: '1px solid hsl(220, 12%, 18%)',
                        borderRadius: '8px',
                        fontSize: '11px',
                        color: 'hsl(210, 20%, 92%)',
                      }}
                      labelFormatter={(d: string) => new Date(d).toLocaleDateString()}
                      formatter={(v: number) => [v, 'Fear & Greed']}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={color}
                      strokeWidth={1.5}
                      fill="url(#grad-fg)"
                      dot={false}
                      activeDot={{ r: 2, fill: color }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
