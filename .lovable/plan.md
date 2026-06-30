# Institutional Indicators + Re-weighted Cycle Gauge

## Goal
Surface 10 institutional on-chain indicators on the dashboard. Source what's available from the free Coin Metrics community API today. Re-weight the Cycle Gauge to blend the new metrics. Re-validate every historical pivot so the gauge backtest still holds.

## Data sourcing map

| Indicator | Source now | Status |
|---|---|---|
| MVRV | Coin Metrics `CapMVRVCur` | Already live |
| Realized Price | Coin Metrics `CapRealUSD / SplyCur` | New, full history (2010+) |
| NUPL | `(CapMrktCurUSD − CapRealUSD) / CapMrktCurUSD` | New, full history |
| Puell Multiple | `IssTotUSD / 365d MA(IssTotUSD)` | New, full history |
| Reserve Risk (proxy) | `Price / (MVRV × Realized Price)` proxy band | New, proxy only — labelled in UI |
| LTH-SOPR | — | Awaiting paid feed (Glassnode/CryptoQuant) |
| Exchange Inflows | — | Awaiting paid feed |
| Exchange Outflows | — | Awaiting paid feed |
| Whale Accumulation | — | Awaiting paid feed |
| Whale Distribution | — | Awaiting paid feed |

Five of the ten will display "Awaiting data feed" with a clear note that Glassnode/CryptoQuant is required.

## Implementation

### 1. Schema migration
Add columns to `dashboard_snapshots`:
`realized_price`, `nupl`, `reserve_risk`, `exchange_inflow`, `exchange_outflow`, `whale_accumulation`, `whale_distribution` (all nullable numeric). `puell_value` and `lth_sopr_value` already exist.

### 2. `daily-pipeline` edge function
Extend the Coin Metrics fetch to pull `CapRealUSD`, `SplyCur`, `CapMrktCurUSD`, `IssTotUSD` alongside the existing series. Compute Realized Price, NUPL, Puell Multiple, and the Reserve Risk proxy on the server; write to the new columns.

### 3. `recompute-snapshots` edge function
Backfill the four new metrics over the full ~4,200-day history.

### 4. Re-weighted Cycle Gauge (`src/lib/scoring.ts`)
Replace the 4-pillar model with a 6-pillar weighted blend:
- MVRV 20%
- NUPL 20%
- Puell 15%
- Reserve Risk proxy 10%
- BTC vs 200W MA 20%
- Fear & Greed 15%
Each pillar contributes 0–4 points; total scales to 0–20. Phase thresholds stay (Deep Value / Accumulation / Bull / Overheated / Cycle Top Risk).

### 5. Re-validate history
Re-run `recompute-snapshots` with the new engine and verify:
- Oct 2025 ATH still classifies as Cycle Top Risk
- Nov 2022 ATL still classifies as Deep Value
- 2017, 2021 cycle peaks still flag Cycle Top Risk
- Dec 2018 still flags Deep Value

### 6. New `InstitutionalIndicators.tsx` panel
Grid of 10 cards. Each card shows:
- **Current value** — latest snapshot
- **Historical value** — same metric 30 days ago, with WoW arrow
- **Interpretation** — Bullish / Neutral / Bearish derived from metric-specific bands (e.g. NUPL > 0.75 = Bearish Euphoria, < 0 = Bullish Capitulation)
- **Historical percentile** — rank of today's value vs full history (0–100%)
- **Confidence score** — `High` (full daily history), `Medium` (≥1 year), `Low` (<1 year), `No data` (awaiting feed)

Awaiting-feed cards render greyed out with a "Requires Glassnode" tag.

### 7. Wire into Dashboard
Insert the panel between the Score Breakdown and the Cycle Timeline. Lazy-load it.

## Validation report
After deploy I'll print: per-metric coverage (rows populated), per-pillar score distribution before vs after the re-weight, and the pivot-validation table (ATH/ATL classifications before vs after).

## Out of scope
- Wiring a paid feed for exchange flows, whale cohorts, and LTH-SOPR — needs your API key + subscription decision.
- Per-indicator alerting.
