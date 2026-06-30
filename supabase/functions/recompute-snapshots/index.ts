// Backfill / rebuild dashboard_snapshots with the v3 institutional engine.
//
// Coin Metrics community-API series pulled:
//   CapMVRVCur   → MVRV
//   CapRealUSD   → Realized Cap (USD)
//   CapMrktCurUSD→ Market Cap (USD)
//   SplyCur      → Circulating supply
//   IssTotUSD    → Daily issuance USD (for Puell)
//
// Derived metrics:
//   realized_price = CapRealUSD / SplyCur
//   nupl           = (CapMrktCurUSD - CapRealUSD) / CapMrktCurUSD
//   puell          = IssTotUSD / 365d MA(IssTotUSD)
//   reserve_risk   = price / (MVRV × realized_price)   (proxy)
//
// Awaiting paid feed (Glassnode/CryptoQuant): LTH-SOPR, Exchange Inflows/Outflows,
// Whale Accumulation/Distribution — left null.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------- v3 Phase Engine ----------
const WEIGHTS = {
  mvrv: 0.20, nupl: 0.20, puell: 0.15,
  reserveRisk: 0.10, ma200w: 0.20, fearGreed: 0.15,
} as const;

function scoreFG(v: number | null) {
  if (v == null) return null;
  if (v < 20) return 0;
  if (v < 40) return 1;
  if (v < 60) return 2;
  if (v < 75) return 3;
  return 4;
}
function scoreMA(price: number, ma: number) {
  if (price <= ma) return 0;
  const m = price / ma;
  if (m <= 1.25) return 1;
  if (m <= 1.75) return 2;
  if (m <= 2.25) return 3;
  return 4;
}
function scoreMVRV(v: number | null) {
  if (v == null) return null;
  if (v < 1.0) return 0;
  if (v < 1.5) return 1;
  if (v < 2.0) return 2;
  if (v < 2.5) return 3;
  return 4;
}
function scoreNUPL(v: number | null) {
  if (v == null) return null;
  if (v < 0) return 0;
  if (v < 0.25) return 1;
  if (v < 0.50) return 2;
  if (v < 0.75) return 3;
  return 4;
}
function scorePuell(v: number | null) {
  if (v == null) return null;
  if (v < 0.5) return 0;
  if (v < 1.0) return 1;
  if (v < 2.0) return 2;
  if (v < 4.0) return 3;
  return 4;
}
function scoreReserveRisk(v: number | null) {
  if (v == null) return null;
  if (v < 0.002) return 0;
  if (v < 0.005) return 1;
  if (v < 0.010) return 2;
  if (v < 0.020) return 3;
  return 4;
}
function scoreSOPR(v: number | null) {
  if (v == null) return null;
  if (v < 0.95) return 0;
  if (v < 1) return 1;
  if (v < 1.02) return 2;
  if (v < 1.05) return 3;
  return 4;
}
function scoreRB(band: string) {
  const m: Record<string, number> = { "Fire Sale": 0, "Accumulate": 1, "Growth": 2, "Overheated": 3, "Bubble Risk": 4 };
  return m[band] ?? 2;
}
function scoreMacro(v: number | null) {
  if (v == null) return 2;
  if (v < 95) return 0; if (v < 100) return 1; if (v < 105) return 2; if (v < 110) return 3; return 4;
}
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

