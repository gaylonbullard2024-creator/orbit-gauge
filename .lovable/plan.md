# Lead-Capture Signup Gate

Add a frictionless signup form that collects **Name, Email, Phone** before granting access to the dashboard. No password, no email verification — instant access after submit. Leads stored in a new `leads` table in Lovable Cloud.

## User Flow

```text
Visitor lands on /  ──►  Signup gate shown
       │
       ├─ Fills Name + Email + Phone
       ├─ Clicks "Get Free Access"
       │
       ▼
Lead saved to DB  +  flag set in localStorage
       │
       ▼
Dashboard unlocks (and stays unlocked on this device)
```

Returning visitors on the same device skip the gate automatically.

## What gets built

### 1. Database
A new `leads` table in Lovable Cloud:
- `name` (text, required)
- `email` (text, required, lowercased)
- `phone` (text, required)
- `source` (text, default `'dashboard_signup'`) — for future campaigns
- `user_agent`, `referrer` (text, optional, for analytics)
- standard `id`, `created_at`

Access rules:
- **Anyone (anonymous) can insert** a lead — needed for the public form.
- **No one can read/update/delete** from the client. Leads are private; you'll view/export them via the backend.
- Email format validation + basic length limits enforced via a CHECK constraint and zod on the client.
- Unique index on `lower(email)` so the same email isn't stored twice (re-submissions silently succeed).

### 2. Signup gate UI
New component `src/components/SignupGate.tsx`:
- Centered card matching the institutional dark theme (charcoal bg, BTC orange accent).
- Headline: **"Get Free Access to the Bitcoin Cycle Dashboard"**
- Subhead: short value prop (cycle gauge, weekly insights, etc.)
- Three fields: Name, Email, Phone (with country-friendly input).
- Primary CTA button: **"Get Free Access"** (BTC orange).
- Inline validation via zod; errors shown under each field.
- Tiny disclaimer: "We'll only email you about Bitcoin cycle updates."

### 3. Gate logic
New hook `src/hooks/useLeadGate.ts`:
- Reads `localStorage` key `mcg_lead_captured` (stores `{ email, ts }`).
- Exposes `isUnlocked` + `unlock(lead)` helpers.
- On submit: insert into `leads` → set localStorage → unlock instantly.
- If insert fails (network/duplicate), still unlock if duplicate; otherwise show toast.

### 4. Wiring into the app
- `src/pages/Index.tsx` (or wherever `Dashboard` renders) wraps the dashboard with the gate: if `!isUnlocked`, render `<SignupGate />`; else render the dashboard.
- A small "Reset access" link is **not** added — users can clear storage themselves; this keeps friction low.

### 5. Embedded-widget consideration
The dashboard is embedded on your website via `public/widget.js`. The gate works the same in the iframe — each visitor gets prompted once per device, then sees the dashboard.

## Out of scope (can be added later)
- Email verification / magic links
- CRM/Mailchimp/HubSpot forwarding
- Email notification to you on each new lead
- Admin UI to browse leads (for now: view via Lovable Cloud → Database → `leads` table, or export CSV)

## Technical notes
- Phone is stored as free-form text (no E.164 normalization) to keep friction low; basic length check 7–20 chars.
- Email stored lowercased; unique index on `lower(email)` prevents duplicates.
- Insert uses the Supabase JS client with the anon key — RLS allows insert only.
- `localStorage` gate is intentionally client-side and bypassable; this is a **lead-capture gate**, not a security boundary. All dashboard data tables already allow public read, so no data is being newly exposed.
- No changes to existing auth (admin login on `/auth` remains for weekly-commentary editing).
