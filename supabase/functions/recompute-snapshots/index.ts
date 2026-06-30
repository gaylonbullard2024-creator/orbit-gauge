// Backfill / rebuild dashboard_snapshots with corrected logic:
//  - true 200-week moving average from weekly closes (no interpolation)
//  - real MVRV from Coin Metrics community API
//  - Puell Multiple + SOPR from Coin Metrics
//  - historical Fear & Greed from alternative.me
//  - historical DXY carried forward from FRED rows already in macro_series_daily
//  - rescore + recompute phase using current scoring rules

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------- Market Phase Engine v2 (weighted 4-signal) ----------
// Kept in-sync with src/lib/scoring.ts. Real data only.
const WEIGHTS = { mvrv: 0.30, trend: 0.25, ma200w: 0.25, fearGreed: 0.20 } as const;

function scoreFG(v: number | null) {
  if (v == null) return null;
  if (v <= 20) return 0;
  if (v <= 40) return 1;
  if (v <= 55) return 2;
  if (v <= 70) return 3;
  return 4;
}
function scoreMA(price: number, ma: number) {
  if (price <= ma) return 0;
  const mult = price / ma;
  if (mult <= 1.25) return 1;
  if (mult <= 1.75) return 2;
  if (mult <= 2.25) return 3;
  return 4;
}
function scoreTrendStrength(price: number, ma: number, ret90d: number | null) {
  const mult = price / ma;
  let base: number;
  if (mult < 0.85) base = 0;
  else if (mult < 1.0) base = 1;
  else if (mult < 1.5) base = 2;
  else if (mult < 2.0) base = 3;
  else base = 4;
  if (ret90d == null) return base;
  let slope: number;
  if (ret90d <= -0.25) slope = -2;
  else if (ret90d <= -0.10) slope = -1;
  else if (ret90d <= 0.10) slope = 0;
  else if (ret90d <= 0.30) slope = 1;
  else slope = 2;
  return Math.max(0, Math.min(4, base + slope));
}
function scoreMVRV(v: number | null) {
  if (v == null) return null;
  if (v < 1.0) return 0;
  if (v < 1.5) return 1;
  if (v < 2.0) return 2;
  if (v < 2.5) return 3;
  return 4;
}
// Informational only (no longer in core score) — kept for the legacy columns
function scoreRB(band: string) {
  const m: Record<string, number> = { "Fire Sale": 0, "Accumulate": 1, "Growth": 2, "Overheated": 3, "Bubble Risk": 4 };
  return m[band] ?? 2;
}
function scoreMacro(v: number | null) {
  if (v == null) return 2;
  if (v < 95) return 0; if (v < 100) return 1; if (v < 105) return 2; if (v < 110) return 3; return 4;
}
function scorePuell(v: number | null) { if (v == null) return null; if (v < 0.5) return 0; if (v < 1) return 1; if (v < 2) return 2; if (v < 4) return 3; return 4; }
function scoreSOPR(v: number | null)  { if (v == null) return null; if (v < 0.95) return 0; if (v < 1) return 1; if (v < 1.02) return 2; if (v < 1.05) return 3; return 4; }

function rainbowBandFor(price: number, dateMs: number): string {
  const daysSinceGenesis = Math.floor((dateMs - new Date("2009-01-03").getTime()) / 86400000);
  const logPrice = Math.log10(price);
  const logRegression = 5.83 * Math.log10(Math.max(1, daysSinceGenesis)) - 17.01;
  const dev = logPrice - logRegression;
  if (dev < -0.4) return "Fire Sale";
  if (dev < -0.1) return "Accumulate";
  if (dev < 0.2) return "Growth";
  if (dev < 0.5) return "Overheated";
  return "Bubble Risk";
}

function combineWeighted(parts: { mvrv: number|null; trend: number|null; ma200w: number|null; fearGreed: number|null }) {
  let w = 0, sum = 0;
  if (parts.mvrv      != null) { sum += parts.mvrv      * WEIGHTS.mvrv;      w += WEIGHTS.mvrv;      }
  if (parts.trend     != null) { sum += parts.trend     * WEIGHTS.trend;     w += WEIGHTS.trend;     }
  if (parts.ma200w    != null) { sum += parts.ma200w    * WEIGHTS.ma200w;    w += WEIGHTS.ma200w;    }
  if (parts.fearGreed != null) { sum += parts.fearGreed * WEIGHTS.fearGreed; w += WEIGHTS.fearGreed; }
  if (w === 0) return { score: 0, coverage: 0 };
  const normalized = (sum / w) * 5;  // 0..4 → 0..20
  return { score: Math.round(normalized * 10) / 10, coverage: w };
}

