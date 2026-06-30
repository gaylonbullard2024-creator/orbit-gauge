
CREATE TABLE IF NOT EXISTS public.data_integrity_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  provider     TEXT NOT NULL,
  category     TEXT NOT NULL,                 -- timestamp | missing_candle | ath | atl | volume | range | provider_diff
  severity     TEXT NOT NULL DEFAULT 'warning', -- info | warning | error
  affected_date DATE,
  field        TEXT,
  observed     NUMERIC,
  expected     NUMERIC,
  message      TEXT NOT NULL,
  rejected     BOOLEAN NOT NULL DEFAULT false,
  details      JSONB
);
CREATE INDEX IF NOT EXISTS data_integrity_log_checked_at_idx ON public.data_integrity_log (checked_at DESC);
CREATE INDEX IF NOT EXISTS data_integrity_log_provider_idx ON public.data_integrity_log (provider, checked_at DESC);

GRANT SELECT ON public.data_integrity_log TO anon, authenticated;
GRANT ALL    ON public.data_integrity_log TO service_role;
ALTER TABLE public.data_integrity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read integrity log"
  ON public.data_integrity_log FOR SELECT
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.data_provider_status (
  provider          TEXT PRIMARY KEY,
  status            TEXT NOT NULL DEFAULT 'unknown', -- ok | degraded | down | unknown
  last_success_at   TIMESTAMPTZ,
  last_error_at     TIMESTAMPTZ,
  last_error        TEXT,
  last_checked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  latency_ms        INTEGER,
  success_rate_24h  NUMERIC(5,2),
  notes             TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.data_provider_status TO anon, authenticated;
GRANT ALL    ON public.data_provider_status TO service_role;
ALTER TABLE public.data_provider_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read provider status"
  ON public.data_provider_status FOR SELECT
  TO anon, authenticated USING (true);

CREATE TRIGGER set_provider_status_updated_at
BEFORE UPDATE ON public.data_provider_status
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
