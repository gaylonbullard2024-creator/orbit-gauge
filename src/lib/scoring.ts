// ============================================================
// Market Phase Engine v3 — institutional 6-pillar weighted model
// ------------------------------------------------------------
// Each pillar returns 0..4 ("market temperature" per signal).
// Pillars are combined with explicit weights summing to 1.0.
// Weighted score is rescaled to 0..20 for the gauge.
//
// Pillars (all real Coin Metrics / alternative.me data):
//   1. MVRV ............ 20%  (CapMVRVCur)
//   2. NUPL ............ 20%  ((Mcap - RealizedCap) / Mcap)
//   3. Puell Multiple .. 15%  (IssTotUSD / 365d MA(IssTotUSD))
//   4. Reserve Risk .... 10%  (Price / (MVRV × RealizedPrice) proxy)
//   5. BTC vs 200WMA ... 20%  (price / 200WMA ratio)
//   6. Fear & Greed .... 15%  (alternative.me, 2018-02 →)
//
// Pillars deferred — require paid feed (Glassnode/CryptoQuant):
//   LTH-SOPR, Exchange Inflows/Outflows, Whale Accumulation/Distribution
// ============================================================

export const PILLAR_WEIGHTS = {
  mvrv: 0.20,
  nupl: 0.20,
  puell: 0.15,
  reserveRisk: 0.10,
  ma200w: 0.20,
  fearGreed: 0.15,
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
export function scoreMvrv(value: number): number {
  if (value < 1.0) return 0;   // Capitulation
  if (value < 1.5) return 1;   // Deep value
  if (value < 2.0) return 2;   // Fair value
  if (value < 2.5) return 3;   // Elevated
  return 4;                    // Overheated / cycle-top zone
}

// NUPL = (MarketCap - RealizedCap) / MarketCap. Standard bands.
//   < 0      Capitulation (bullish)
//   0-0.25   Hope / Fear
//   0.25-0.5 Optimism / Anxiety
//   0.5-0.75 Belief / Denial
//   > 0.75   Euphoria / Greed (bearish)
export function scoreNupl(value: number): number {
  if (value < 0)     return 0;
  if (value < 0.25)  return 1;
  if (value < 0.50)  return 2;
  if (value < 0.75)  return 3;
  return 4;
}

// Puell Multiple = daily issuance USD / 365d MA of daily issuance USD.
//   < 0.5  Miner capitulation — historically the bottom (bullish)
//   < 1.0  Below average
//   < 2.0  Average
//   < 4.0  Elevated
//   >= 4.0 Miner over-distribution — historically the top (bearish)
export function scorePuell(value: number): number {
  if (value < 0.5) return 0;
  if (value < 1.0) return 1;
  if (value < 2.0) return 2;
  if (value < 4.0) return 3;
  return 4;
}

// Reserve Risk proxy = price / (MVRV × realized_price).
// True Reserve Risk uses HODL coin-day-bank; the proxy approximates risk/reward.
//   < 0.002  Very attractive (bullish)
//   < 0.005  Attractive
//   < 0.010  Fair
//   < 0.020  Elevated
//   >= 0.020 Unattractive (bearish)
export function scoreReserveRisk(value: number): number {
  if (value < 0.002) return 0;
  if (value < 0.005) return 1;
  if (value < 0.010) return 2;
  if (value < 0.020) return 3;
  return 4;
}

export function scorePriceVs200wMa(price: number, ma: number): number {
  if (price <= ma) return 0;
  const mult = price / ma;
  if (mult <= 1.25) return 1;
  if (mult <= 1.75) return 2;
  if (mult <= 2.25) return 3;
  return 4;
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

/** Combine the 6 pillar scores (0..4 each) into the 0..20 cycle score. */
export function computeWeightedCycleScore(parts: {
  mvrv: number | null;
  nupl: number | null;
  puell: number | null;
  reserveRisk: number | null;
  ma200w: number | null;
  fearGreed: number | null;
}): { score: number; coverage: number } {
  const entries: Array<[keyof typeof PILLAR_WEIGHTS, number | null]> = [
    ['mvrv', parts.mvrv],
    ['nupl', parts.nupl],
    ['puell', parts.puell],
    ['reserveRisk', parts.reserveRisk],
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
  const normalized = (weighted / usedWeight) * 5; // 0..4 → 0..20
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
    'Bull Trend': 'Hold core BTC allocation and accumulate on pullbacks.',
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
    'Bull Trend': 'Hold — Maintain Exposure',
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
    'Bull Trend': 'hsl(45, 90%, 50%)',
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

export function calculateSignalStrength(scores: (number | null)[]): {
  level: 'High' | 'Medium' | 'Low';
  color: string;
} {
  const valid = scores.filter((s): s is number => s != null);
  if (valid.length < 3) return { level: 'Low', color: 'hsl(215, 15%, 55%)' };
  const bullish = valid.filter((s) => s <= 1).length;
  const bearish = valid.filter((s) => s >= 3).length;
  const dominant = Math.max(bullish, bearish);
  if (dominant >= 4) return { level: 'High', color: 'hsl(152, 60%, 40%)' };
  if (dominant >= 3) return { level: 'Medium', color: 'hsl(45, 90%, 50%)' };
  return { level: 'Low', color: 'hsl(215, 15%, 55%)' };
}

export function generateChangeDescriptions(
  current: {
    fear_greed_value: number | null; fear_greed_score: number | null;
    mvrv_score: number | null; ma_200w_score: number | null;
    rainbow_band: string | null; macro_score: number | null;
    cycle_phase: string | null; cycle_total_score: number | null;
    btc_close_usd: number | null;
  },
  previous: {
    fear_greed_value: number | null; fear_greed_score: number | null;
    mvrv_score: number | null; ma_200w_score: number | null;
    rainbow_band: string | null; macro_score: number | null;
    cycle_phase: string | null; cycle_total_score: number | null;
    btc_close_usd: number | null;
  }
): string[] {
  const changes: string[] = [];
  if (current.cycle_phase && previous.cycle_phase && current.cycle_phase !== previous.cycle_phase) {
    changes.push(`Market phase shifted from ${previous.cycle_phase} to ${current.cycle_phase}`);
  }
  if (current.fear_greed_value != null && previous.fear_greed_value != null) {
    const curClass = fearGreedLabel(current.fear_greed_value);
    const prevClass = fearGreedLabel(previous.fear_greed_value);
    if (curClass !== prevClass) {
      changes.push(`Sentiment moved from ${prevClass} to ${curClass}`);
    } else {
      const delta = current.fear_greed_value - previous.fear_greed_value;
      if (Math.abs(delta) >= 5) {
        changes.push(`Sentiment ${delta > 0 ? 'improved' : 'declined'} by ${Math.abs(delta)} points`);
      }
    }
  }
  if (current.cycle_total_score != null && previous.cycle_total_score != null) {
    const delta = current.cycle_total_score - previous.cycle_total_score;
    if (delta !== 0) {
      changes.push(`Cycle score ${delta > 0 ? 'increased' : 'decreased'} by ${Math.abs(delta)} (${previous.cycle_total_score} → ${current.cycle_total_score})`);
    }
  }
  if (current.btc_close_usd != null && previous.btc_close_usd != null) {
    const pctChange = ((current.btc_close_usd - previous.btc_close_usd) / previous.btc_close_usd) * 100;
    if (Math.abs(pctChange) >= 2) {
      changes.push(`BTC price ${pctChange > 0 ? 'up' : 'down'} ${Math.abs(pctChange).toFixed(1)}% ($${Number(current.btc_close_usd).toLocaleString(undefined, { maximumFractionDigits: 0 })})`);
    }
  }
  if (current.rainbow_band && previous.rainbow_band && current.rainbow_band !== previous.rainbow_band) {
    changes.push(`Rainbow model shifted from "${previous.rainbow_band}" to "${current.rainbow_band}"`);
  }
  return changes.length > 0 ? changes : ['No significant changes from last snapshot'];
}

export const INDICATOR_TOOLTIPS: Record<string, string> = {
  'Fear & Greed': 'Measures market sentiment from 0 (extreme fear) to 100 (extreme greed)',
  'MVRV Ratio': 'Market value vs realized value — detects over/undervaluation',
  '200W Moving Avg': 'Long-term trend support level based on 200-week moving average',
  'Rainbow Model': 'Logarithmic price band model for cycle positioning',
  'Macro / DXY': 'US Dollar strength index — lower DXY is generally better for BTC',
  'Power Law': 'Z-score of BTC price vs Burger/PlanB power-law fair value (log-log regression)',
  'NUPL': 'Net Unrealized Profit/Loss — aggregate paper P&L of all holders',
  'Puell Multiple': 'Daily miner revenue vs 365-day average — flags miner capitulation/euphoria',
  'Reserve Risk': 'Long-term holder conviction vs price — proxy version using MVRV × realized price',
  'Realized Price': 'Average on-chain cost basis across the entire BTC supply',
};
