
-- Allow public (anon) read access to dashboard tables since auth was removed

DROP POLICY IF EXISTS "Authenticated users can read btc prices" ON public.btc_daily_prices;
CREATE POLICY "Anyone can read btc prices" ON public.btc_daily_prices FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read dashboard snapshots" ON public.dashboard_snapshots;
CREATE POLICY "Anyone can read dashboard snapshots" ON public.dashboard_snapshots FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read fear greed" ON public.fear_greed_daily;
CREATE POLICY "Anyone can read fear greed" ON public.fear_greed_daily FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read macro series" ON public.macro_series_daily;
CREATE POLICY "Anyone can read macro series" ON public.macro_series_daily FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read onchain metrics" ON public.onchain_metrics_daily;
CREATE POLICY "Anyone can read onchain metrics" ON public.onchain_metrics_daily FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read weekly reports" ON public.weekly_reports;
CREATE POLICY "Anyone can read weekly reports" ON public.weekly_reports FOR SELECT TO anon, authenticated USING (true);
