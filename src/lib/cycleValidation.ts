// Historical Bitcoin cycle validation engine.
// Identifies every recorded cycle ATH / ATL from the dashboard_snapshots dataset,
// captures the full metric fingerprint at that pivot, then scores today's market
// against each prior pivot to find the closest historical analogue.

import { supabase } from '@/integrations/supabase/client';

export type PivotKind = 'ATH' | 'ATL';

export interface CycleWindow {
  label: string;        // e.g. "Cycle 2 ATH"
  kind: PivotKind;
  start: string;        // YYYY-MM-DD search window start
  end: string;          // YYYY-MM-DD search window end
}

// Search windows for known BTC cycle pivots. We let the DB pick the exact extremum
// inside each window so the result always matches actual on-chain data.
export const CYCLE_WINDOWS: CycleWindow[] = [
  { label: 'Cycle 1 ATL', kind: 'ATL', start: '2014-12-07', end: '2015-08-31' },
  { label: 'Cycle 2 ATH', kind: 'ATH', start: '2017-11-01', end: '2018-01-31' },
  { label: 'Cycle 2 ATL', kind: 'ATL', start: '2018-11-01', end: '2019-02-28' },
  { label: 'Cycle 3 ATH', kind: 'ATH', start: '2021-10-15', end: '2021-12-15' },
  { label: 'Cycle 3 ATL', kind: 'ATL', start: '2022-10-01', end: '2023-01-31' },
  { label: 'Cycle 4 ATH', kind: 'ATH', start: '2025-09-01', end: '2025-11-30' },
];

export interface PivotSnapshot {
  label: string;
  kind: PivotKind;
  date: string;
  btc_close_usd: number;
  fear_greed_value: number | null;
  mvrv_value: number | null;
  ma_200w_value: number | null;
  puell_value: number | null;
  lth_sopr_value: number | null;
  cycle_phase: string | null;
  price_to_ma_ratio: number | null;
}

export interface SimilarityResult {
  pivot: PivotSnapshot;
  similarity: number;             // 0-100
  componentScores: Record<string, { current: number | null; pivot: number | null; score: number }>;
}

// Pull the single most extreme row inside each window.
export async function fetchPivotSnapshots(): Promise<PivotSnapshot[]> {
  const results: PivotSnapshot[] = [];
  for (const w of CYCLE_WINDOWS) {
    const { data, error } = await supabase
      .from('dashboard_snapshots')
      .select('date, btc_close_usd, fear_greed_value, mvrv_value, ma_200w_value, puell_value, lth_sopr_value, cycle_phase')
      .gte('date', w.start)
      .lte('date', w.end)
      .not('btc_close_usd', 'is', null)
      .order('btc_close_usd', { ascending: w.kind === 'ATL' })
      .limit(1)
      .maybeSingle();
    if (error || !data) continue;
    const price = Number(data.btc_close_usd);
    const ma = data.ma_200w_value != null ? Number(data.ma_200w_value) : null;
    results.push({
      label: w.label,
      kind: w.kind,
      date: data.date,
      btc_close_usd: price,
      fear_greed_value: data.fear_greed_value,
      mvrv_value: data.mvrv_value != null ? Number(data.mvrv_value) : null,
      ma_200w_value: ma,
      puell_value: data.puell_value != null ? Number(data.puell_value) : null,
      lth_sopr_value: data.lth_sopr_value != null ? Number(data.lth_sopr_value) : null,
      cycle_phase: data.cycle_phase,
      price_to_ma_ratio: ma && ma > 0 ? price / ma : null,
    });
  }
  return results;
}

// Build a "today" pivot-like snapshot from the latest dashboard row.
export function buildCurrentPivot(latest: {
  date: string;
  btc_close_usd: number | null;
  fear_greed_value: number | null;
  mvrv_value: number | null;
  ma_200w_value: number | null;
  puell_value?: number | null;
  lth_sopr_value?: number | null;
  cycle_phase: string | null;
}): PivotSnapshot | null {
  if (latest.btc_close_usd == null) return null;
  const price = Number(latest.btc_close_usd);
  const ma = latest.ma_200w_value != null ? Number(latest.ma_200w_value) : null;
  return {
    label: 'Today',
    kind: 'ATH',
    date: latest.date,
    btc_close_usd: price,
    fear_greed_value: latest.fear_greed_value,
    mvrv_value: latest.mvrv_value != null ? Number(latest.mvrv_value) : null,
    ma_200w_value: ma,
    puell_value: latest.puell_value != null ? Number(latest.puell_value) : null,
    lth_sopr_value: latest.lth_sopr_value != null ? Number(latest.lth_sopr_value) : null,
    cycle_phase: latest.cycle_phase,
    price_to_ma_ratio: ma && ma > 0 ? price / ma : null,
  };
}

// Convert |Δrelative| into 0-100 similarity (0 diff → 100, ≥100% diff → 0).
function ratioScore(a: number | null, b: number | null): number | null {
  if (a == null || b == null || a <= 0 || b <= 0) return null;
  const diff = Math.abs(a - b) / Math.max(a, b);
  return Math.max(0, Math.round((1 - diff) * 100));
}

// Linear distance similarity for bounded scales (e.g. Fear & Greed 0-100).
function boundedScore(a: number | null, b: number | null, range = 100): number | null {
  if (a == null || b == null) return null;
  const diff = Math.abs(a - b) / range;
  return Math.max(0, Math.round((1 - diff) * 100));
}

export function computeSimilarity(current: PivotSnapshot, pivot: PivotSnapshot): SimilarityResult {
  const components: SimilarityResult['componentScores'] = {};

  const push = (key: string, c: number | null, p: number | null, score: number | null) => {
    if (score == null) return;
    components[key] = { current: c, pivot: p, score };
  };

  push('Price / 200W MA', current.price_to_ma_ratio, pivot.price_to_ma_ratio,
    ratioScore(current.price_to_ma_ratio, pivot.price_to_ma_ratio));
  push('MVRV', current.mvrv_value, pivot.mvrv_value,
    ratioScore(current.mvrv_value, pivot.mvrv_value));
  push('Fear & Greed', current.fear_greed_value, pivot.fear_greed_value,
    boundedScore(current.fear_greed_value, pivot.fear_greed_value, 100));
  push('Puell Multiple', current.puell_value, pivot.puell_value,
    ratioScore(current.puell_value, pivot.puell_value));
  push('LTH-SOPR', current.lth_sopr_value, pivot.lth_sopr_value,
    ratioScore(current.lth_sopr_value, pivot.lth_sopr_value));

  // Phase match bonus (boolean → 100 / 0).
  if (current.cycle_phase && pivot.cycle_phase) {
    components['Market Phase'] = {
      current: null, pivot: null,
      score: current.cycle_phase === pivot.cycle_phase ? 100 : 0,
    };
  }

  const scores = Object.values(components).map((c) => c.score);
  const similarity = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  return { pivot, similarity, componentScores: components };
}
