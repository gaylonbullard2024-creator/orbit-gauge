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
    // Coin Metrics community API has full BTC history (PriceUSD, CapMrktCurUSD, VolumeUSD24h) since 2010, free.
    const rows: { date: string; close_usd: number; market_cap_usd: number | null; volume_usd: number | null; source: string }[] = [];
    let url: string | null =
      "https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=PriceUSD,CapMrktCurUSD,VolumeUSD24h&start_time=2013-01-01&frequency=1d&page_size=10000";
    while (url) {
      const r: Response = await fetch(url);
      if (!r.ok) throw new Error(`Coin Metrics ${r.status}: ${await r.text()}`);
      const j: any = await r.json();
      for (const row of (j.data ?? [])) {
        const date = String(row.time).slice(0, 10);
        if (row.PriceUSD == null) continue;
        rows.push({
          date,
          close_usd: Number(row.PriceUSD),
          market_cap_usd: row.CapMrktCurUSD != null ? Number(row.CapMrktCurUSD) : null,
          volume_usd: row.VolumeUSD24h != null ? Number(row.VolumeUSD24h) : null,
          source: "coinmetrics",
        });
      }
      url = j.next_page_url ?? null;
    }
    rows.sort((a, b) => a.date.localeCompare(b.date));

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
