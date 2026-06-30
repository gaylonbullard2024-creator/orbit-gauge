// Backfill btc_daily_prices from 2014-01-01 to today via CoinGecko (days=max&interval=daily).
// Free/demo tier supports this for BTC.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const cgApiKey = Deno.env.get("COINGECKO_API_KEY");
    const headers: Record<string, string> = { Accept: "application/json" };
    if (cgApiKey) headers["x-cg-demo-api-key"] = cgApiKey;

    const url =
      "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=max&interval=daily";
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`CoinGecko ${res.status}: ${t}`);
    }
    const j = await res.json();
    const prices: [number, number][] = j.prices ?? [];
    const mcaps: [number, number][] = j.market_caps ?? [];
    const vols: [number, number][] = j.total_volumes ?? [];

    const byDate = new Map<string, { close: number; mcap: number | null; vol: number | null }>();
    for (let i = 0; i < prices.length; i++) {
      const d = new Date(prices[i][0]).toISOString().slice(0, 10);
      byDate.set(d, {
        close: prices[i][1],
        mcap: mcaps[i]?.[1] ?? null,
        vol: vols[i]?.[1] ?? null,
      });
    }
    const rows = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        close_usd: v.close,
        market_cap_usd: v.mcap,
        volume_usd: v.vol,
        source: "coingecko",
      }));

    let written = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase
        .from("btc_daily_prices")
        .upsert(chunk, { onConflict: "date" });
      if (error) throw new Error(`upsert at ${i}: ${error.message}`);
      written += chunk.length;
    }

    // ATH validation
    const ath = rows.reduce((a, b) => (b.close_usd > a.close_usd ? b : a), rows[0]);

    return new Response(
      JSON.stringify({
        success: true,
        rows_written: written,
        first_date: rows[0]?.date,
        last_date: rows[rows.length - 1]?.date,
        ath: { date: ath.date, close_usd: ath.close_usd },
      }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("backfill-btc-history error:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
