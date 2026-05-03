# Welcome Email + Weekly BTC Report (SendGrid)

Send a welcome email the moment a visitor signs up for free dashboard access, then a weekly BTC market report every Monday at 9 AM ET. Both use your SendGrid account. Every weekly email has a one-click unsubscribe link.

## What you need to provide

1. **SendGrid API key** — I'll prompt you to paste it into a secure secrets form. Stored as `SENDGRID_API_KEY` and only readable by backend functions.
2. **Verified sender** in SendGrid — an email address (e.g. `welcome@thecryptoinvestors.com`) and From name (e.g. "The Crypto Investors") that's already verified in your SendGrid Sender Authentication. If your domain isn't verified yet, do that in SendGrid first or emails will bounce.

That's it — I handle the rest.

## User flow

```text
Visitor submits signup form
       │
       ├─► Lead saved to DB (existing)
       ├─► Welcome email sent immediately via SendGrid
       └─► Dashboard unlocks (existing)

Every Monday 9 AM ET (cron)
       │
       ├─► Pull latest dashboard snapshot + week-over-week deltas + commentary
       ├─► For each subscribed lead → send weekly report
       └─► Skip anyone who clicked unsubscribe
```

## What gets built

### 1. Database changes
- Add `unsubscribed_at` (timestamptz, nullable) and `unsubscribe_token` (uuid, unique) columns to the existing `leads` table. Token auto-generated for every lead (existing + new).
- Add `weekly_email_log` table to track sends (lead_id, week_ending, status, sent_at, error) — prevents duplicates and lets you see delivery history.

### 2. Edge functions (3 new)
- **`send-welcome-email`** — called from the signup form right after the lead is inserted. Sends a single welcome email via SendGrid with name personalization and a link back to the dashboard.
- **`send-weekly-report`** — pulls latest snapshot + previous week snapshot + latest weekly commentary, builds the HTML, then loops over all non-unsubscribed leads and sends via SendGrid (batched, with the unsubscribe link injected per recipient). Logs each send to `weekly_email_log`.
- **`unsubscribe`** — public endpoint that accepts the token from the email link, marks the lead as unsubscribed, and returns a simple branded confirmation page.

### 3. Cron job
- Schedule `send-weekly-report` to run every **Monday at 14:00 UTC (9 AM ET)** using `pg_cron` + `pg_net`.

### 4. Frontend wiring
- `SignupGate.tsx`: after a successful insert, fire-and-forget call to `send-welcome-email` (won't block the unlock if email is slow).
- New `/unsubscribe` route that hits the unsubscribe edge function and shows a "You've been unsubscribed" confirmation matching the dark theme.

### 5. Email design
Both emails match the dashboard's institutional dark aesthetic — charcoal background, white text, BTC orange accents — and render correctly in Gmail/Outlook (table-based layout, inline styles).

**Welcome email contents:**
- Subject: "Welcome to the Bitcoin Cycle Dashboard"
- Greeting with their name
- Quick summary of what they get (cycle gauge, indicators, weekly report)
- Big "Open Dashboard" button → `https://app.thecryptoinvestors.com`

**Weekly report contents (per your choice — Summary + commentary):**
- Subject: "BTC Weekly: [Phase] — Cycle Score [X]/20"
- Current cycle phase + 0–20 score
- BTC price + week-over-week % change
- Your weekly commentary (headline + summary from `weekly_reports` table)
- "View full dashboard" button
- Footer with one-click **Unsubscribe** link

## DST note
Cron runs at a fixed UTC time (14:00). That's 9 AM ET during Eastern Daylight Time and 10 AM ET during Eastern Standard Time. If you want it to always be exactly 9 AM ET year-round, I can add logic to skip/shift in winter — let me know.

## Out of scope (for now)
- Bounce/complaint webhooks (SendGrid can post these back; can be added later)
- Email open/click tracking analytics
- Resend of welcome email if delivery fails (one-shot only)
- Per-user weekly summary timing preferences

## Technical notes (for reference)
- SendGrid sent via REST API (`https://api.sendgrid.com/v3/mail/send`) directly from edge functions — no SDK dependency
- Each weekly send batched in groups of ~500 recipients with `personalizations` to inject per-lead unsubscribe links
- `weekly_email_log` has unique `(lead_id, week_ending)` to make the cron idempotent — re-running the same week won't double-send
- Unsubscribe link format: `https://app.thecryptoinvestors.com/unsubscribe?token=<uuid>` — token is opaque, not guessable, no auth required
- RLS: `unsubscribed_at` and `unsubscribe_token` remain admin-readable only (matches existing leads policy)
