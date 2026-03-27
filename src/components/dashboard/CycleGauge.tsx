import { useMemo } from 'react';
import { Shield } from 'lucide-react';

interface CycleGaugeProps {
  score: number;
  maxScore: number;
  phase: string;
  strategy: string;
  action: string;
  signalStrength: { level: string; color: string };
  scoreDelta?: number | null;
}

const PHASES = [
  { label: 'Deep Value', color: 'hsl(220, 70%, 45%)', range: [0, 4] },
  { label: 'Accumulation', color: 'hsl(152, 60%, 40%)', range: [5, 7] },
  { label: 'Bull Market', color: 'hsl(45, 90%, 50%)', range: [8, 10] },
  { label: 'Overheated', color: 'hsl(28, 90%, 55%)', range: [11, 13] },
  { label: 'Cycle Top Risk', color: 'hsl(0, 72%, 51%)', range: [14, 20] },
];

export function CycleGauge({ score, maxScore, phase, strategy, action, signalStrength, scoreDelta }: CycleGaugeProps) {
  const needleAngle = useMemo(() => {
    const pct = Math.min(score / maxScore, 1);
    return -90 + pct * 180;
  }, [score, maxScore]);

  const activePhase = PHASES.find((p) => p.label === phase) ?? PHASES[2];
  const safeSignalStrength = signalStrength ?? { level: 'Low', color: 'hsl(215, 15%, 55%)' };

  return (
    <div className="flex flex-col items-center gap-4 sm:gap-6">
      {/* Gauge SVG — large hero */}
      <div className="relative w-full max-w-lg aspect-[2/1]">
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
                strokeWidth="20"
                strokeLinecap="butt"
                opacity={p.label === phase ? 1 : 0.25}
              />
            );
          })}
          {/* Score text inside gauge */}
          <text x="100" y="78" textAnchor="middle" className="fill-foreground" style={{ fontSize: '22px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
            {score}
          </text>
          <text x="100" y="92" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: '10px', fontFamily: "'Inter', sans-serif" }}>
            / {maxScore}
          </text>
          {/* Needle */}
          <g transform={`rotate(${needleAngle}, 100, 100)`}>
            <line
              x1="100"
              y1="100"
              x2="100"
              y2="24"
              stroke="hsl(var(--foreground))"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="100" cy="100" r="5" fill="hsl(var(--primary))" />
          </g>
        </svg>
      </div>

      {/* Phase & Action */}
      <div className="text-center space-y-3 w-full max-w-md">
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <div
            className="inline-block rounded-full px-4 py-1.5 text-sm font-semibold"
            style={{ backgroundColor: activePhase.color + '22', color: activePhase.color }}
          >
            {phase}
          </div>
          {scoreDelta != null && scoreDelta !== 0 && (
            <span className={`font-mono text-sm font-semibold ${scoreDelta > 0 ? 'text-[hsl(0,72%,51%)]' : 'text-[hsl(152,60%,40%)]'}`}>
              {scoreDelta > 0 ? '↑' : '↓'}{Math.abs(scoreDelta)} from last
            </span>
          )}
        </div>

        {/* Action */}
        <p className="text-base sm:text-lg font-semibold text-foreground">{action}</p>
        <p className="text-sm text-muted-foreground">{strategy}</p>

        {/* Signal Strength */}
        <div className="flex items-center justify-center gap-1.5">
          <Shield className="h-3.5 w-3.5" style={{ color: safeSignalStrength.color }} />
          <span className="text-xs font-medium" style={{ color: safeSignalStrength.color }}>
            Signal Strength: {safeSignalStrength.level}
          </span>
        </div>
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
