export function scoreFearGreed(value: number): number {
  if (value <= 25) return 0;
  if (value <= 40) return 1;
  if (value <= 60) return 2;
  if (value <= 75) return 3;
  return 4;
}

export function scoreMvrv(value: number): number {
  if (value < 0) return 0;
  if (value <= 2) return 1;
  if (value <= 6) return 2;
  if (value <= 7) return 3;
  return 4;
}

export function scorePriceVs200wMa(price: number, ma: number): number {
  if (price <= ma) return 0;
  const pct = (price / ma) - 1;
  if (pct <= 0.25) return 1;
  if (pct <= 0.75) return 2;
  if (pct <= 1.5) return 3;
  return 4;
}

export function scoreRainbow(band: string): number {
  const map: Record<string, number> = {
    'Fire Sale': 0,
    'Accumulate': 1,
    'Growth': 2,
    'Overheated': 3,
    'Bubble Risk': 4,
  };
  return map[band] ?? 2;
}

export function scoreMacro(value: number, previousValue?: number): number {
  // Simple: lower DXY = more BTC-supportive
  if (value < 95) return 0;
  if (value < 100) return 1;
  if (value < 105) return 2;
  if (value < 110) return 3;
  return 4;
}

export function mapScoreToPhase(score: number, hasMvrv: boolean): string {
  const max = hasMvrv ? 20 : 16;
  const normalized = (score / max) * 20;
  if (normalized <= 5) return 'Deep Value';
  if (normalized <= 9) return 'Accumulation';
  if (normalized <= 13) return 'Bull Trend';
  if (normalized <= 17) return 'Overheated';
  return 'Cycle Top Risk';
}

export function mapPhaseToStrategy(phase: string): string {
  const strategies: Record<string, string> = {
    'Deep Value': 'Strong accumulation zone. Historically the best time to build positions.',
    'Accumulation': 'Gradually accumulate Bitcoin. Add on pullbacks during fear-driven volatility.',
    'Bull Trend': 'Hold core BTC allocation and accumulate on pullbacks.',
    'Overheated': 'Reduce risk. Consider taking profits on leveraged positions.',
    'Cycle Top Risk': 'Extreme caution. Consider trimming positions or hedging.',
  };
  return strategies[phase] ?? 'Hold and monitor.';
}

export function getPhaseColor(phase: string): string {
  const colors: Record<string, string> = {
    'Deep Value': 'hsl(220, 70%, 45%)',
    'Accumulation': 'hsl(152, 60%, 40%)',
    'Bull Trend': 'hsl(45, 90%, 50%)',
    'Overheated': 'hsl(28, 90%, 55%)',
    'Cycle Top Risk': 'hsl(0, 72%, 51%)',
  };
  return colors[phase] ?? 'hsl(45, 90%, 50%)';
}

export function getStatusLabel(score: number): string {
  if (score <= 1) return 'Bullish Signal';
  if (score <= 2) return 'Neutral';
  if (score <= 3) return 'Caution';
  return 'Bearish Signal';
}

export function getStatusColor(score: number): string {
  if (score <= 1) return 'hsl(152, 60%, 40%)';
  if (score <= 2) return 'hsl(45, 90%, 50%)';
  if (score <= 3) return 'hsl(28, 90%, 55%)';
  return 'hsl(0, 72%, 51%)';
}
