import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const today = new Date().toISOString().split("T")[0];
    const cgApiKey = Deno.env.get("COINGECKO_API_KEY");

    // 1. Fetch BTC price from CoinGecko
    // CoinGecko API
    const cgHeaders: Record<string, string> = { "Accept": "application/json" };
    let cgUrl = "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=365&interval=daily";
    
    console.log("CoinGecko API key present:", !!cgApiKey, "length:", cgApiKey?.length ?? 0);
    
    if (cgApiKey) {
      // Demo keys use x-cg-demo-api-key header
      cgHeaders["x-cg-demo-api-key"] = cgApiKey;
    }

    const cgRes = await fetch(cgUrl, { headers: cgHeaders });
    if (!cgRes.ok) throw new Error(`CoinGecko error: ${cgRes.status} ${await cgRes.text()}`);
    const cgData = await cgRes.json();
    const prices: [number, number][] = cgData.prices;
    const marketCaps: [number, number][] = cgData.market_caps ?? [];

    // Store latest price + market cap
    const latestPrice = prices[prices.length - 1][1];
    const latestMcap = marketCaps.length > 0 ? marketCaps[marketCaps.length - 1][1] : null;
    await supabase.from("btc_daily_prices").upsert({
      date: today,
      close_usd: latestPrice,
      market_cap_usd: latestMcap,
      source: "coingecko",
    }, { onConflict: "date" });

    // 2. Fetch Fear & Greed
    const fgRes = await fetch("https://api.alternative.me/fng/?limit=1");
    if (!fgRes.ok) throw new Error(`Fear&Greed error: ${fgRes.status}`);
    const fgData = await fgRes.json();
    const fgValue = parseInt(fgData.data[0].value);
    const fgClass = fgData.data[0].value_classification;
    await supabase.from("fear_greed_daily").upsert({
      date: today,
      value: fgValue,
      classification: fgClass,
      source: "alternative.me",
    }, { onConflict: "date" });

    // 3. Fetch DXY from FRED
    const fredKey = Deno.env.get("FRED_API_KEY");
    let dxyValue: number | null = null;
    if (fredKey) {
      const fredRes = await fetch(
        `https://api.stlouisfed.org/fred/series/observations?series_id=DTWEXBGS&api_key=${fredKey}&file_type=json&sort_order=desc&limit=30`
      );
      console.log("FRED API response status:", fredRes.status);
      if (!fredRes.ok) {
        const errText = await fredRes.text();
        console.error("FRED API error:", errText);
      }
      if (fredRes.ok) {
        const fredData = await fredRes.json();
        const validObs = (fredData.observations ?? []).filter((o: any) => o.value !== ".");
        console.log("FRED valid observations found:", validObs.length);
        if (validObs.length > 0) {
          const obs = validObs[0]; // most recent valid (sorted desc)
          dxyValue = parseFloat(obs.value);
          const obsDate = obs.date; // actual FRED observation date
          // Store with actual observation date
          await supabase.from("macro_series_daily").upsert({
            date: obsDate,
            series_id: "DTWEXBGS",
            value: dxyValue,
            source: "fred",
          }, { onConflict: "date,series_id" });
          // Also forward-fill today's date so dashboard queries work
          if (obsDate !== today) {
            await supabase.from("macro_series_daily").upsert({
              date: today,
              series_id: "DTWEXBGS",
              value: dxyValue,
              source: "fred",
            }, { onConflict: "date,series_id" });
          }
        } else {
          console.warn("FRED: no valid DXY observations in last 30 entries");
        }
      }
    }

    // Carry forward: if no fresh DXY, use last known value
    if (dxyValue == null) {
      const { data: lastMacro } = await supabase
        .from("macro_series_daily")
        .select("value")
        .eq("series_id", "DTWEXBGS")
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastMacro) {
        dxyValue = Number(lastMacro.value);
        console.log("DXY carry-forward value:", dxyValue);
      }
    }

    // 4. True 200-Week MA from stored daily history (no interpolation):
    //    Build last-close-per-week from btc_daily_prices, average the last 200 weekly closes.
    const weeklyCloses: { ws: string; close: number }[] = [];
    {
      const all: { date: string; close: number }[] = [];
      let from = 0;
      const pageSize = 1000; // PostgREST server-side max-rows is 1000
      for (;;) {
        const { data, error } = await supabase
          .from("btc_daily_prices")
          .select("date, close_usd")
          .order("date", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw new Error(`btc_daily_prices read failed: ${error.message}`);
        const page = (data ?? []).map((r: any) => ({ date: r.date as string, close: Number(r.close_usd) }));
        all.push(...page);
        if (page.length < pageSize) break;
        from += pageSize;
      }
      const map = new Map<string, number>();
      for (const r of all) {
        const dt = new Date(r.date + "T00:00:00Z");
        dt.setUTCDate(dt.getUTCDate() - dt.getUTCDay()); // Sunday boundary
        map.set(dt.toISOString().slice(0, 10), r.close);
      }
      // Ensure today's close is reflected in the current week
      const tdt = new Date(today + "T00:00:00Z");
      tdt.setUTCDate(tdt.getUTCDate() - tdt.getUTCDay());
      map.set(tdt.toISOString().slice(0, 10), latestPrice);
      for (const [ws, close] of Array.from(map.entries()).sort(([a],[b]) => a.localeCompare(b))) {
        weeklyCloses.push({ ws, close });
      }
    }
    const last200 = weeklyCloses.slice(-200);
    const ma200w = last200.reduce((s, w) => s + w.close, 0) / Math.max(1, last200.length);
    console.log(`200W MA computed from ${last200.length} weekly closes -> ${ma200w.toFixed(2)}`);

    // 5. Calculate rainbow band
    const daysSinceGenesis = Math.floor(
      (Date.now() - new Date("2009-01-03").getTime()) / (1000 * 60 * 60 * 24)
    );
    const logPrice = Math.log10(latestPrice);
    const logRegression = 5.83 * Math.log10(daysSinceGenesis) - 17.01;
    const deviation = logPrice - logRegression;
    let rainbowBand: string;
    if (deviation < -0.4) rainbowBand = "Fire Sale";
    else if (deviation < -0.1) rainbowBand = "Accumulate";
    else if (deviation < 0.2) rainbowBand = "Growth";
    else if (deviation < 0.5) rainbowBand = "Overheated";
    else rainbowBand = "Bubble Risk";

    // 6. Market Phase Engine v3 — institutional 6-pillar
    const WEIGHTS = { mvrv: 0.20, nupl: 0.20, puell: 0.15, reserveRisk: 0.10, ma200w: 0.20, fearGreed: 0.15 };

    function scoreFG(v: number) {
      if (v < 20) return 0;
      if (v < 40) return 1;
      if (v < 60) return 2;
      if (v < 75) return 3;
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
      if (v < 0.5) return 0; if (v < 1) return 1; if (v < 2) return 2; if (v < 4) return 3; return 4;
    }
    function scoreReserveRisk(v: number | null) {
      if (v == null) return null;
      if (v < 0.002) return 0; if (v < 0.005) return 1; if (v < 0.010) return 2; if (v < 0.020) return 3; return 4;
    }
    function scoreSOPR(v: number | null) {
      if (v == null) return null;
      if (v < 0.95) return 0; if (v < 1) return 1; if (v < 1.02) return 2; if (v < 1.05) return 3; return 4;
    }
    function scoreRB(band: string) {
      const m: Record<string, number> = { "Fire Sale": 0, "Accumulate": 1, "Growth": 2, "Overheated": 3, "Bubble Risk": 4 };
      return m[band] ?? 2;
    }
    function scoreMacro(v: number | null) {
      if (v == null) return 2;
      if (v < 95) return 0; if (v < 100) return 1; if (v < 105) return 2; if (v < 110) return 3; return 4;
    }

    // 6b. Coin Metrics free-tier — MVRV, Supply, Issuance USD.
    // CapRealUSD / CapMrktCurUSD are paid; we derive Realized Price + NUPL from MVRV.
    let mvrvValue: number | null = null;
    let supply: number | null = null;
    let issuanceUsd: number | null = null;
    let issuanceMa365: number | null = null;
    try {
      const startBack = new Date(today + "T00:00:00Z");
      startBack.setUTCDate(startBack.getUTCDate() - 400);
      const startStr = startBack.toISOString().slice(0, 10);
      const cmRes = await fetch(
        "https://community-api.coinmetrics.io/v4/timeseries/asset-metrics" +
        "?assets=btc&metrics=CapMVRVCur,SplyCur,IssTotUSD" +
        `&frequency=1d&page_size=10000&start_time=${startStr}&end_time=${encodeURIComponent(today + "T23:59:59Z")}`
      );
      if (cmRes.ok) {
        const cmJ: any = await cmRes.json();
        const rows = (cmJ.data ?? []) as any[];
        for (let i = rows.length - 1; i >= 0; i--) {
          const r = rows[i];
          if (mvrvValue == null && r.CapMVRVCur != null) mvrvValue = Number(r.CapMVRVCur);
          if (supply == null && r.SplyCur != null) supply = Number(r.SplyCur);
          if (issuanceUsd == null && r.IssTotUSD != null) issuanceUsd = Number(r.IssTotUSD);
          if (mvrvValue && supply && issuanceUsd) break;
        }
        const issSeries = rows.map((r) => r.IssTotUSD).filter((v) => v != null).map(Number);
        const tail = issSeries.slice(-365);
        if (tail.length >= 30) issuanceMa365 = tail.reduce((s, v) => s + v, 0) / tail.length;
        console.log("Coin Metrics: MVRV", mvrvValue, "Iss", issuanceUsd, "IssMA", issuanceMa365);
        if (mvrvValue != null) {
          await supabase.from("onchain_metrics_daily").upsert(
            [{ date: today, metric_name: "mvrv", value: mvrvValue, source: "coinmetrics" }] as any,
            { onConflict: "date,metric_name" }
          );
        }
      } else {
        console.warn("Coin Metrics fetch failed:", cmRes.status, await cmRes.text());
      }
    } catch (e) {
      console.warn("Coin Metrics error:", (e as Error).message);
    }

    const realizedPrice = mvrvValue != null && mvrvValue > 0 ? latestPrice / mvrvValue : null;
    const nuplValue = mvrvValue != null && mvrvValue > 0 ? 1 - 1 / mvrvValue : null;
    const puellValue = issuanceUsd != null && issuanceMa365 != null && issuanceMa365 > 0
      ? issuanceUsd / issuanceMa365 : null;
    const reserveRiskValue: number | null = null; // requires coin-days (paid feed)
    const soprValue: number | null = null;


    const fgScore = scoreFG(fgValue);
    const maScore = scoreMA(latestPrice, ma200w);
    const rbScore = scoreRB(rainbowBand);
    const macroScore = scoreMacro(dxyValue);
    const mvrvScore = scoreMVRV(mvrvValue);
    const nuplScore = scoreNUPL(nuplValue);
    const puellScore = scorePuell(puellValue);
    const reserveScore = scoreReserveRisk(reserveRiskValue);
    const soprScore = scoreSOPR(soprValue);

    // Weighted combine
    let w = 0, sum = 0;
    const add = (s: number | null, weight: number) => { if (s != null) { sum += s * weight; w += weight; } };
    add(mvrvScore, WEIGHTS.mvrv);
    add(nuplScore, WEIGHTS.nupl);
    add(puellScore, WEIGHTS.puell);
    add(reserveScore, WEIGHTS.reserveRisk);
    add(maScore, WEIGHTS.ma200w);
    add(fgScore, WEIGHTS.fearGreed);
    const weightedScore = w > 0 ? Math.round((sum / w) * 5) : 0;
    const totalScore = weightedScore;

    let phase: string;
    if (weightedScore < 5) phase = "Deep Value";
    else if (weightedScore < 9) phase = "Accumulation";
    else if (weightedScore < 13) phase = "Bull Trend";
    else if (weightedScore < 16) phase = "Overheated";
    else phase = "Cycle Top Risk";


    const strategies: Record<string, string> = {
      "Deep Value": "Strong accumulation zone. Historically the best time to build positions.",
      "Accumulation": "Gradually accumulate Bitcoin. Add on pullbacks.",
      "Bull Trend": "Hold core BTC allocation and accumulate on pullbacks.",
      "Overheated": "Reduce risk. Consider taking profits.",
      "Cycle Top Risk": "Extreme caution. Consider trimming positions or hedging.",
    };

    // 7. Save snapshot
    await supabase.from("dashboard_snapshots").upsert({
      date: today,
      btc_close_usd: latestPrice,
      fear_greed_value: fgValue,
      fear_greed_score: fgScore,
      mvrv_value: mvrvValue,
      mvrv_score: mvrvScore,
      ma_200w_value: ma200w,
      ma_200w_score: maScore,
      rainbow_band: rainbowBand,
      rainbow_score: rbScore,
      macro_value: dxyValue,
      macro_score: macroScore,
      puell_value: puellValue,
      puell_score: puellScore,
      lth_sopr_value: soprValue,
      lth_sopr_score: soprScore,
      realized_price: realizedPrice,
      nupl: nuplValue,
      reserve_risk: reserveRiskValue,
      cycle_total_score: totalScore,
      cycle_phase: phase,
      strategy_signal: strategies[phase],
    } as any, { onConflict: "date" });


    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        score: totalScore,
        phase,
        btc_price: latestPrice,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Pipeline error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
