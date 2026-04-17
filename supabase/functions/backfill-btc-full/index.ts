import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Backfill BTC daily prices from CoinGecko's `days=max` endpoint.
// This fetches ALL available history (back to ~2013) in a single call.
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
    const cgHeaders: Record<string, string> = { Accept: "application/json" };
    if (cgApiKey) cgHeaders["x-cg-demo-api-key"] = cgApiKey;

    console.log("Fetching full BTC history (days=max)...");
    const cgRes = await fetch(
      "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=max&interval=daily",
      { headers: cgHeaders }
    );
    if (!cgRes.ok) throw new Error(`CoinGecko error: ${cgRes.status} ${await cgRes.text()}`);
    const cgData = await cgRes.json();
    const prices: [number, number][] = cgData.prices ?? [];
    console.log(`Got ${prices.length} price points`);

    // Deduplicate by date, keep last price per day
    const byDate: Record<string, { date: string; close_usd: number; source: string }> = {};
    for (const [ts, price] of prices) {
      const date = new Date(ts).toISOString().split("T")[0];
      byDate[date] = { date, close_usd: price, source: "coingecko" };
    }
    const rows = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));

    // Upsert in batches of 500
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      const { error } = await supabase
        .from("btc_daily_prices")
        .upsert(batch, { onConflict: "date" });
      if (error) {
        console.error("BTC batch error:", error.message);
      } else {
        inserted += batch.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        fetched: prices.length,
        unique_days: rows.length,
        inserted,
        earliest: rows[0]?.date,
        latest: rows[rows.length - 1]?.date,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
