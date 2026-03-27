import { useMemo } from 'react';

interface CycleGaugeProps {
  score: number;
  maxScore: number;
  phase: string;
  strategy: string;
}

const PHASES = [
  { label: 'Deep Value', color: 'hsl(220, 70%, 45%)', range: [0, 4] },
  { label: 'Accumulation', color: 'hsl(152, 60%, 40%)', range: [5, 8] },
  { label: 'Bull Trend', color: 'hsl(45, 90%, 50%)', range: [9, 12] },
  { label: 'Overheated', color: 'hsl(28, 90%, 55%)', range: [13, 16] },
  { label: 'Cycle Top Risk', color: 'hsl(0, 72%, 51%)', range: [17, 20] },
];

export function CycleGauge({ score, maxScore, phase, strategy }: CycleGaugeProps) {
  const needleAngle = useMemo(() => {
    const pct = Math.min(score / maxScore, 1);
    return -90 + pct * 180;
  }, [score, maxScore]);

  const activePhase = PHASES.find((p) => p.label === phase) ?? PHASES[2];

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Gauge SVG */}
      <div className="relative w-full max-w-md aspect-[2/1]">
        <svg viewBox="0 0 200 110" className="w-full h-full">
          {/* Background arcs */}
          {PHASES.map((p, i) => {
            const startAngle = -90 + (i * 180) / 5;
            const endAngle = -90 + ((i + 1) * 180) / 5;
            const startRad = (startAngle * Math.PI) / 180;
            const endRad = (endAngle * Math.PI) / 180;
            const r = 80;
            const cx = 100;
            const cy = 100;
            const x1 = cx + r * Math.cos(startRad);
            const y1 = cy + r * Math.sin(startRad);
            const x2 = cx + r * Math.cos(endRad);
            const y2 = cy + r * Math.sin(endRad);
            return (
              <path
                key={p.label}
                d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
                fill="none"
                stroke={p.color}
                strokeWidth="16"
                strokeLinecap="butt"
                opacity={p.label === phase ? 1 : 0.3}
              />
            );
          })}
          {/* Needle */}
          <g transform={`rotate(${needleAngle}, 100, 100)`}>
            <line
              x1="100"
              y1="100"
              x2="100"
              y2="28"
              stroke="hsl(var(--foreground))"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="100" cy="100" r="5" fill="hsl(var(--primary))" />
          </g>
        </svg>
      </div>

      {/* Score & Phase */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-3">
          <span className="font-mono text-3xl sm:text-4xl font-bold" style={{ color: activePhase.color }}>
            {score}
          </span>
          <span className="text-muted-foreground text-lg">/ {maxScore}</span>
        </div>
        <div
          className="inline-block rounded-full px-4 py-1.5 text-sm font-semibold"
          style={{ backgroundColor: activePhase.color + '22', color: activePhase.color }}
        >
          {phase}
        </div>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">{strategy}</p>
      </div>

      {/* Phase legend */}
      <div className="flex flex-wrap justify-center gap-3">
        {PHASES.map((p) => (
          <div key={p.label} className="flex items-center gap-1.5 text-xs">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: p.color, opacity: p.label === phase ? 1 : 0.4 }}
            />
            <span className={p.label === phase ? 'text-foreground font-medium' : 'text-muted-foreground'}>
              {p.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
