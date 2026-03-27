import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const cgApiKey = Deno.env.get("COINGECKO_API_KEY");
    const fredKey = Deno.env.get("FRED_API_KEY");

    // 1. Fetch 365 days of BTC prices from CoinGecko
    console.log("Fetching BTC price history...");
    const cgHeaders: Record<string, string> = { Accept: "application/json" };
    if (cgApiKey) cgHeaders["x-cg-demo-api-key"] = cgApiKey;

    const cgRes = await fetch(
      "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=365&interval=daily",
      { headers: cgHeaders }
    );
    if (!cgRes.ok) throw new Error(`CoinGecko error: ${cgRes.status} ${await cgRes.text()}`);
    const cgData = await cgRes.json();
    const prices: [number, number][] = cgData.prices;
    console.log(`Got ${prices.length} price points`);

    // Store all BTC prices
    const btcRows = prices.map(([ts, price]) => ({
      date: new Date(ts).toISOString().split("T")[0],
      close_usd: price,
      source: "coingecko",
    }));
    // Deduplicate by date
    const uniqueBtc = Object.values(
      btcRows.reduce((acc, r) => { acc[r.date] = r; return acc; }, {} as Record<string, typeof btcRows[0]>)
    );
    const { error: btcErr } = await supabase.from("btc_daily_prices").upsert(uniqueBtc, { onConflict: "date" });
    if (btcErr) console.error("BTC insert error:", btcErr.message);
    console.log(`Stored ${uniqueBtc.length} BTC price rows`);

    // 2. Fetch Fear & Greed history (Alternative.me supports ?limit=365)
    console.log("Fetching Fear & Greed history...");
    const fgRes = await fetch("https://api.alternative.me/fng/?limit=365");
    if (!fgRes.ok) throw new Error(`Fear&Greed error: ${fgRes.status}`);
    const fgData = await fgRes.json();
    const fgRows = fgData.data.map((d: any) => ({
      date: new Date(parseInt(d.timestamp) * 1000).toISOString().split("T")[0],
      value: parseInt(d.value),
      classification: d.value_classification,
      source: "alternative.me",
    }));
    const uniqueFg = Object.values(
      fgRows.reduce((acc: any, r: any) => { acc[r.date] = r; return acc; }, {} as Record<string, any>)
    );
    const { error: fgErr } = await supabase.from("fear_greed_daily").upsert(uniqueFg, { onConflict: "date" });
    if (fgErr) console.error("FG insert error:", fgErr.message);
    console.log(`Stored ${uniqueFg.length} Fear & Greed rows`);

    // 3. Fetch DXY history from FRED
    let macroCount = 0;
    if (fredKey) {
      console.log("Fetching FRED DXY history...");
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const startDate = oneYearAgo.toISOString().split("T")[0];
      const fredRes = await fetch(
        `https://api.stlouisfed.org/fred/series/observations?series_id=DTWEXBGS&api_key=${fredKey}&file_type=json&observation_start=${startDate}&sort_order=asc`
      );
      if (fredRes.ok) {
        const fredData = await fredRes.json();
        const macroRows = (fredData.observations ?? [])
          .filter((o: any) => o.value !== ".")
          .map((o: any) => ({
            date: o.date,
            series_id: "DTWEXBGS",
            value: parseFloat(o.value),
            source: "fred",
          }));
        if (macroRows.length > 0) {
          const { error: macroErr } = await supabase
            .from("macro_series_daily")
            .upsert(macroRows, { onConflict: "date,series_id" });
          if (macroErr) console.error("Macro insert error:", macroErr.message);
          macroCount = macroRows.length;
        }
        console.log(`Stored ${macroCount} DXY rows`);
      } else {
        console.log("FRED fetch failed:", fredRes.status);
      }
    } else {
      console.log("No FRED_API_KEY, skipping DXY backfill");
    }

    // 4. Build a lookup for DXY by date (forward-fill gaps)
    const { data: allMacro } = await supabase
      .from("macro_series_daily")
      .select("date, value")
      .eq("series_id", "DTWEXBGS")
      .order("date", { ascending: true });
    const dxyByDate: Record<string, number> = {};
    let lastDxy: number | null = null;
    if (allMacro) {
      for (const m of allMacro) {
        dxyByDate[m.date] = Number(m.value);
        lastDxy = Number(m.value);
      }
    }

    // 5. Compute and store dashboard snapshots for each day
    console.log("Computing daily snapshots...");
    const dailyCloses = prices.map((p) => p[1]);
    const daysSinceGenesisBase = Math.floor(
      (Date.now() - new Date("2009-01-03").getTime()) / (1000 * 60 * 60 * 24)
    );

    // Build FG lookup
    const fgByDate: Record<string, { value: number; classification: string }> = {};
    for (const fg of fgRows) {
      fgByDate[fg.date] = { value: fg.value, classification: fg.classification };
    }

    // Scoring functions
    function scoreFG(v: number) {
      if (v <= 25) return 0;
      if (v <= 40) return 1;
      if (v <= 60) return 2;
      if (v <= 75) return 3;
      return 4;
    }
    function scoreTrend(price: number, ma: number) {
      if (price <= ma) return 0;
      const pct = price / ma - 1;
      if (pct <= 0.25) return 1;
      if (pct <= 0.75) return 2;
      if (pct <= 1.5) return 3;
      return 4;
    }
    function scoreRB(band: string) {
      const m: Record<string, number> = {
        "Fire Sale": 0, "Accumulate": 1, "Growth": 2, "Overheated": 3, "Bubble Risk": 4,
      };
      return m[band] ?? 2;
    }
    function scoreMacro(v: number | null) {
      if (v == null) return 2;
      if (v < 95) return 0;
      if (v < 100) return 1;
      if (v < 105) return 2;
      if (v < 110) return 3;
      return 4;
    }
    function mapPhase(score: number) {
      const norm = (score / 16) * 20;
      if (norm <= 5) return "Deep Value";
      if (norm <= 9) return "Accumulation";
      if (norm <= 13) return "Bull Trend";
      if (norm <= 17) return "Overheated";
      return "Cycle Top Risk";
    }
    const strategies: Record<string, string> = {
      "Deep Value": "Strong accumulation zone. Historically the best time to build positions.",
      "Accumulation": "Gradually accumulate Bitcoin. Add on pullbacks.",
      "Bull Trend": "Hold core BTC allocation and accumulate on pullbacks.",
      "Overheated": "Reduce risk. Consider taking profits.",
      "Cycle Top Risk": "Extreme caution. Consider trimming positions or hedging.",
    };

    const snapshots: any[] = [];

    for (let i = 0; i < prices.length; i++) {
      const [ts, price] = prices[i];
      const date = new Date(ts).toISOString().split("T")[0];

      // Rolling MA from available history up to this point
      const windowEnd = i + 1;
      const windowStart = Math.max(0, windowEnd - dailyCloses.length); // use all available
      const slice = dailyCloses.slice(windowStart, windowEnd);
      const ma200w = slice.reduce((s, v) => s + v, 0) / slice.length;

      // Rainbow band
      const dayNum = daysSinceGenesisBase - (prices.length - 1 - i);
      const logPrice = Math.log10(price);
      const logReg = 2.66167155005961 * Math.log10(dayNum) - 17.01593313;
      const dev = logPrice - logReg;
      let rainbow: string;
      if (dev < -0.4) rainbow = "Fire Sale";
      else if (dev < -0.1) rainbow = "Accumulate";
      else if (dev < 0.2) rainbow = "Growth";
      else if (dev < 0.5) rainbow = "Overheated";
      else rainbow = "Bubble Risk";

      // Fear & Greed for this date
      const fg = fgByDate[date];
      const fgValue = fg?.value ?? 50;
      const fgScore = scoreFG(fgValue);

      // DXY (forward-fill)
      let dxy: number | null = dxyByDate[date] ?? null;
      if (dxy == null) {
        // Find most recent DXY before this date
        const sorted = Object.keys(dxyByDate).sort();
        for (const d of sorted) {
          if (d <= date) dxy = dxyByDate[d];
          else break;
        }
      }

      const maScore = scoreTrend(price, ma200w);
      const rbScore = scoreRB(rainbow);
      const mScore = scoreMacro(dxy);
      const total = fgScore + maScore + rbScore + mScore;
      const phase = mapPhase(total);

      snapshots.push({
        date,
        btc_close_usd: price,
        fear_greed_value: fgValue,
        fear_greed_score: fgScore,
        ma_200w_value: ma200w,
        ma_200w_score: maScore,
        rainbow_band: rainbow,
        rainbow_score: rbScore,
        macro_value: dxy,
        macro_score: mScore,
        cycle_total_score: total,
        cycle_phase: phase,
        strategy_signal: strategies[phase],
      });
    }

    // Upsert in batches of 100
    let inserted = 0;
    for (let i = 0; i < snapshots.length; i += 100) {
      const batch = snapshots.slice(i, i + 100);
      const { error: snapErr } = await supabase
        .from("dashboard_snapshots")
        .upsert(batch, { onConflict: "date" });
      if (snapErr) console.error("Snapshot batch error:", snapErr.message);
      inserted += batch.length;
    }
    console.log(`Stored ${inserted} dashboard snapshots`);

    return new Response(
      JSON.stringify({
        success: true,
        btc_prices: uniqueBtc.length,
        fear_greed: (uniqueFg as any[]).length,
        dxy: macroCount,
        snapshots: inserted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Backfill error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
