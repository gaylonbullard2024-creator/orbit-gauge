

# Rainbow Chart Visual Overhaul

## Current Problems
- Only 5 bands — the classic rainbow chart uses 8-9 distinct color bands
- Bands are nearly invisible (`fillOpacity: 0.15`) — reference images show solid, opaque bands
- Y-axis is linear — should be logarithmic to match the classic curved rainbow shape
- Color palette doesn't follow the full rainbow spectrum (dark blue → blue → green → yellow → orange → red → dark red)

## Changes (single file: `src/components/dashboard/RainbowChart.tsx`)

### 1. Expand to 9 rainbow bands with true rainbow colors
```
Maximum Bubble Territory  →  dark red (#882255)
Sell. Seriously, SELL!    →  red (#DC143C)
FOMO Intensifies          →  orange-red (#FF4500)
Is this a bubble?         →  orange (#FF8C00)
HODL!                     →  yellow (#FFD700)
Still Cheap               →  green-yellow (#9ACD32)
Accumulate                →  green (#2E8B57)
BUY!                      →  teal (#20B2AA)
Fire Sale                 →  dark blue (#1E3A8A)
```

### 2. Make bands solid and opaque
- Change `fillOpacity` from `0.15` to `0.85` for rich, saturated bands
- This matches the reference images where bands are clearly visible

### 3. Logarithmic Y-axis
- Set `YAxis scale="log" domain={['auto', 'auto']}` so bands curve naturally upward
- Tick formatter stays as `$Xk` format

### 4. Update band generation multipliers
- 9 bands with tighter spacing to create the smooth rainbow gradient
- Multipliers range from `0.3x` (fire sale floor) to `3.0x` (bubble ceiling)

### 5. Update legend
- Compact 9-band legend in 3×3 grid on desktop, scrollable on mobile
- Each band shows color swatch + label

### 6. Price line styling
- White line with slight glow for contrast against colored bands

## No other files changed. No database changes.

