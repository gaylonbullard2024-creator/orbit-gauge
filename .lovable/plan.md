
## Root causes found

After auditing `supabase/functions/daily-pipeline/index.ts` and the DB, the dashboard's accuracy issues trace to **four real bugs**, not chart styling:

1. **200-Week MA is actually a ~52-week MA.** Pipeline only fetches `days=365` from CoinGecko and then averages every daily close it gets back. That's a 365-day mean (~52 weeks), not 1,400 days (~200 weeks). This makes the "BTC vs 200W MA" chart and its score wrong every single day.
2. **"MVRV" is not MVRV.** It's `currentMarketCap / avg(marketCap over last 365 days)`. Real MVRV needs realized cap (on-chain). Today it just tracks short-term momentum and silently feeds the cycle score.
3. **Historical snapshots inherit those bugs.** Every past `dashboard_snapshots` row was written with the same broken MA/MVRV logic, so Phase History shows "Accumulation" in Oct 2025 even though BTC printed an ATH (~$124.7k close / ~$126k intraday). Fixing the pipeline alone won't fix past rows — we have to recompute them.
4. **ATH visibility.** DB close on 2025-10-07 is $124,773 (correct daily close). Client expects the $126k intraday ATH (5 Oct) to be visible on the chart. Right now nothing on the chart calls out the ATH at all.

Puell Multiple and LTH-SOPR are not tracked yet — client asked for them.

## What this plan delivers

```text
[ pipeline ] -> correct 200W MA (1400 daily closes, weekly resample)
            -> real MVRV (on-chain realized cap via Coin Metrics)
            -> Puell Multiple + LTH-SOPR (Coin Metrics community API, no key)
[ backfill ] -> recompute every dashboard_snapshots row from full history
[ chart    ] -> ATH marker + tooltip showing intraday high
[ scoring  ] -> phase thresholds re-validated against past ATH/ATL dates
```

## Steps

### 1. Rebuild the 200W MA (correct + verifiable)
- In `daily-pipeline`, stop computing MA from the 365-day CoinGecko payload. Instead read the **last 1,400 daily closes from `btc_daily_prices`** (we already store full history) and compute `mean(last 1400)`. As a stricter alternative, resample to weekly closes (Sun→Sun) and take `mean(last 200 weekly closes)` — this is the literal "200-week MA" the chart name promises. I'll implement the weekly version since the client specifically said "weekly closing prices, do not interpolate".
- Add a one-off edge function `recompute-ma200w` that walks every date from 2014-01-01 → today and writes the true 200W MA back into `dashboard_snapshots.ma_200w_value` and re-derives `ma_200w_score`.
- Validation: print the computed MA for 2025-10-07 vs the on-chain reference (~$67k–$72k range expected) and the price at the same date ($124,773) so we can confirm the ratio is sensible.

### 2. Replace the fake MVRV with a real one
- Switch source to **Coin Metrics community API** (`CapMrktCurUSD`, `CapRealUSD`, `PuellMultiple`, `SplyAct1yr`, `SOPR`) — free, no key, daily granularity, full history.
- Store the new series in `onchain_metrics_daily` (already exists, currently unused).
- Compute true `MVRV = CapMrktCurUSD / CapRealUSD` daily and write `mvrv_value` to snapshots.
- Re-score MVRV using accepted bands (≤1 deep value, 1–2 accumulate, 2–3 fair, 3–3.7 overheat, >3.7 top).

### 3. Add Puell Multiple and LTH-SOPR
- Same Coin Metrics pull. Add two columns to `dashboard_snapshots` (`puell_value`, `puell_score`, `lth_sopr_value`, `lth_sopr_score`) via migration, surface them in `CoreIndicators` and `ScoreBreakdown`.
- Document the bands in `INDICATOR_TOOLTIPS`.

### 4. Backfill all historical snapshots
- One-off edge function `recompute-snapshots` that, for each date with a BTC close:
  - recomputes 200W MA from weekly closes,
  - pulls historical F&G from alternative.me (`limit=0` = full history),
  - pulls historical DXY from FRED,
  - pulls MVRV/Puell/LTH-SOPR from Coin Metrics,
  - rescores everything with the current scoring rules,
  - upserts the snapshot.
- This is what actually fixes Phase History showing "Accumulation" during the Oct 2025 ATH.

### 5. Validate scoring against past ATH / ATL dates
After backfill, query the snapshots at: 2017-12-17, 2018-12-15 (ATL), 2021-04-14, 2021-11-10, 2022-11-21 (ATL), 2025-10-07 (ATH). Print phase, total score, F&G, MVRV, MA-ratio, Puell. If any ATH date does not land in `Overheated` or `Cycle Top Risk` (and any ATL date does not land in `Deep Value` or `Accumulation`), the thresholds in `src/lib/scoring.ts` get tuned and the backfill is re-run.

### 6. Show the ATH on the price chart
- In `PriceTrendChart`, compute `max(priceHistory)` and render a small reference dot + label ("ATH $124,773 · Oct 7 2025") so the client can immediately see we're tracking it. The "$126k Oct 5" figure is the CoinMarketCap intraday high; daily-close data sources (CoinGecko) print $124,773 on Oct 7. I'll note the source/convention in the tooltip so this doesn't come up again.

## Out of scope (call out, don't build)
- Whale accumulation panel — needs a paid provider (Glassnode/Nansen). Flagging only.
- Replacing the Rainbow Chart formula — separate concern.
- Cycle-bottom commentary content — editorial, not data.

## Validation deliverables (will be returned after build)
- Row counts before/after backfill.
- Printed table: date, close, 200W MA, MVRV, F&G, Puell, total score, phase for all 6 ATH/ATL anchor dates.
- A diff of how many past snapshots changed phase after the rebuild.
