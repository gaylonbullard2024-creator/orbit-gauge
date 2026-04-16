

# Weekly Report Email Notifications

## Overview
Set up automated weekly email notifications that send the Bitcoin Cycle Dashboard report summary to subscribers every Saturday morning.

## Prerequisites — Email Domain Setup
This project does not have an email domain configured yet. Before we can send emails, we need to set up a sender domain. This is a one-time setup that takes a few minutes.

## What Gets Built

### 1. Email Domain & Infrastructure
- Configure a sender domain so emails come from your brand (e.g., `notify@yourdomain.com`)
- Set up the email sending pipeline (queue, retries, delivery tracking)

### 2. Subscriber Table
- New `email_subscribers` database table to store subscriber emails
- Fields: email, subscribed status, created date
- RLS policies so users can manage their own subscription

### 3. Subscribe/Unsubscribe UI
- Add a subscription form to the dashboard (email input + subscribe button)
- Logged-in users can subscribe with one click using their account email
- Unsubscribe page for one-click opt-out from emails

### 4. Weekly Report Email Template
- Branded React Email template matching the dashboard's dark/orange theme (white email background per best practices)
- Content includes: Cycle Gauge score, phase, strategy signal, all five indicator readings, and key changes from the previous week
- Clean, scannable layout — investors read it in 60 seconds

### 5. Weekly Email Edge Function
- New `send-weekly-report` edge function
- Pulls the latest dashboard snapshot and previous snapshot
- Generates change descriptions
- Sends personalized emails to all active subscribers
- Triggered via a scheduled cron job every Saturday at 6 AM ET

### 6. Cron Schedule
- `pg_cron` job that fires `send-weekly-report` every Saturday morning
- Uses the same pattern as the daily pipeline

## Technical Details

**Database migration:**
```sql
CREATE TABLE public.email_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(email)
);
ALTER TABLE public.email_subscribers ENABLE ROW LEVEL SECURITY;
-- Users can read/insert/update their own subscriptions
```

**Edge function flow:**
1. Query `email_subscribers` where `is_active = true`
2. Fetch latest + previous `dashboard_snapshots`
3. For each subscriber, invoke `send-transactional-email` with the weekly report template
4. Log completion

**Email template content:**
- Header: "MCG Bitcoin Cycle Report — Week of [date]"
- Cycle Gauge: score, phase, strategy
- Indicator summary table (5 rows)
- Key changes bullet points
- CTA button: "View Full Dashboard"

## Implementation Order
1. Set up email domain (requires your input)
2. Set up email infrastructure
3. Create subscriber table + RLS
4. Build subscribe UI on dashboard
5. Create weekly report email template
6. Create `send-weekly-report` edge function
7. Schedule Saturday cron job
8. Create unsubscribe page

