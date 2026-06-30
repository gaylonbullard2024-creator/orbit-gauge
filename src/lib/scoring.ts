// ============================================================
// Market Phase Engine v2 — weighted 4-signal model
// ------------------------------------------------------------
// Each pillar returns 0..4 ("market temperature" per signal).
// Pillars are combined with explicit weights summing to 1.0.
// Weighted score is rescaled to 0..20 for the gauge.
//
// Pillars in production (real data only — no fakes):
//   1. MVRV ............ 30%  (Coin Metrics CapMVRVCur)
//   2. Trend Strength .. 25%  (price vs 200WMA + 90d slope)
//   3. 200WMA distance . 25%  (price / 200WMA ratio)
//   4. Fear & Greed .... 20%  (alternative.me, 2018-02 →)
//
// Pillars deferred (require paid feed — UI shows "Feed pending"):
//   Puell Multiple, LTH-SOPR, Exchange Inflows/Outflows, Volume
// ============================================================

export const PILLAR_WEIGHTS = {
  mvrv: 0.30,
  trend: 0.25,
  ma200w: 0.25,
  fearGreed: 0.20,
} as const;

// Official alternative.me bands: 0–20 Extreme Fear · 20–40 Fear · 40–60 Neutral · 60–75 Greed · 75–100 Extreme Greed
export function scoreFearGreed(value: number): number {
  if (value < 20) return 0;    // Extreme Fear
  if (value < 40) return 1;    // Fear
  if (value < 60) return 2;    // Neutral
  if (value < 75) return 3;    // Greed
  return 4;                    // Extreme Greed
}

export function fearGreedLabel(value: number | null | undefined): string {
  if (value == null) return '—';
  if (value < 20) return 'Extreme Fear';
  if (value < 40) return 'Fear';
  if (value < 60) return 'Neutral';
  if (value < 75) return 'Greed';
  return 'Extreme Greed';
}

// MVRV thresholds tuned against 2013→2025 cycle history.
// Cycle tops historically print MVRV 2.4-3.7, bottoms < 1.0.
export function scoreMvrv(value: number): number {
  if (value < 1.0) return 0;   // Capitulation
  if (value < 1.5) return 1;   // Deep value
  if (value < 2.0) return 2;   // Fair value
  if (value < 2.5) return 3;   // Elevated
  return 4;                    // Overheated / cycle-top zone
}

export function scorePriceVs200wMa(price: number, ma: number): number {
  if (price <= ma) return 0;
  const mult = price / ma;
  if (mult <= 1.25) return 1;
  if (mult <= 1.75) return 2;
  if (mult <= 2.25) return 3;
  return 4;                    // > 2.25× MA = euphoria
}

// Trend Strength = distance above MA blended with 90-day price slope.
// `return90d` = (price / price_90d_ago) - 1; null if history too short.
export function scoreTrendStrength(
  price: number,
  ma: number,
  return90d: number | null,
): number {
  const maMult = price / ma;
  // Base from MA distance
  let base: number;
  if (maMult < 0.85) base = 0;
  else if (maMult < 1.0) base = 1;
  else if (maMult < 1.5) base = 2;
  else if (maMult < 2.0) base = 3;
  else base = 4;

  if (return90d == null) return base;

  // Adjust by 90d slope
  let slope: number;
  if (return90d <= -0.25) slope = -2;
  else if (return90d <= -0.10) slope = -1;
  else if (return90d <= 0.10) slope = 0;
  else if (return90d <= 0.30) slope = 1;
  else slope = 2;

  return Math.max(0, Math.min(4, base + slope));
}

// Kept for backward compatibility (no longer in core score).
export function scoreRainbow(band: string): number {
  const map: Record<string, number> = {
    'Fire Sale': 0, 'Accumulate': 1, 'Growth': 2, 'Overheated': 3, 'Bubble Risk': 4,
  };
  return map[band] ?? 2;
}
export function scoreMacro(value: number): number {
  if (value < 95) return 0;
  if (value < 100) return 1;
  if (value < 105) return 2;
  if (value < 110) return 3;
  return 4;
}

/** Combine the 4 pillar scores (0..4 each) into the 0..20 cycle score. */
export function computeWeightedCycleScore(parts: {
  mvrv: number | null;
  trend: number | null;
  ma200w: number | null;
  fearGreed: number | null;
}): { score: number; coverage: number } {
  const entries: Array<[keyof typeof PILLAR_WEIGHTS, number | null]> = [
    ['mvrv', parts.mvrv],
    ['trend', parts.trend],
    ['ma200w', parts.ma200w],
    ['fearGreed', parts.fearGreed],
  ];
  let weighted = 0;
  let usedWeight = 0;
  for (const [k, v] of entries) {
    if (v == null) continue;
    weighted += v * PILLAR_WEIGHTS[k];
    usedWeight += PILLAR_WEIGHTS[k];
  }
  if (usedWeight === 0) return { score: 0, coverage: 0 };
  // Renormalize to full-weight basis, then scale 0..4 → 0..20
  const normalized = (weighted / usedWeight) * 5;
  return { score: Math.round(normalized * 10) / 10, coverage: usedWeight };
}

/** Map 0..20 score to a phase label. Thresholds tuned to historical anchors. */
export function mapScoreToPhase(score: number, _hasMvrv = true): string {
  if (score < 5) return 'Deep Value';
  if (score < 9) return 'Accumulation';
  if (score < 13) return 'Bull Trend';
  if (score < 16) return 'Overheated';
  return 'Cycle Top Risk';
}



export function mapPhaseToStrategy(phase: string): string {
  const strategies: Record<string, string> = {
    'Deep Value': 'Strong accumulation zone. Historically the best time to build positions.',
    'Accumulation': 'Gradually accumulate Bitcoin. Add on pullbacks during fear-driven volatility.',
    'Bull Market': 'Hold core BTC allocation and accumulate on pullbacks.',
    'Overheated': 'Reduce risk. Consider taking profits on leveraged positions.',
    'Cycle Top Risk': 'Extreme caution. Consider trimming positions or hedging.',
  };
  return strategies[phase] ?? 'Hold and monitor.';
}

export function mapPhaseToAction(phase: string): string {
  const actions: Record<string, string> = {
    'Deep Value': 'Strong Buy — Maximum Accumulation',
    'Accumulation': 'Buy — Accumulate on Dips',
    'Bull Market': 'Hold — Maintain Exposure',
    'Overheated': 'Reduce — Take Partial Profits',
    'Cycle Top Risk': 'Exit — Hedge Positions',
  };
  return actions[phase] ?? 'Hold & Monitor';
}

export function getPhaseColor(phase: string): string {
  const colors: Record<string, string> = {
    'Deep Value': 'hsl(220, 70%, 45%)',
    'Accumulation': 'hsl(152, 60%, 40%)',
    'Bull Market': 'hsl(45, 90%, 50%)',
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
  return fearGreedLabel(value);
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
  'Power Law': 'Z-score of BTC price vs Burger/PlanB power-law fair value (log-log regression)',
};