function combineWeighted(parts: {
  mvrv: number | null; nupl: number | null; puell: number | null;
  reserveRisk: number | null; ma200w: number | null; fearGreed: number | null;
}) {
  let w = 0, sum = 0;
  const push = (k: keyof typeof WEIGHTS, v: number | null) => {
    if (v == null) return;
    sum += v * WEIGHTS[k]; w += WEIGHTS[k];
  };
  push("mvrv", parts.mvrv);
  push("nupl", parts.nupl);
  push("puell", parts.puell);
  push("reserveRisk", parts.reserveRisk);
  push("ma200w", parts.ma200w);
  push("fearGreed", parts.fearGreed);
  if (w === 0) return { score: 0, coverage: 0 };
  const normalized = (sum / w) * 5;
  return { score: Math.round(normalized), coverage: w };
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

// ---------- Coin Metrics fetch (multi-metric, paginated) ----------
type CmRow = {
  mvrv: number | null;
  realizedCap: number | null;
  marketCap: number | null;
  supply: number | null;
  issuanceUsd: number | null;
};

async function fetchCoinMetrics(start: string): Promise<Map<string, CmRow>> {
  const out = new Map<string, CmRow>();
  const metrics = "CapMVRVCur,CapRealUSD,CapMrktCurUSD,SplyCur,IssTotUSD";
  let url: string | null =
    `https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=${metrics}&start_time=${start}&frequency=1d&page_size=10000`;
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
        realizedCap: row.CapRealUSD != null ? Number(row.CapRealUSD) : null,
        marketCap: row.CapMrktCurUSD != null ? Number(row.CapMrktCurUSD) : null,
        supply: row.SplyCur != null ? Number(row.SplyCur) : null,
        issuanceUsd: row.IssTotUSD != null ? Number(row.IssTotUSD) : null,
      });
    }
    url = j.next_page_url ?? null;
  }
  console.log("Coin Metrics rows:", out.size);
  return out;
}

