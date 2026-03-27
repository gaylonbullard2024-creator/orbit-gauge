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
  { label: 'Greed', min: 60, max: 75, color: 'hsl(100, 60%, 50%)' },
  { label: 'Extreme Greed', min: 75, max: 100, color: 'hsl(130, 65%, 45%)' },
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

/** Build a thick arc path (annular sector) */
function arcPath(cx: number, cy: number, rOuter: number, rInner: number, startDeg: number, endDeg: number): string {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const s = toRad(startDeg);
  const e = toRad(endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;

  const x1o = cx + rOuter * Math.cos(s);
  const y1o = cy + rOuter * Math.sin(s);
  const x2o = cx + rOuter * Math.cos(e);
  const y2o = cy + rOuter * Math.sin(e);
  const x1i = cx + rInner * Math.cos(e);
  const y1i = cy + rInner * Math.sin(e);
  const x2i = cx + rInner * Math.cos(s);
  const y2i = cy + rInner * Math.sin(s);

  return [
    `M ${x1o} ${y1o}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2o} ${y2o}`,
    `L ${x1i} ${y1i}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${x2i} ${y2i}`,
    'Z',
  ].join(' ');
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
    return -180 + pct * 180; // -180 (left) to 0 (right)
  }, [value]);

  const cx = 150;
  const cy = 140;
  const rOuter = 120;
  const rInner = 80;

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
          {/* Gauge — alternative.me style */}
          <div className="relative w-full max-w-[260px] shrink-0">
            {/* Classification label above */}
            <div className="text-center mb-1">
              <span className="text-xs text-muted-foreground">Now:</span>
              <span className="ml-1.5 text-base font-bold" style={{ color }}>
                {classification}
              </span>
            </div>

            <svg viewBox="0 0 300 170" className="w-full">
              <defs>
                {/* Gradient for the arc */}
                <linearGradient id="fg-arc-gradient" x1="0" y1="0.5" x2="1" y2="0.5">
                  <stop offset="0%" stopColor="hsl(0, 72%, 51%)" />
                  <stop offset="25%" stopColor="hsl(28, 90%, 55%)" />
                  <stop offset="50%" stopColor="hsl(45, 90%, 50%)" />
                  <stop offset="75%" stopColor="hsl(100, 60%, 50%)" />
                  <stop offset="100%" stopColor="hsl(130, 65%, 45%)" />
                </linearGradient>
              </defs>

              {/* Full gradient arc */}
              <path
                d={arcPath(cx, cy, rOuter, rInner, -180, 0)}
                fill="url(#fg-arc-gradient)"
                opacity={0.9}
              />

              {/* Subtle segment lines */}
              {[25, 40, 60, 75].map((pct) => {
                const angle = -180 + (pct / 100) * 180;
                const rad = (angle * Math.PI) / 180;
                return (
                  <line
                    key={pct}
                    x1={cx + rInner * Math.cos(rad)}
                    y1={cy + rInner * Math.sin(rad)}
                    x2={cx + rOuter * Math.cos(rad)}
                    y2={cy + rOuter * Math.sin(rad)}
                    stroke="hsl(var(--background))"
                    strokeWidth="2"
                    opacity={0.6}
                  />
                );
              })}

              {/* Needle */}
              {(() => {
                const rad = (needleAngle * Math.PI) / 180;
                const needleLen = rInner - 8;
                const tipX = cx + needleLen * Math.cos(rad);
                const tipY = cy + needleLen * Math.sin(rad);
                return (
                  <g>
                    <line
                      x1={cx}
                      y1={cy}
                      x2={tipX}
                      y2={tipY}
                      stroke="hsl(var(--foreground))"
                      strokeWidth="3"
                      strokeLinecap="round"
                      opacity={0.85}
                    />
                    {/* Bitcoin-style center dot */}
                    <circle cx={cx} cy={cy} r="12" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="1.5" />
                    <text
                      x={cx}
                      y={cy + 1}
                      textAnchor="middle"
                      dominantBaseline="central"
                      style={{ fontSize: '11px', fontWeight: 700 }}
                      className="fill-foreground"
                    >
                      ₿
                    </text>
                  </g>
                );
              })()}

              {/* Value badge — bottom left like reference */}
              <circle cx={38} cy={cy + 2} r="22" fill={color} opacity={0.9} />
              <text
                x={38}
                y={cy + 3}
                textAnchor="middle"
                dominantBaseline="central"
                style={{ fontSize: '16px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fill: 'white' }}
              >
                {value}
              </text>

              {/* Axis labels */}
              <text x={cx - rOuter - 4} y={cy + 14} textAnchor="end" style={{ fontSize: '9px' }} className="fill-muted-foreground">0</text>
              <text x={cx + rOuter + 4} y={cy + 14} textAnchor="start" style={{ fontSize: '9px' }} className="fill-muted-foreground">100</text>
            </svg>
          </div>

          {/* Right side */}
          <div className="flex-1 w-full space-y-3">
            {/* Delta */}
            {valueDelta != null && valueDelta !== 0 && (
              <div className="flex items-center gap-2">
                <span className={`font-mono text-sm font-semibold ${valueDelta > 0 ? 'text-[hsl(152,60%,40%)]' : 'text-[hsl(0,72%,51%)]'}`}>
                  {valueDelta > 0 ? '+' : ''}{valueDelta} pts
                </span>
                <span className="text-[10px] text-muted-foreground">vs last week</span>
              </div>
            )}

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
                      <linearGradient id="grad-fg-spark" x1="0" y1="0" x2="0" y2="1">
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
                      fill="url(#grad-fg-spark)"
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
