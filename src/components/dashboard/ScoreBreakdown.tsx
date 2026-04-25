import { Heart, Gauge, TrendingUp, Rainbow, Globe } from 'lucide-react';
import type { DashboardSnapshot } from '@/hooks/useDashboard';

interface ScoreBreakdownProps {
  snapshot: DashboardSnapshot;
  totalScore: number;
  maxScore: number;
}

interface ComponentRow {
  key: string;
  label: string;
  category: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  value: string;
  score: number | null;
  maxScore: number;
  description: string;
}

function scoreBarColor(score: number | null): string {
  if (score == null) return 'hsl(215, 15%, 35%)';
  if (score <= 1) return 'hsl(152, 60%, 40%)';
  if (score <= 2) return 'hsl(45, 90%, 50%)';
  if (score <= 3) return 'hsl(28, 90%, 55%)';
  return 'hsl(0, 72%, 51%)';
}

function fgInterpretation(value: number | null): string {
  if (value == null) return '—';
  if (value <= 25) return 'Extreme Fear — contrarian bullish';
  if (value <= 40) return 'Fear — favorable accumulation';
  if (value <= 60) return 'Neutral sentiment';
  if (value <= 75) return 'Greed — caution rising';
  return 'Extreme Greed — distribution risk';
}

function mvrvInterpretation(value: number | null): string {
  if (value == null) return 'Awaiting data';
  if (value < 1) return 'Below realized value — undervalued';
  if (value <= 2) return 'Fair value range';
  if (value <= 3.5) return 'Mid-cycle valuation';
  if (value <= 5) return 'Elevated — late-cycle';
  return 'Overvalued — top risk';
}

function maInterpretation(price: number | null, ma: number | null): string {
  if (price == null || ma == null) return '—';
  const pct = ((price / ma) - 1) * 100;
  if (pct < 0) return `Below 200W MA (${pct.toFixed(0)}%) — bear regime`;
  if (pct <= 25) return `+${pct.toFixed(0)}% over 200W MA — early uptrend`;
  if (pct <= 75) return `+${pct.toFixed(0)}% over 200W MA — confirmed bull`;
  if (pct <= 150) return `+${pct.toFixed(0)}% over 200W MA — extended`;
  return `+${pct.toFixed(0)}% over 200W MA — euphoric`;
}

function macroInterpretation(value: number | null): string {
  if (value == null) return '—';
  if (value < 95) return 'Weak USD — supportive';
  if (value < 100) return 'Soft USD — favorable';
  if (value < 105) return 'Neutral USD';
  if (value < 110) return 'Strong USD — headwind';
  return 'Very strong USD — restrictive';
}

export function ScoreBreakdown({ snapshot, totalScore, maxScore }: ScoreBreakdownProps) {
  const hasMvrv = snapshot.mvrv_score != null;

  const rows: ComponentRow[] = [
    {
      key: 'sentiment',
      label: 'Fear & Greed',
      category: 'Sentiment',
      icon: Heart,
      value: snapshot.fear_greed_value != null ? `${snapshot.fear_greed_value}` : '—',
      score: snapshot.fear_greed_score ?? null,
      maxScore: 4,
      description: fgInterpretation(snapshot.fear_greed_value),
    },
    {
      key: 'valuation',
      label: 'MVRV Ratio',
      category: 'Valuation',
      icon: Gauge,
      value: snapshot.mvrv_value != null ? Number(snapshot.mvrv_value).toFixed(2) : 'N/A',
      score: snapshot.mvrv_score ?? null,
      maxScore: 4,
      description: mvrvInterpretation(snapshot.mvrv_value != null ? Number(snapshot.mvrv_value) : null),
    },
    {
      key: 'trend',
      label: '200W Moving Avg',
      category: 'Trend',
      icon: TrendingUp,
      value: snapshot.ma_200w_value != null ? `$${Number(snapshot.ma_200w_value).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—',
      score: snapshot.ma_200w_score ?? null,
      maxScore: 4,
      description: maInterpretation(
        snapshot.btc_close_usd != null ? Number(snapshot.btc_close_usd) : null,
        snapshot.ma_200w_value != null ? Number(snapshot.ma_200w_value) : null,
      ),
    },
    {
      key: 'supply',
      label: 'Rainbow Model',
      category: 'Supply / Cycle',
      icon: Rainbow,
      value: snapshot.rainbow_band ?? '—',
      score: snapshot.rainbow_score ?? null,
      maxScore: 4,
      description: snapshot.rainbow_band ? `Currently in "${snapshot.rainbow_band}" band` : '—',
    },
    {
      key: 'macro',
      label: 'Macro / DXY',
      category: 'Macro',
      icon: Globe,
      value: snapshot.macro_value != null ? Number(snapshot.macro_value).toFixed(2) : '—',
      score: snapshot.macro_score ?? null,
      maxScore: 4,
      description: macroInterpretation(snapshot.macro_value != null ? Number(snapshot.macro_value) : null),
    },
  ];

  return (
    <section className="rounded-2xl border border-border/50 bg-card/50 p-4 sm:p-6">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          Score Breakdown
        </h2>
        <div className="font-mono text-xs text-muted-foreground">
          Total: <span className="text-foreground font-semibold">{totalScore}</span>
          <span className="text-muted-foreground/60"> / {maxScore}</span>
          {!hasMvrv && (
            <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground/60">
              · MVRV pending
            </span>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border/40">
        {/* Header row — desktop only */}
        <div className="hidden sm:grid grid-cols-12 gap-3 px-4 py-2 bg-muted/30 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <div className="col-span-3">Component</div>
          <div className="col-span-2">Category</div>
          <div className="col-span-2 text-right">Value</div>
          <div className="col-span-2">Score</div>
          <div className="col-span-3">Interpretation</div>
        </div>

        <div className="divide-y divide-border/40">
          {rows.map((row) => {
            const Icon = row.icon;
            const color = scoreBarColor(row.score);
            const pct = row.score != null ? (row.score / row.maxScore) * 100 : 0;
            return (
              <div
                key={row.key}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 px-4 py-3 items-center hover:bg-muted/20 transition-colors"
              >
                <div className="sm:col-span-3 flex items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0" style={{ color }} />
                  <span className="text-sm font-medium text-foreground">{row.label}</span>
                </div>
                <div className="sm:col-span-2 text-xs text-muted-foreground">
                  {row.category}
                </div>
                <div className="sm:col-span-2 sm:text-right font-mono text-sm text-foreground">
                  {row.value}
                </div>
                <div className="sm:col-span-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden min-w-[40px]">
                    <div
                      className="h-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {row.score != null ? `${row.score}/${row.maxScore}` : '—'}
                  </span>
                </div>
                <div className="sm:col-span-3 text-xs text-muted-foreground leading-snug">
                  {row.description}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground/70 leading-relaxed">
        Each component contributes 0–4 points. The total score drives the Cycle Gauge phase classification.
        Lower scores generally indicate accumulation opportunities; higher scores indicate distribution risk.
      </p>
    </section>
  );
}
