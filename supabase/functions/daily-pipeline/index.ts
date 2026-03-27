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
        `https://api.stlouisfed.org/fred/series/observations?series_id=DTWEXBGS&api_key=${fredKey}&file_type=json&sort_order=desc&limit=5`
      );
      if (fredRes.ok) {
        const fredData = await fredRes.json();
        const obs = fredData.observations?.find((o: any) => o.value !== ".");
        if (obs) {
          dxyValue = parseFloat(obs.value);
          await supabase.from("macro_series_daily").upsert({
            date: today,
            series_id: "DTWEXBGS",
            value: dxyValue,
            source: "fred",
          }, { onConflict: "date,series_id" });
        }
      }
    }

    // 4. Calculate 200W MA (rolling 1400-day average)
    const dailyCloses = prices.map((p) => p[1]);
    const ma200w = dailyCloses.reduce((sum, v) => sum + v, 0) / dailyCloses.length;

    // 5. Calculate rainbow band
    const daysSinceGenesis = Math.floor(
      (Date.now() - new Date("2009-01-03").getTime()) / (1000 * 60 * 60 * 24)
    );
    const logPrice = Math.log10(latestPrice);
    const logRegression = 2.66167155005961 * Math.log10(daysSinceGenesis) - 17.01593313;
    const deviation = logPrice - logRegression;
    let rainbowBand: string;
    if (deviation < -0.4) rainbowBand = "Fire Sale";
    else if (deviation < -0.1) rainbowBand = "Accumulate";
    else if (deviation < 0.2) rainbowBand = "Growth";
    else if (deviation < 0.5) rainbowBand = "Overheated";
    else rainbowBand = "Bubble Risk";

    // 6. Score indicators
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

    const fgScore = scoreFG(fgValue);
    const maScore = scoreTrend(latestPrice, ma200w);
    const rbScore = scoreRB(rainbowBand);
    const macroScore = scoreMacro(dxyValue);
    const totalScore = fgScore + maScore + rbScore + macroScore;

    // Map to phase
    const maxScore = 16;
    const norm = (totalScore / maxScore) * 20;
    let phase: string;
    if (norm <= 5) phase = "Deep Value";
    else if (norm <= 9) phase = "Accumulation";
    else if (norm <= 13) phase = "Bull Trend";
    else if (norm <= 17) phase = "Overheated";
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
      ma_200w_value: ma200w,
      ma_200w_score: maScore,
      rainbow_band: rainbowBand,
      rainbow_score: rbScore,
      macro_value: dxyValue,
      macro_score: macroScore,
      cycle_total_score: totalScore,
      cycle_phase: phase,
      strategy_signal: strategies[phase],
    }, { onConflict: "date" });

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
