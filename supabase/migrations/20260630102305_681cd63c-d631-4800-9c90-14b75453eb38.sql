
ALTER TABLE public.dashboard_snapshots
  ADD COLUMN IF NOT EXISTS puell_value numeric,
  ADD COLUMN IF NOT EXISTS puell_score integer,
  ADD COLUMN IF NOT EXISTS lth_sopr_value numeric,
  ADD COLUMN IF NOT EXISTS lth_sopr_score integer;