function mapPhase(score: number): string {
  if (score < 5) return "Deep Value";
  if (score < 9) return "Accumulation";
  if (score < 13) return "Bull Trend";
  if (score < 16) return "Overheated";
  return "Cycle Top Risk";
}

const STRATEGIES: Record<string, string> = {
  "Deep Value": "Strong accumulation zone. Historically the best time to build positions.",
  "Accumulation": "Gradually accumulate Bitcoin. Add on pullbacks.",
  "Bull Trend": "Hold core BTC allocation and accumulate on pullbacks.",
  "Overheated": "Reduce risk. Consider taking profits.",
  "Cycle Top Risk": "Extreme caution. Consider trimming positions or hedging.",
};

// ---------- Coin Metrics pull (paginated) ----------
// Only metrics free on the community API: CapMVRVCur. Puell + SOPR require paid credentials.
async function fetchCoinMetrics(start: string): Promise<Map<string, { mvrv: number | null; puell: number | null; sopr: number | null }>> {
  const out = new Map<string, { mvrv: number | null; puell: number | null; sopr: number | null }>();
  let url: string | null =
    `https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=CapMVRVCur&start_time=${start}&frequency=1d&page_size=10000`;
  while (url) {
    const res: Response = await fetch(url);
    if (!res.ok) {
      console.warn("Coin Metrics fetch failed:", res.status, await res.text());
      break;
    }
    const j: any = await res.json();
    for (const row of (j.data ?? [])) {
      const d = String(row.time).slice(0, 10);
      out.set(d, {
        mvrv: row.CapMVRVCur != null ? Number(row.CapMVRVCur) : null,
        puell: null,
        sopr: null,
      });
    }
    url = j.next_page_url ?? null;
  }
  console.log("Coin Metrics rows:", out.size);
  return out;
}

