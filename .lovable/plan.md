

# Dashboard v2 Upgrade Plan

## Overview
A comprehensive upgrade to make the dashboard feel institutional, actionable, and alive — transforming raw data into clear investor signals.

---

## 1. Hero Cycle Gauge Redesign
**Current:** Small gauge with score/phase/strategy text below.
**New:** Large full-width hero speedometer dominating the top of the page.
- Bigger SVG gauge (wider arc, thicker bands)
- Score prominently centered inside the gauge (e.g., "11/16")
- Phase badge below gauge
- Clear action text: "Hold / Accumulate on dips"
- Week-over-week score change arrow (e.g., "↑1 from last week")

**File:** `src/components/dashboard/CycleGauge.tsx`

---

## 2. Weekly Summary Card (New Component)
Placed immediately after the hero gauge, before indicator cards.
- "This Week's Summary" header
- Current phase badge + signal strength
- 2-3 auto-generated bullet insights (derived from snapshot comparison)
- Key change highlight (e.g., "Sentiment improved from Fear to Neutral")

**New file:** `src/components/dashboard/WeeklySummaryCard.tsx`

---

## 3. Week-over-Week Change Indicators
Fetch the previous day's snapshot (or last week's) alongside the latest.
- Each indicator card shows delta: `48 → 55 ↑` with green/red coloring
- Score change shown as small badge
- Gauge shows overall score change

**Files:** `src/hooks/useDashboard.ts` (add `usePreviousSnapshot` hook), `src/components/dashboard/IndicatorCard.tsx`, `src/pages/Dashboard.tsx`

---

## 4. Signal Strength / Confidence Indicator
Calculate based on indicator agreement:
- **High** — 4+ of 5 indicators agree on direction
- **Medium** — 3 of 5 agree
- **Low** — mixed signals

Displayed as a badge on the hero gauge and weekly summary card.

**File:** `src/lib/scoring.ts` (new function), displayed in `CycleGauge.tsx`

---

## 5. Indicator Tooltips
Add an "i" icon (Lucide `Info`) next to each indicator title.
On hover, show a one-line explanation:
- Fear & Greed: "Measures market sentiment (0-100)"
- MVRV Ratio: "Market value vs realized value — detects over/undervaluation"
- 200W MA: "Long-term trend support level"
- Rainbow: "Logarithmic price band model"
- Macro/DXY: "Dollar strength — lower = better for BTC"

Uses existing Radix tooltip component.

**File:** `src/components/dashboard/IndicatorCard.tsx`

---

## 6. Historical Cycle Score Timeline
New chart section showing cycle score over time (from `dashboard_snapshots`).
- X-axis: time, Y-axis: cycle score (0-20)
- Background color bands for each phase zone
- Annotated markers for historical tops/bottoms if data supports it

**New file:** `src/components/dashboard/CycleTimeline.tsx`

---

## 7. "What Changed This Week" Section
Auto-generated from comparing current vs previous snapshot:
- "Sentiment moved from Fear to Neutral"
- "Price crossed above 200W MA"
- "MVRV entered overheated zone"

Logic compares phase transitions, score changes, and threshold crossings.

**New file:** `src/components/dashboard/WeeklyChanges.tsx`

---

## 8. Market Phase History List
Simple chronological list derived from snapshots:
- Groups by month, shows phase for each month
- Format: "Jan 2026 → Accumulation", "Feb 2026 → Bull Trend"

**New file:** `src/components/dashboard/PhaseHistory.tsx`

---

## 9. Partial Public Dashboard / Paywall Gate
**Scoping needed** — will define which sections are visible publicly vs gated:
- Option A: Show gauge + phase publicly, lock indicators + commentary
- Option B: Show everything blurred with CTA overlay
- This will be planned separately after confirming the approach with you.

---

## 10. UI Refinements (Already Mostly Done)
The dark institutional theme (charcoal/black, white text, orange accents) is already in place. Minor polish:
- Ensure all new components use the existing design tokens
- Consistent card styling across new sections

---

## Updated Dashboard Layout Order
```text
┌─────────────────────────────────┐
│  Header                         │
├─────────────────────────────────┤
│  Hero Cycle Gauge (enlarged)    │
│  Score + Phase + Action + Δ     │
│  Signal Strength badge          │
├─────────────────────────────────┤
│  Weekly Summary Card            │
│  Phase · Key change · Bullets   │
├─────────────────────────────────┤
│  Core Indicators (5 cards)      │
│  Each with Δ + tooltip          │
├─────────────────────────────────┤
│  Cycle Score Timeline Chart     │
├─────────────────────────────────┤
│  BTC Price vs 200W MA           │
├─────────────────────────────────┤
│  What Changed This Week         │
├─────────────────────────────────┤
│  Macro Environment              │
├─────────────────────────────────┤
│  Phase History List             │
├─────────────────────────────────┤
│  Weekly Commentary (full)       │
├─────────────────────────────────┤
│  Footer                         │
└─────────────────────────────────┘
```

## Database Changes
- **None required.** All new features derive from existing `dashboard_snapshots` data. The `usePreviousSnapshot` hook just fetches the second-most-recent row.

## Implementation Order
1. Hero gauge redesign + signal strength
2. Previous snapshot hook + delta indicators
3. Weekly summary card + "What Changed"
4. Indicator tooltips
5. Cycle timeline chart
6. Phase history list
7. Paywall gate (scoping discussion first)

