import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { BookOpen } from 'lucide-react';

interface GuideSection {
  icon: string;
  title: string;
  what: string;
  how: string;
  read: { label: string; meaning: string }[];
}

const SECTIONS: GuideSection[] = [
  {
    icon: '🎯',
    title: 'Cycle Gauge (Main Signal)',
    what: 'A single 0–20 composite score that summarizes where Bitcoin sits in its market cycle, combining all five core indicators.',
    how: 'Each of the five indicators contributes 0–4 points. The total maps to one of five phases: Deep Value → Accumulation → Bull Trend → Overheated → Cycle Top Risk. The arrow shows week-over-week change.',
    read: [
      { label: '0–5 Deep Value', meaning: 'Historically the best time to accumulate. Extreme pessimism.' },
      { label: '6–9 Accumulation', meaning: 'Early uptrend. Add on pullbacks.' },
      { label: '10–13 Bull Trend', meaning: 'Healthy uptrend. Hold core allocation.' },
      { label: '14–17 Overheated', meaning: 'Reduce risk. Consider taking profits.' },
      { label: '18–20 Cycle Top Risk', meaning: 'Extreme caution. Trim or hedge positions.' },
    ],
  },
  {
    icon: '😨',
    title: 'Fear & Greed Index',
    what: 'Market sentiment indicator (0–100) from Alternative.me that blends volatility, momentum, social media, and dominance.',
    how: 'Contrarian signal: extreme fear often marks bottoms, extreme greed often marks tops.',
    read: [
      { label: '0–25 Extreme Fear', meaning: 'Often a buying opportunity.' },
      { label: '26–45 Fear', meaning: 'Cautious market.' },
      { label: '46–55 Neutral', meaning: 'Balanced sentiment.' },
      { label: '56–75 Greed', meaning: 'Optimism building.' },
      { label: '76–100 Extreme Greed', meaning: 'Overheated — consider trimming.' },
    ],
  },
  {
    icon: '📊',
    title: 'MVRV Ratio',
    what: 'Market Value to Realized Value — ratio of BTC market cap to the average cost basis of all coins on-chain.',
    how: 'Above 3.5 typically marks cycle tops, below 1.0 typically marks cycle bottoms.',
    read: [
      { label: '< 1.0', meaning: 'Undervalued zone — historical bottoms.' },
      { label: '1.0–2.0', meaning: 'Fair value / accumulation.' },
      { label: '2.0–3.5', meaning: 'Bull market fair-to-rich.' },
      { label: '> 3.5', meaning: 'Top-risk zone.' },
    ],
  },
  {
    icon: '📈',
    title: '200-Week Moving Average',
    what: 'Long-term trend anchor — average closing price over the last 200 weeks (~4 years, roughly one cycle).',
    how: 'Price above the 200W MA = structural bull market. Price below = bear market.',
    read: [
      { label: 'Price below 200W MA', meaning: 'Deep bear — rare accumulation zone.' },
      { label: '0–75% above', meaning: 'Early-to-mid bull trend.' },
      { label: '75–150% above', meaning: 'Mature bull — caution rising.' },
      { label: '> 150% above', meaning: 'Blow-off territory.' },
    ],
  },
  {
    icon: '🌈',
    title: 'Bitcoin Rainbow Chart',
    what: 'Logarithmic regression model that places price in one of 9 colored bands relative to its long-term growth curve.',
    how: 'Cool bands (blue/green) = undervalued. Warm bands (orange/red) = overvalued. The white line is BTC price.',
    read: [
      { label: 'Fire Sale / BUY! (blue/teal)', meaning: 'Generational accumulation zones.' },
      { label: 'Accumulate / Still Cheap (green)', meaning: 'Good risk/reward to add.' },
      { label: 'HODL! (yellow)', meaning: 'Hold core positions.' },
      { label: 'Is this a bubble? / FOMO (orange)', meaning: 'Take some profits.' },
      { label: 'SELL / Max Bubble (red/purple)', meaning: 'Extreme top risk.' },
    ],
  },
  {
    icon: '🌐',
    title: 'Macro / DXY',
    what: 'US Dollar Index — measures dollar strength vs a basket of major currencies. Inversely correlated with BTC.',
    how: 'A strong dollar (rising DXY) creates headwinds for BTC. A weakening dollar is supportive.',
    read: [
      { label: '< 95 Supportive', meaning: 'Weak dollar — tailwind for BTC.' },
      { label: '95–105 Neutral', meaning: 'Balanced macro backdrop.' },
      { label: '> 105 Restrictive', meaning: 'Strong dollar — headwind for BTC.' },
    ],
  },
  {
    icon: '💡',
    title: 'Signal Strength',
    what: 'Confidence meter showing how much the five indicators agree with each other.',
    how: 'High agreement = strong conviction signal. Mixed signals = wait for confirmation before acting.',
    read: [
      { label: 'Strong', meaning: 'Indicators align — high conviction.' },
      { label: 'Moderate', meaning: 'Majority agree — reasonable conviction.' },
      { label: 'Mixed', meaning: 'Divergent signals — stay patient.' },
    ],
  },
];

export function UserGuide() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <BookOpen className="h-4 w-4" />
          <span className="hidden sm:inline">Guide</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">User Manual</DialogTitle>
          <DialogDescription>
            How to read each gauge and indicator on the dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {SECTIONS.map((s) => (
            <section
              key={s.title}
              className="rounded-lg border border-border/50 bg-card/40 p-4"
            >
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <span className="text-lg">{s.icon}</span>
                {s.title}
              </h3>

              <div className="mt-3 space-y-2 text-xs sm:text-sm">
                <div>
                  <span className="font-medium text-foreground">What it is: </span>
                  <span className="text-muted-foreground">{s.what}</span>
                </div>
                <div>
                  <span className="font-medium text-foreground">How to use it: </span>
                  <span className="text-muted-foreground">{s.how}</span>
                </div>
              </div>

              <div className="mt-3 space-y-1.5">
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  How to read it
                </p>
                <ul className="space-y-1">
                  {s.read.map((r) => (
                    <li
                      key={r.label}
                      className="flex flex-col sm:flex-row sm:gap-3 text-xs"
                    >
                      <span className="font-medium text-foreground shrink-0 sm:w-52">
                        {r.label}
                      </span>
                      <span className="text-muted-foreground">{r.meaning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ))}

          <section className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <h3 className="text-sm font-semibold">Putting it together</h3>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground">
              No single indicator is perfect. The <strong className="text-foreground">Cycle Gauge</strong> combines
              all five to reduce noise. Use the <strong className="text-foreground">Signal Strength</strong> meter
              to judge confidence — act decisively when signals align, stay patient when they diverge.
              Data refreshes once daily (~6 AM ET). This dashboard is informational and not financial advice.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
