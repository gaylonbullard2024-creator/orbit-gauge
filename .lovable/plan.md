

# Fix: DXY/Macro Data Not Showing on Dashboard

## Root Cause
The FRED series `DTWEXBGS` (Broad Trade-Weighted Dollar Index) is published **weekly with a 1-2 week lag**. The pipeline fetches only the 5 most recent observations and skips entries marked `"."` (FRED's missing-data placeholder). If all 5 are `"."`, nothing is stored. This has resulted in **zero rows** in `macro_series_daily` and `null` for `macro_value` in every snapshot.

## Fix

### 1. Increase FRED fetch window and add logging
- Change `limit=5` to `limit=30` so we look further back for a valid observation
- Add `console.log` statements for FRED response status and observation count so failures are visible in logs
- Log a warning if no valid observation is found

### 2. Carry forward the last known DXY value
When the FRED API returns no new valid observation, query `macro_series_daily` for the most recent stored value and use that for the snapshot instead of leaving it null. This ensures the dashboard always shows the latest known DXY reading.

### 3. Store the observation's actual date, not today's date
Currently the pipeline stores `date: today` for macro data. Since DTWEXBGS is weekly and lagged, the stored date should be the observation's actual date from FRED (`obs.date`), and the pipeline should also store today's date as a forward-fill row so the dashboard query works.

### 4. Update the snapshot write to use the carried-forward value
The `macro_value` field in `dashboard_snapshots` should use the carried-forward DXY value instead of only the fresh fetch result.

## Files Changed
- `supabase/functions/daily-pipeline/index.ts` — increase FRED limit, add logging, carry-forward logic

## No database changes needed
The existing schema supports this fix as-is.