async function fetchFearGreed(): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const res = await fetch("https://api.alternative.me/fng/?limit=0");
  if (!res.ok) return out;
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

    // 1. Load BTC daily prices
    const prices: { date: string; close: number }[] = [];
    let from = 0;
    const pageSize = 1000;
    for (;;) {
      const { data, error } = await supabase
        .from("btc_daily_prices").select("date, close_usd")
        .gte("date", startDate).order("date", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const page = (data ?? []).map((r: any) => ({ date: r.date as string, close: Number(r.close_usd) }));
      prices.push(...page);
      if (page.length < pageSize) break;
      from += pageSize;
    }
    console.log("BTC daily rows:", prices.length);
    if (prices.length === 0) throw new Error("No BTC price history");

    // 2. Weekly closes for 200WMA
    const weeklyMap = new Map<string, number>();
    function weekStart(d: string): string {
      const dt = new Date(d + "T00:00:00Z");
      dt.setUTCDate(dt.getUTCDate() - dt.getUTCDay());
      return dt.toISOString().slice(0, 10);
    }
    for (const p of prices) weeklyMap.set(weekStart(p.date), p.close);
    const weekly = Array.from(weeklyMap.entries()).sort(([a], [b]) => a.localeCompare(b))
      .map(([ws, close]) => ({ ws, close }));
    const weeklyIndex = new Map<string, number>();
    weekly.forEach((w, i) => weeklyIndex.set(w.ws, i));

    // 3. External pulls
    const [cm, fg] = await Promise.all([fetchCoinMetrics(startDate), fetchFearGreed()]);

    // 4. DXY map (forward-fill)
    const { data: dxyRows } = await supabase
      .from("macro_series_daily").select("date, value")
      .eq("series_id", "DTWEXBGS").order("date", { ascending: true });
    const dxyMap = new Map<string, number>();
    for (const r of dxyRows ?? []) dxyMap.set(r.date as string, Number(r.value));
    const dxyDates = Array.from(dxyMap.keys()).sort();
    function dxyAt(date: string): number | null {
      let lo = 0, hi = dxyDates.length - 1, best = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (dxyDates[mid] <= date) { best = mid; lo = mid + 1; } else hi = mid - 1;
      }
      return best === -1 ? null : dxyMap.get(dxyDates[best]) ?? null;
    }

    // 5. Pre-compute 365-day rolling MA of issuance USD for Puell
    const cmDates = Array.from(cm.keys()).sort();
    const issuanceMaMap = new Map<string, number>();
    {
      const window: number[] = [];
      let runningSum = 0;
      for (const d of cmDates) {
        const v = cm.get(d)?.issuanceUsd;
        if (v == null) continue;
        window.push(v); runningSum += v;
        if (window.length > 365) runningSum -= window.shift()!;
        if (window.length >= 30) issuanceMaMap.set(d, runningSum / window.length);
      }
    }

    // 6. Iterate prices, build snapshot rows
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
      // 200W MA
      const ws = weekStart(p.date);
      let wIdx = weeklyIndex.get(ws);
      if (wIdx == null) {
        let lo = 0, hi = weekly.length - 1, best = -1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (weekly[mid].ws <= ws) { best = mid; lo = mid + 1; } else hi = mid - 1;
        }
        wIdx = best;
      }
      if (wIdx == null || wIdx < 0) continue;
      const slice = weekly.slice(Math.max(0, wIdx - 199), wIdx + 1);
      if (slice.length < 50) continue;
      const ma200w = slice.reduce((s, w) => s + w.close, 0) / slice.length;

      const cmRow = cm.get(p.date);
      const mvrvValue = cmRow?.mvrv ?? null;
      const realizedCap = cmRow?.realizedCap ?? null;
      const marketCap = cmRow?.marketCap ?? null;
      const supply = cmRow?.supply ?? null;
      const issuanceUsd = cmRow?.issuanceUsd ?? null;
      const issuanceMa = issuanceMaMap.get(p.date) ?? null;

      const realizedPrice = realizedCap != null && supply != null && supply > 0
        ? realizedCap / supply : null;
      const nupl = realizedCap != null && marketCap != null && marketCap > 0
        ? (marketCap - realizedCap) / marketCap : null;
      const puellValue = issuanceUsd != null && issuanceMa != null && issuanceMa > 0
        ? issuanceUsd / issuanceMa : null;
      const reserveRisk = mvrvValue != null && realizedPrice != null && mvrvValue > 0 && realizedPrice > 0
        ? p.close / (mvrvValue * realizedPrice) : null;

      const fgValue = fg.get(p.date) ?? null;
      const dxy = dxyAt(p.date);
      const band = rainbowBandFor(p.close, new Date(p.date + "T00:00:00Z").getTime());

      const fgScore = scoreFG(fgValue);
      const maScore = scoreMA(p.close, ma200w);
      const rbScore = scoreRB(band);
      const macroScore = scoreMacro(dxy);
      const mvrvScore = scoreMVRV(mvrvValue);
      const nuplScore = scoreNUPL(nupl);
      const puellScore = scorePuell(puellValue);
      const reserveScore = scoreReserveRisk(reserveRisk);
      const soprScore = scoreSOPR(null);

      const { score: weightedScore } = combineWeighted({
        mvrv: mvrvScore, nupl: nuplScore, puell: puellScore,
        reserveRisk: reserveScore, ma200w: maScore, fearGreed: fgScore,
      });
      const phase = mapPhase(weightedScore);

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
        lth_sopr_value: null,
        lth_sopr_score: soprScore,
        realized_price: realizedPrice,
        nupl: nupl,
        reserve_risk: reserveRisk,
        cycle_total_score: weightedScore,
        cycle_phase: phase,
        strategy_signal: STRATEGIES[phase],
      });
      if (batch.length >= 500) await flush();
    }
    await flush();

    // 7. Validation anchors
    const anchors = ["2017-12-17", "2018-12-15", "2021-04-14", "2021-11-10", "2022-11-21", "2025-10-06", "2025-10-07"];
    const { data: anchorRows } = await supabase
      .from("dashboard_snapshots")
      .select("date, btc_close_usd, ma_200w_value, mvrv_value, nupl, puell_value, reserve_risk, realized_price, fear_greed_value, cycle_total_score, cycle_phase")
      .in("date", anchors).order("date");

    return new Response(JSON.stringify({
      success: true,
      btc_rows: prices.length,
      weekly_closes: weekly.length,
      coin_metrics_rows: cm.size,
      fear_greed_rows: fg.size,
      snapshots_written: written,
      anchors: anchorRows,
    }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("recompute-snapshots error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
