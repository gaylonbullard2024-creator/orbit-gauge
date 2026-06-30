
ALTER TABLE public.dashboard_snapshots
  ADD COLUMN IF NOT EXISTS realized_price numeric(18,2),
  ADD COLUMN IF NOT EXISTS nupl numeric(10,6),
  ADD COLUMN IF NOT EXISTS reserve_risk numeric(18,8),
  ADD COLUMN IF NOT EXISTS exchange_inflow numeric(18,2),
  ADD COLUMN IF NOT EXISTS exchange_outflow numeric(18,2),
  ADD COLUMN IF NOT EXISTS whale_accumulation numeric(18,6),
  ADD COLUMN IF NOT EXISTS whale_distribution numeric(18,6);
