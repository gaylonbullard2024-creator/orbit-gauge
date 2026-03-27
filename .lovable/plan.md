

## Bitcoin Cycle Dashboard MVP

A subscriber-only daily Bitcoin market dashboard that pulls data once per day, computes proprietary signals, and renders an institutional-grade investor tool.

### 1. Authentication & Access Control
- Login/signup pages for subscribers
- All dashboard content gated behind authentication
- Stripe integration for $999 subscription (can add later)

### 2. Database (Lovable Cloud / Postgres)
Six tables storing daily snapshots from day one:
- **btc_daily_prices** — CoinGecko daily BTC closes
- **fear_greed_daily** — Alternative.me sentiment scores
- **macro_series_daily** — FRED DXY/dollar data
- **onchain_metrics_daily** — Placeholder for Glassnode MVRV later
- **dashboard_snapshots** — Daily computed gauge scores + all indicator values
- **weekly_reports** — Weekly commentary + summary payloads

### 3. Daily Data Pipeline (Edge Functions)
One scheduled job (daily ~6 AM ET):
1. Fetch BTC price from CoinGecko
2. Fetch Fear & Greed from Alternative.me
3. Fetch DXY from FRED
4. Compute 200-week moving average (1400-day rolling avg)
5. Compute rainbow band position (log regression bands)
6. Score each indicator (0–4 scale per your rules)
7. Calculate Cycle Gauge total score → map to phase
8. Save snapshot to database

### 4. Read API Endpoints
- `GET /dashboard/latest` — today's full snapshot
- `GET /dashboard/history` — historical gauge scores
- `GET /indicators/{name}` — individual indicator + history
- `GET /reports/latest-weekly` — most recent weekly report

### 5. Dashboard UI — Four Sections

**Section 1: Bitcoin Cycle Gauge (hero)**
- Large semi-circular dial with 5 color-coded zones (Deep Value → Cycle Top Risk)
- Animated needle showing current position
- Current score, phase label, and strategy recommendation
- Score breakdown tiles below the gauge

**Section 2: Core Indicator Cards**
- 5 horizontal cards: Fear & Greed, MVRV (placeholder), 200W MA, Rainbow, Macro
- Each shows: current reading, status label, score contribution
- Expandable to reveal historical chart

**Section 3: Macro Environment Panel**
- DXY/dollar strength trend
- Macro regime label (Supportive / Neutral / Restrictive)

**Section 4: Weekly Commentary**
- Rendered markdown commentary (market summary, key developments, strategy)
- Admin editor for writing/updating the weekly note

### 6. Design
- Will match your existing company website branding (please share URL)
- Fallback: dark theme with Bitcoin orange accents, clean typography
- Mobile-responsive: sections stack vertically

### 7. What's NOT in MVP
- No live tick data or trading features
- No Glassnode MVRV (schema ready, add when budget approved)
- No AI predictions, derivatives, or social scraping
- No intraday alerts or push notifications

