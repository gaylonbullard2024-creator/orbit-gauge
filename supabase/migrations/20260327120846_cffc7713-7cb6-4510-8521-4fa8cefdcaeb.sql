
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.btc_daily_prices (
  date DATE PRIMARY KEY,
  close_usd NUMERIC(18,2) NOT NULL,
  market_cap_usd NUMERIC(20,2),
  volume_usd NUMERIC(20,2),
  source TEXT DEFAULT 'coingecko',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.btc_daily_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read btc prices" ON public.btc_daily_prices FOR SELECT TO authenticated USING (true);
CREATE TRIGGER update_btc_daily_prices_updated_at BEFORE UPDATE ON public.btc_daily_prices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.fear_greed_daily (
  date DATE PRIMARY KEY,
  value INTEGER NOT NULL,
  classification TEXT,
  source TEXT DEFAULT 'alternative.me',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fear_greed_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read fear greed" ON public.fear_greed_daily FOR SELECT TO authenticated USING (true);
CREATE TRIGGER update_fear_greed_daily_updated_at BEFORE UPDATE ON public.fear_greed_daily FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.macro_series_daily (
  date DATE,
  series_id TEXT,
  value NUMERIC(18,6) NOT NULL,
  source TEXT DEFAULT 'fred',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (date, series_id)
);
ALTER TABLE public.macro_series_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read macro series" ON public.macro_series_daily FOR SELECT TO authenticated USING (true);
CREATE TRIGGER update_macro_series_daily_updated_at BEFORE UPDATE ON public.macro_series_daily FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.onchain_metrics_daily (
  date DATE,
  metric_name TEXT,
  value NUMERIC(18,6) NOT NULL,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (date, metric_name)
);
ALTER TABLE public.onchain_metrics_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read onchain metrics" ON public.onchain_metrics_daily FOR SELECT TO authenticated USING (true);
CREATE TRIGGER update_onchain_metrics_daily_updated_at BEFORE UPDATE ON public.onchain_metrics_daily FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.dashboard_snapshots (
  date DATE PRIMARY KEY,
  btc_close_usd NUMERIC(18,2),
  fear_greed_value INTEGER,
  fear_greed_score INTEGER,
  mvrv_value NUMERIC(18,6),
  mvrv_score INTEGER,
  ma_200w_value NUMERIC(18,2),
  ma_200w_score INTEGER,
  rainbow_band TEXT,
  rainbow_score INTEGER,
  macro_value NUMERIC(18,6),
  macro_score INTEGER,
  cycle_total_score INTEGER,
  cycle_phase TEXT,
  strategy_signal TEXT,
  commentary_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.dashboard_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read dashboard snapshots" ON public.dashboard_snapshots FOR SELECT TO authenticated USING (true);
CREATE TRIGGER update_dashboard_snapshots_updated_at BEFORE UPDATE ON public.dashboard_snapshots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.weekly_reports (
  week_ending DATE PRIMARY KEY,
  headline TEXT,
  summary_markdown TEXT,
  dashboard_snapshot_date DATE REFERENCES public.dashboard_snapshots(date),
  email_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read weekly reports" ON public.weekly_reports FOR SELECT TO authenticated USING (true);
CREATE TRIGGER update_weekly_reports_updated_at BEFORE UPDATE ON public.weekly_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can read their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can insert weekly reports" ON public.weekly_reports FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update weekly reports" ON public.weekly_reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
