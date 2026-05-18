## Add BTC Power Law to Dashboard

Add the Power Law model (Burger/PlanB) as a new chart and indicator card on the dashboard, mirroring how Rainbow Chart and the Core Indicators already work.

### Formula (computed client-side, no new data needed)
```
days = (today - 2009-01-03) / 86400000
log10_fv = 5.82 * log10(days) - 17.01
fair_value = 10^log10_fv
bands = 10^(log10_fv ± n*0.46)   for n = 1, 2, 3
z_score = (log10(price) - log10_fv) / 0.46
```
Inputs A=5.82, B=−17.01, σ=0.46 stored as constants in `src/lib/powerLaw.ts`.

### Score mapping (0–4, matches other indicators)
Based on z-score relative to fair value:
- z ≥ +2 → 0 (Cycle Top Risk)
- +1 ≤ z < +2 → 1 (Overheated)
- −1 ≤ z < +1 → 2 (Fair)
- −2 ≤ z < −1 → 3 (Accumulation)
- z < −2 → 4 (Deep Value)

### Files to add
1. **`src/lib/powerLaw.ts`** — constants + helpers: `computePowerLaw(date)`, `computeZScore(price, date)`, `powerLawScore(z)`, `powerLawStatus(z)`.
2. **`src/components/dashboard/PowerLawChart.tsx`** — log-scale chart (Recharts) showing BTC price line + fair value + ±1σ/±2σ/±3σ bands with filled regions, matching `RainbowChart` styling. Uses `useFullBtcPriceHistory()`.
3. **`src/components/dashboard/PowerLawCard.tsx`** *(optional, simpler: reuse `IndicatorCard`)* — small card showing current z-score, fair value, premium/discount %, and status pill.

### Files to edit
1. **`src/pages/Dashboard.tsx`** — add `<PowerLawChart />` section below `<RainbowChart />`, and inject Power Law into `<CoreIndicators />` via a new prop.
2. **`src/components/dashboard/CoreIndicators.tsx`** — add a 6th `IndicatorCard` for "Power Law" (z-score value, score, status). Grid becomes `lg:grid-cols-3` or `lg:grid-cols-6` — will use `lg:grid-cols-3 xl:grid-cols-6` for readability.
3. **`src/lib/scoring.ts`** — add `'Power Law'` tooltip entry to `INDICATOR_TOOLTIPS`.

### Scope decisions (frontend-only)
- **No DB changes.** Power Law is fully derivable from existing `btc_daily_prices` + today's date, so we compute it in the browser. No pipeline / migration / edge function changes.
- **Not added to cycle_total_score** in this pass — the gauge formula stays at max 20 (with MVRV) to avoid silently shifting historic scores. We can fold it in as a follow-up if you want a max-24 gauge.
- Background "overbought/oversold" highlighting and the right-edge labels from the Pine script are translated into the chart's legend + the indicator card status.

### Visual style
- Dark institutional theme, BTC orange for fair value line, semantic tokens only.
- Bands use translucent fills (green near fair, amber ±2σ, red ±3σ top, blue ±3σ bottom) — same palette intent as the Pine script, themed via `hsl(var(--*))`.
- Log Y-axis (consistent with Rainbow Chart).

### Out of scope
- Adding Power Law to the cycle gauge total.
- Storing daily Power Law values in `dashboard_snapshots`.
- Weekly report / email mentions of Power Law.

Want me to also (a) include Power Law in the cycle total score, or (b) keep it purely informational like above?