// ---------- Fear & Greed historical ----------
async function fetchFearGreed(): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const res = await fetch("https://api.alternative.me/fng/?limit=0");
  if (!res.ok) {
    console.warn("F&G fetch failed:", res.status);
    return out;
  }
  const j = await res.json();
  for (const row of (j.data ?? [])) {
    const d = new Date(Number(row.timestamp) * 1000).toISOString().slice(0, 10);
    out.set(d, Number(row.value));
  }
  console.log("F&G rows:", out.size);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json().catch(() => ({}));
    const startDate: string = body.start_date ?? "2014-01-01";

    // 1. Load full BTC daily history (paged)
    const prices: { date: string; close: number }[] = [];
    let from = 0;
    const pageSize = 1000; // PostgREST server-side max-rows is 1000
    for (;;) {
      const { data, error } = await supabase
        .from("btc_daily_prices")
        .select("date, close_usd")
        .gte("date", startDate)
        .order("date", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const page = (data ?? []).map((r: any) => ({ date: r.date as string, close: Number(r.close_usd) }));
      prices.push(...page);
      if (page.length < pageSize) break;
      from += pageSize;
    }
    console.log("BTC daily rows:", prices.length);
    if (prices.length === 0) throw new Error("No BTC price history found");

    // 2. Build weekly close series (last close per ISO week, Sunday boundary)
    //    Then compute true 200-week MA = mean of last 200 weekly closes per date.
    const weeklyMap = new Map<string, number>(); // weekStart(YYYY-MM-DD Sunday) -> last close in that week
    function weekStart(d: string): string {
      const dt = new Date(d + "T00:00:00Z");
      const day = dt.getUTCDay(); // 0=Sun
      dt.setUTCDate(dt.getUTCDate() - day);
      return dt.toISOString().slice(0, 10);
    }
    for (const p of prices) {
      weeklyMap.set(weekStart(p.date), p.close);
    }
    const weekly = Array.from(weeklyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ws, close]) => ({ ws, close }));
    console.log("Weekly closes:", weekly.length);

    // Index by week start for fast lookup
    const weeklyIndex = new Map<string, number>();
    weekly.forEach((w, i) => weeklyIndex.set(w.ws, i));

    // 3. Pull Coin Metrics + F&G
    const [cm, fg] = await Promise.all([fetchCoinMetrics(startDate), fetchFearGreed()]);

    // 4. Pull DXY history into a date->value map (forward-fill as needed)
    const { data: dxyRows } = await supabase
      .from("macro_series_daily")
      .select("date, value")
      .eq("series_id", "DTWEXBGS")
      .order("date", { ascending: true });
    const dxyMap = new Map<string, number>();
    for (const r of dxyRows ?? []) dxyMap.set(r.date as string, Number(r.value));
    const dxyDates = Array.from(dxyMap.keys()).sort();
    function dxyAt(date: string): number | null {
      // last available on-or-before this date
      let lo = 0, hi = dxyDates.length - 1, best = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (dxyDates[mid] <= date) { best = mid; lo = mid + 1; } else hi = mid - 1;
      }
      return best === -1 ? null : dxyMap.get(dxyDates[best]) ?? null;
    }

    // 5. Iterate each BTC daily row, rebuild snapshot
    let written = 0;
    const batch: any[] = [];
    const flush = async () => {
      if (batch.length === 0) return;
      const { error } = await supabase.from("dashboard_snapshots").upsert(batch, { onConflict: "date" });
      if (error) console.error("upsert error:", error.message);
      else written += batch.length;
      batch.length = 0;
    };

    for (const p of prices) {
      // 200W MA: mean of last 200 weekly closes whose week_start <= this date
      const wIdx = (() => {
        // find last weekStart <= p.date
        const ws = weekStart(p.date);
        let i = weeklyIndex.get(ws);
        if (i == null) {
          // binary search fallback
          let lo = 0, hi = weekly.length - 1, best = -1;
          while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (weekly[mid].ws <= ws) { best = mid; lo = mid + 1; } else hi = mid - 1;
          }
          i = best;
        }
        return i;
      })();
      if (wIdx == null || wIdx < 0) continue;
      const start = Math.max(0, wIdx - 199);
      const slice = weekly.slice(start, wIdx + 1);
      if (slice.length < 50) continue; // not enough history to be meaningful
      const ma200w = slice.reduce((s, w) => s + w.close, 0) / slice.length;

      const cmRow = cm.get(p.date);
      const mvrvValue = cmRow?.mvrv ?? null;
      const puellValue = cmRow?.puell ?? null;
      const soprValue = cmRow?.sopr ?? null;

      const fgValue = fg.get(p.date) ?? null;
      const dxy = dxyAt(p.date);

      const band = rainbowBandFor(p.close, new Date(p.date + "T00:00:00Z").getTime());
      const fgScore = scoreFG(fgValue);
      const maScore = scoreTrend(p.close, ma200w);
      const rbScore = scoreRB(band);
      const macroScore = scoreMacro(dxy);
      const mvrvScore = scoreMVRV(mvrvValue);
      const puellScore = scorePuell(puellValue);
      const soprScore = scoreSOPR(soprValue);

      const hasMvrv = mvrvScore != null;
      const total =
        (fgScore ?? 2) +
        maScore +
        rbScore +
        macroScore +
        (hasMvrv ? (mvrvScore as number) : 0);
      const phase = mapPhase(total, hasMvrv);

      batch.push({
        date: p.date,
        btc_close_usd: p.close,
        fear_greed_value: fgValue,
        fear_greed_score: fgScore,
        mvrv_value: mvrvValue,
        mvrv_score: mvrvScore,
        ma_200w_value: ma200w,
        ma_200w_score: maScore,
        rainbow_band: band,
        rainbow_score: rbScore,
        macro_value: dxy,
        macro_score: macroScore,
        puell_value: puellValue,
        puell_score: puellScore,
        lth_sopr_value: soprValue,
        lth_sopr_score: soprScore,
        cycle_total_score: total,
        cycle_phase: phase,
        strategy_signal: STRATEGIES[phase],
      });
      if (batch.length >= 500) await flush();
    }
    await flush();

    // 6. Validation: print anchor dates
    const anchors = ["2017-12-17", "2018-12-15", "2021-04-14", "2021-11-10", "2022-11-21", "2025-10-07"];
    const { data: anchorRows } = await supabase
      .from("dashboard_snapshots")
      .select("date, btc_close_usd, ma_200w_value, mvrv_value, puell_value, fear_greed_value, cycle_total_score, cycle_phase")
      .in("date", anchors)
      .order("date");

    return new Response(
      JSON.stringify({
        success: true,
        btc_rows: prices.length,
        weekly_closes: weekly.length,
        coin_metrics_rows: cm.size,
        fear_greed_rows: fg.size,
        snapshots_written: written,
        anchors: anchorRows,
      }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("recompute-snapshots error:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
