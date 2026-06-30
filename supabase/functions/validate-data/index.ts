// Data Integrity Validator
// Runs on-demand (and is invoked by daily-pipeline after every fetch).
// Validates: timestamps, missing daily candles, ATH, ATL, volume, indicator ranges,
// and cross-provider price agreement. Logs every issue to public.data_integrity_log
// and refreshes public.data_provider_status.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Severity = "info" | "warning" | "error";
type Category =
  | "timestamp" | "missing_candle" | "ath" | "atl"
  | "volume" | "range" | "provider_diff" | "fetch";

interface Issue {
  provider: string;
  category: Category;
  severity: Severity;
  message: string;
  affected_date?: string | null;
  field?: string | null;
  observed?: number | null;
  expected?: number | null;
  rejected?: boolean;
  details?: Record<string, unknown>;
}

// Known anchor ATH (daily close from Coin Metrics, verified): 2025-10-06 = $124,824.45
const ATH_ANCHOR = { date: "2025-10-06", price: 124824.45, tolerancePct: 1.0 };

// Indicator sane ranges (historical bounds + slack)
const RANGES: Record<string, { min: number; max: number; label: string }> = {
  mvrv_value:        { min: 0.3,  max: 8,   label: "MVRV" },
  nupl:              { min: -0.7, max: 0.9, label: "NUPL" },
  puell_value:       { min: 0.2,  max: 8,   label: "Puell Multiple" },
  fear_greed_value:  { min: 0,    max: 100, label: "Fear & Greed" },
  ma_200w_value:     { min: 100,  max: 500_000, label: "200W MA" },
  btc_close_usd:     { min: 50,   max: 1_000_000, label: "BTC close" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const issues: Issue[] = [];
  const providerStats: Record<string, { ok: boolean; latency_ms?: number; error?: string; notes?: string }> = {};

  // ─── 1. Coin Metrics: live ping for BTC close + ATH cross-check ───
  let cmPrice: number | null = null;
  try {
    const t0 = performance.now();
    const r = await fetch(
      "https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=PriceUSD&frequency=1d&page_size=1&end_time=" +
      new Date().toISOString().slice(0, 10) + "T23:59:59Z"
    );
    const j: any = await r.json();
    const latency = Math.round(performance.now() - t0);
    if (!r.ok || !j.data?.[0]?.PriceUSD) {
      providerStats.coinmetrics = { ok: false, latency_ms: latency, error: `HTTP ${r.status}` };
      issues.push({ provider: "coinmetrics", category: "fetch", severity: "error", message: `Coin Metrics PriceUSD fetch failed (${r.status})`, rejected: true });
    } else {
      cmPrice = Number(j.data[0].PriceUSD);
      providerStats.coinmetrics = { ok: true, latency_ms: latency };
    }
  } catch (e) {
    providerStats.coinmetrics = { ok: false, error: (e as Error).message };
    issues.push({ provider: "coinmetrics", category: "fetch", severity: "error", message: `Coin Metrics unreachable: ${(e as Error).message}`, rejected: true });
  }

  // ─── 2. CoinGecko: cross-check current price ───
  let cgPrice: number | null = null;
  try {
    const t0 = performance.now();
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd");
    const j: any = await r.json();
    const latency = Math.round(performance.now() - t0);
    if (!r.ok || !j?.bitcoin?.usd) {
      providerStats.coingecko = { ok: false, latency_ms: latency, error: `HTTP ${r.status}` };
    } else {
      cgPrice = Number(j.bitcoin.usd);
      providerStats.coingecko = { ok: true, latency_ms: latency };
    }
  } catch (e) {
    providerStats.coingecko = { ok: false, error: (e as Error).message };
  }

  // ─── 3. Alternative.me Fear & Greed ───
  try {
    const t0 = performance.now();
    const r = await fetch("https://api.alternative.me/fng/?limit=1");
    const j: any = await r.json();
    const latency = Math.round(performance.now() - t0);
    if (!r.ok || !j?.data?.[0]) {
      providerStats["alternative.me"] = { ok: false, latency_ms: latency, error: `HTTP ${r.status}` };
    } else {
      const v = Number(j.data[0].value);
      providerStats["alternative.me"] = { ok: true, latency_ms: latency, notes: `now ${v}` };
      if (v < 0 || v > 100) {
        issues.push({ provider: "alternative.me", category: "range", severity: "error",
          message: `Fear & Greed out of [0,100]: ${v}`, observed: v, field: "fear_greed_value", rejected: true });
      }
    }
  } catch (e) {
    providerStats["alternative.me"] = { ok: false, error: (e as Error).message };
  }

  // ─── 4. FRED DXY (sanity ping) ───
  try {
    const key = Deno.env.get("FRED_API_KEY");
    if (key) {
      const t0 = performance.now();
      const r = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=DTWEXBGS&api_key=${key}&file_type=json&sort_order=desc&limit=1`);
      const j: any = await r.json();
      const latency = Math.round(performance.now() - t0);
      providerStats.fred = r.ok && j?.observations?.[0]
        ? { ok: true, latency_ms: latency }
        : { ok: false, latency_ms: latency, error: `HTTP ${r.status}` };
    } else {
      providerStats.fred = { ok: false, error: "FRED_API_KEY missing" };
    }
  } catch (e) {
    providerStats.fred = { ok: false, error: (e as Error).message };
  }

  // ─── 5. Provider price disagreement ───
  if (cmPrice != null && cgPrice != null) {
    const diffPct = Math.abs(cmPrice - cgPrice) / cgPrice * 100;
    if (diffPct > 2) {
      issues.push({
        provider: "cross-provider", category: "provider_diff",
        severity: diffPct > 5 ? "error" : "warning",
        message: `BTC price disagreement: Coin Metrics $${cmPrice.toFixed(0)} vs CoinGecko $${cgPrice.toFixed(0)} (${diffPct.toFixed(2)}%)`,
        observed: cmPrice, expected: cgPrice, field: "btc_close_usd",
        rejected: diffPct > 5,
        details: { coinmetrics: cmPrice, coingecko: cgPrice, diff_pct: diffPct },
      });
    }
  }

  // ─── 6. DB validation: timestamps, gaps, ATH, ATL, volume, indicator ranges ───
  const today = new Date().toISOString().slice(0, 10);

  // 6a. Future-dated rows
  const { data: future } = await supabase
    .from("btc_daily_prices")
    .select("date, close_usd").gt("date", today).limit(10);
  for (const r of future ?? []) {
    issues.push({ provider: "btc_daily_prices", category: "timestamp", severity: "error",
      message: `Future-dated row: ${r.date}`, affected_date: r.date, rejected: true });
  }

  // 6b. Missing daily candles (gaps in last 365 days)
  const since = new Date(); since.setDate(since.getDate() - 365);
  const sinceStr = since.toISOString().slice(0, 10);
  const { data: recent } = await supabase
    .from("btc_daily_prices")
    .select("date, close_usd, volume_usd")
    .gte("date", sinceStr).lte("date", today)
    .order("date", { ascending: true });
  const rows = recent ?? [];
  const seen = new Set(rows.map((r) => r.date as string));
  let cur = new Date(sinceStr + "T00:00:00Z");
  const end = new Date(today + "T00:00:00Z");
  let gaps = 0;
  while (cur <= end) {
    const d = cur.toISOString().slice(0, 10);
    if (!seen.has(d)) {
      gaps++;
      if (gaps <= 5) {
        issues.push({ provider: "btc_daily_prices", category: "missing_candle",
          severity: "warning", message: `Missing daily candle ${d}`, affected_date: d });
      }
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  if (gaps > 5) {
    issues.push({ provider: "btc_daily_prices", category: "missing_candle", severity: "warning",
      message: `${gaps} missing daily candles in last 365d (showing first 5)`, observed: gaps });
  }

  // 6c. ATH validation
  const { data: athRow } = await supabase
    .from("btc_daily_prices").select("date, close_usd")
    .order("close_usd", { ascending: false }).limit(1).maybeSingle();
  if (athRow) {
    const diffPct = Math.abs(Number(athRow.close_usd) - ATH_ANCHOR.price) / ATH_ANCHOR.price * 100;
    if (diffPct > ATH_ANCHOR.tolerancePct || athRow.date !== ATH_ANCHOR.date) {
      issues.push({
        provider: "btc_daily_prices", category: "ath",
        severity: diffPct > 5 ? "error" : "warning",
        message: `ATH drift: stored ${athRow.date}=$${Number(athRow.close_usd).toFixed(0)} vs anchor ${ATH_ANCHOR.date}=$${ATH_ANCHOR.price}`,
        affected_date: athRow.date, observed: Number(athRow.close_usd), expected: ATH_ANCHOR.price,
      });
    }
  } else {
    issues.push({ provider: "btc_daily_prices", category: "ath", severity: "error",
      message: "Cannot determine ATH — no rows" });
  }

  // 6d. ATL validation (sanity: > 0, and historical floor not below $50)
  const { data: atlRow } = await supabase
    .from("btc_daily_prices").select("date, close_usd")
    .gt("close_usd", 0).order("close_usd", { ascending: true }).limit(1).maybeSingle();
  if (!atlRow || Number(atlRow.close_usd) <= 0) {
    issues.push({ provider: "btc_daily_prices", category: "atl", severity: "error",
      message: "ATL invalid or non-positive", rejected: true });
  } else if (Number(atlRow.close_usd) > 1000) {
    issues.push({ provider: "btc_daily_prices", category: "atl", severity: "warning",
      message: `ATL unexpectedly high: ${atlRow.date}=$${atlRow.close_usd} (history may be truncated)`,
      affected_date: atlRow.date, observed: Number(atlRow.close_usd) });
  }

  // 6e. Volume validation (last 30d should be positive)
  const { data: volRows } = await supabase
    .from("btc_daily_prices").select("date, volume_usd")
    .gte("date", new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10))
    .order("date", { ascending: false });
  let badVol = 0;
  for (const r of volRows ?? []) {
    const v = r.volume_usd == null ? null : Number(r.volume_usd);
    if (v != null && (v < 0 || (v > 0 && v < 1e8))) {
      badVol++;
      if (badVol <= 3) {
        issues.push({ provider: "btc_daily_prices", category: "volume", severity: "warning",
          message: `Implausible volume on ${r.date}: $${v.toLocaleString()}`,
          affected_date: r.date, observed: v, field: "volume_usd" });
      }
    }
  }

  // 6f. Indicator range validation (latest snapshot)
  const { data: snap } = await supabase
    .from("dashboard_snapshots")
    .select("date, btc_close_usd, mvrv_value, nupl, puell_value, fear_greed_value, ma_200w_value")
    .order("date", { ascending: false }).limit(1).maybeSingle();
  if (snap) {
    for (const [field, rng] of Object.entries(RANGES)) {
      const v = (snap as any)[field];
      if (v == null) continue;
      const num = Number(v);
      if (num < rng.min || num > rng.max) {
        issues.push({
          provider: "dashboard_snapshots", category: "range",
          severity: "error",
          message: `${rng.label} out of range [${rng.min}, ${rng.max}]: ${num}`,
          affected_date: snap.date as string, field, observed: num,
        });
      }
    }
  }

  // ─── 7. Persist issues ───
  if (issues.length > 0) {
    const { error } = await supabase.from("data_integrity_log").insert(
      issues.map((i) => ({
        provider: i.provider, category: i.category, severity: i.severity,
        affected_date: i.affected_date ?? null, field: i.field ?? null,
        observed: i.observed ?? null, expected: i.expected ?? null,
        message: i.message, rejected: i.rejected ?? false, details: i.details ?? null,
      })) as any,
    );
    if (error) console.error("insert log error:", error.message);
  }

  // ─── 8. Compute 24h success rate from log + persist provider status ───
  const dayAgo = new Date(Date.now() - 86400_000).toISOString();
  const { data: recentLog } = await supabase
    .from("data_integrity_log")
    .select("provider, severity").gte("checked_at", dayAgo);
  const errorsByProvider = new Map<string, number>();
  const totalByProvider = new Map<string, number>();
  for (const r of recentLog ?? []) {
    totalByProvider.set(r.provider, (totalByProvider.get(r.provider) ?? 0) + 1);
    if (r.severity === "error") errorsByProvider.set(r.provider, (errorsByProvider.get(r.provider) ?? 0) + 1);
  }

  const statusRows = Object.entries(providerStats).map(([provider, s]) => {
    const errs = errorsByProvider.get(provider) ?? 0;
    const total = totalByProvider.get(provider) ?? 0;
    const successRate = total > 0 ? Math.max(0, 100 - (errs / Math.max(total, 1)) * 100) : (s.ok ? 100 : 0);
    return {
      provider,
      status: !s.ok ? "down" : (errs > 0 ? "degraded" : "ok"),
      last_success_at: s.ok ? new Date().toISOString() : null,
      last_error_at: s.ok ? null : new Date().toISOString(),
      last_error: s.error ?? null,
      last_checked_at: new Date().toISOString(),
      latency_ms: s.latency_ms ?? null,
      success_rate_24h: Number(successRate.toFixed(2)),
      notes: s.notes ?? null,
    };
  });
  if (statusRows.length > 0) {
    await supabase.from("data_provider_status").upsert(statusRows as any, { onConflict: "provider" });
  }

  return new Response(JSON.stringify({
    success: true,
    checked_at: new Date().toISOString(),
    issues_logged: issues.length,
    rejected_count: issues.filter((i) => i.rejected).length,
    providers: statusRows,
    issues: issues.slice(0, 50),
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
