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

export function mapPhaseToAction(phase: string): string {
  const actions: Record<string, string> = {
    'Deep Value': 'Strong Buy — Maximum Accumulation',
    'Accumulation': 'Buy — Accumulate on Dips',
    'Bull Trend': 'Hold — Accumulate on Pullbacks',
    'Overheated': 'Reduce — Take Partial Profits',
    'Cycle Top Risk': 'Sell — Trim Positions & Hedge',
  };
  return actions[phase] ?? 'Hold & Monitor';
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

/** Calculate signal strength based on indicator agreement */
export function calculateSignalStrength(scores: (number | null)[]): {
  level: 'High' | 'Medium' | 'Low';
  color: string;
} {
  const valid = scores.filter((s): s is number => s != null);
  if (valid.length < 3) return { level: 'Low', color: 'hsl(215, 15%, 55%)' };

  // Classify each score: 0-1 = bullish, 2 = neutral, 3-4 = bearish
  const bullish = valid.filter((s) => s <= 1).length;
  const bearish = valid.filter((s) => s >= 3).length;
  const dominant = Math.max(bullish, bearish);

  if (dominant >= 4) return { level: 'High', color: 'hsl(152, 60%, 40%)' };
  if (dominant >= 3) return { level: 'Medium', color: 'hsl(45, 90%, 50%)' };
  return { level: 'Low', color: 'hsl(215, 15%, 55%)' };
}

/** Generate auto-change descriptions from two snapshots */
export function generateChangeDescriptions(
  current: {
    fear_greed_value: number | null;
    fear_greed_score: number | null;
    mvrv_score: number | null;
    ma_200w_score: number | null;
    rainbow_band: string | null;
    macro_score: number | null;
    cycle_phase: string | null;
    cycle_total_score: number | null;
    btc_close_usd: number | null;
  },
  previous: {
    fear_greed_value: number | null;
    fear_greed_score: number | null;
    mvrv_score: number | null;
    ma_200w_score: number | null;
    rainbow_band: string | null;
    macro_score: number | null;
    cycle_phase: string | null;
    cycle_total_score: number | null;
    btc_close_usd: number | null;
  }
): string[] {
  const changes: string[] = [];

  // Phase change
  if (current.cycle_phase && previous.cycle_phase && current.cycle_phase !== previous.cycle_phase) {
    changes.push(`Market phase shifted from ${previous.cycle_phase} to ${current.cycle_phase}`);
  }

  // Fear & Greed classification change
  if (current.fear_greed_value != null && previous.fear_greed_value != null) {
    const curClass = getFgClass(current.fear_greed_value);
    const prevClass = getFgClass(previous.fear_greed_value);
    if (curClass !== prevClass) {
      changes.push(`Sentiment moved from ${prevClass} to ${curClass}`);
    } else {
      const delta = current.fear_greed_value - previous.fear_greed_value;
      if (Math.abs(delta) >= 5) {
        changes.push(`Sentiment ${delta > 0 ? 'improved' : 'declined'} by ${Math.abs(delta)} points`);
      }
    }
  }

  // Score change
  if (current.cycle_total_score != null && previous.cycle_total_score != null) {
    const delta = current.cycle_total_score - previous.cycle_total_score;
    if (delta !== 0) {
      changes.push(`Cycle score ${delta > 0 ? 'increased' : 'decreased'} by ${Math.abs(delta)} (${previous.cycle_total_score} → ${current.cycle_total_score})`);
    }
  }

  // BTC price move
  if (current.btc_close_usd != null && previous.btc_close_usd != null) {
    const pctChange = ((current.btc_close_usd - previous.btc_close_usd) / previous.btc_close_usd) * 100;
    if (Math.abs(pctChange) >= 2) {
      changes.push(`BTC price ${pctChange > 0 ? 'up' : 'down'} ${Math.abs(pctChange).toFixed(1)}% ($${Number(current.btc_close_usd).toLocaleString(undefined, { maximumFractionDigits: 0 })})`);
    }
  }

  // Rainbow band change
  if (current.rainbow_band && previous.rainbow_band && current.rainbow_band !== previous.rainbow_band) {
    changes.push(`Rainbow model shifted from "${previous.rainbow_band}" to "${current.rainbow_band}"`);
  }

  // Macro regime change
  if (current.macro_score != null && previous.macro_score != null) {
    const curRegime = getMacroRegime(current.macro_score);
    const prevRegime = getMacroRegime(previous.macro_score);
    if (curRegime !== prevRegime) {
      changes.push(`Macro environment changed from ${prevRegime} to ${curRegime}`);
    }
  }

  return changes.length > 0 ? changes : ['No significant changes from last snapshot'];
}

function getFgClass(value: number): string {
  if (value <= 25) return 'Extreme Fear';
  if (value <= 40) return 'Fear';
  if (value <= 60) return 'Neutral';
  if (value <= 75) return 'Greed';
  return 'Extreme Greed';
}

function getMacroRegime(score: number): string {
  if (score <= 1) return 'Supportive';
  if (score <= 2) return 'Neutral';
  return 'Restrictive';
}

export const INDICATOR_TOOLTIPS: Record<string, string> = {
  'Fear & Greed': 'Measures market sentiment from 0 (extreme fear) to 100 (extreme greed)',
  'MVRV Ratio': 'Market value vs realized value — detects over/undervaluation',
  '200W Moving Avg': 'Long-term trend support level based on 200-week moving average',
  'Rainbow Model': 'Logarithmic price band model for cycle positioning',
  'Macro / DXY': 'US Dollar strength index — lower DXY is generally better for BTC',
};
