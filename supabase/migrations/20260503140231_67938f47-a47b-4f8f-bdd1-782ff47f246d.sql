-- Add unsubscribe support to leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz,
  ADD COLUMN IF NOT EXISTS unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS leads_unsubscribe_token_key ON public.leads(unsubscribe_token);

-- Weekly send log
CREATE TABLE IF NOT EXISTS public.weekly_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  week_ending date NOT NULL,
  status text NOT NULL,
  error text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, week_ending)
);

ALTER TABLE public.weekly_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read weekly_email_log"
  ON public.weekly_email_log FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable cron extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;