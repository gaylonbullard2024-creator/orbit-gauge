

# Update FRED API Key & Test Pipeline

## Steps

1. **Update the `FRED_API_KEY` secret** with the new value `30141064f99ff90ab8ef725524d37ff0`
2. **Invoke the `daily-pipeline` edge function** to test it end-to-end
3. **Check edge function logs** to verify DXY data is fetched successfully from FRED
4. **Query the database** to confirm `macro_series_daily` and `dashboard_snapshots` have DXY values populated (no more dashes on the dashboard)

## Expected Outcome
- The Macro/DXY indicator card on the dashboard should show an actual numeric value instead of "—"
- The `dashboard_snapshots` table should have a non-null `macro_value` for today's date

