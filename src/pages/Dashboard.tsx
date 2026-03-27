import { useAuth } from '@/lib/auth';
import {
  useLatestSnapshot,
  useLatestWeeklyReport,
  useFearGreedHistory,
  useBtcPriceHistory,
  useMacroHistory,
  useSnapshotHistory,
} from '@/hooks/useDashboard';
import { CycleGauge } from '@/components/dashboard/CycleGauge';
import { IndicatorCard } from '@/components/dashboard/IndicatorCard';
import { MacroPanel } from '@/components/dashboard/MacroPanel';
import { PriceTrendChart } from '@/components/dashboard/PriceTrendChart';
import { WeeklyCommentary } from '@/components/dashboard/WeeklyCommentary';
import { Button } from '@/components/ui/button';
import { getStatusLabel, getStatusColor, getPhaseColor, mapPhaseToStrategy } from '@/lib/scoring';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo } from 'react';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { data: snapshot, isLoading } = useLatestSnapshot();
  const { data: report } = useLatestWeeklyReport();
  const { data: fgHistory } = useFearGreedHistory();
  const { data: btcHistory } = useBtcPriceHistory();
  const { data: snapHistory } = useSnapshotHistory();

  const hasMvrv = snapshot?.mvrv_score != null;
  const maxScore = hasMvrv ? 20 : 16;
  const totalScore = snapshot?.cycle_total_score ?? 0;
  const phase = snapshot?.cycle_phase ?? 'Bull Trend';
  const strategy = snapshot?.strategy_signal ?? mapPhaseToStrategy(phase);

  // Derive 200W MA history and Rainbow history from snapshots
  const maHistory = useMemo(
    () => (snapHistory ?? [])
      .filter((s) => s.ma_200w_value != null)
      .map((s) => ({ date: s.date, value: Number(s.ma_200w_value) })),
    [snapHistory]
  );

  const rainbowHistory = useMemo(
    () => (snapHistory ?? [])
      .filter((s) => s.rainbow_score != null)
      .map((s) => ({ date: s.date, value: s.rainbow_score! })),
    [snapHistory]
  );

  function getMacroRegime(score: number | null): string {
    if (score == null) return 'Neutral';
    if (score <= 1) return 'Supportive';
    if (score <= 2) return 'Neutral';
    return 'Restrictive';
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <span className="text-lg font-bold text-primary">₿</span>
            </div>
            <h1 className="text-lg font-semibold">MCG Bitcoin Cycle Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:block">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        {/* Section 1: Cycle Gauge */}
        <section className="rounded-2xl border border-border/50 bg-card/50 p-6 md:p-10">
          <h2 className="text-center text-sm font-medium uppercase tracking-widest text-muted-foreground mb-6">
            Bitcoin Market Signal
          </h2>
          {isLoading ? (
            <div className="flex flex-col items-center gap-4">
              <Skeleton className="h-48 w-full max-w-md" />
              <Skeleton className="h-8 w-32" />
            </div>
          ) : (
            <CycleGauge score={totalScore} maxScore={maxScore} phase={phase} strategy={strategy} />
          )}
        </section>

        {/* Section 2: Core Indicator Cards */}
        <section>
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground mb-4">
            Core Indicators
            <span className="ml-2 text-[10px] text-muted-foreground/50 normal-case tracking-normal">
              Click a card to expand chart
            </span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-44" />)
            ) : (
              <>
                <IndicatorCard
                  title="Fear & Greed"
                  value={snapshot?.fear_greed_value ?? 0}
                  score={snapshot?.fear_greed_score ?? 0}
                  maxScore={4}
                  status={getStatusLabel(snapshot?.fear_greed_score ?? 2)}
                  statusColor={getStatusColor(snapshot?.fear_greed_score ?? 2)}
                  icon="😱"
                  history={fgHistory}
                  chartLabel="Sentiment Score"
                />
                <IndicatorCard
                  title="MVRV Z-Score"
                  value={snapshot?.mvrv_value?.toString() ?? '—'}
                  score={snapshot?.mvrv_score ?? 0}
                  maxScore={4}
                  status="Coming Soon"
                  statusColor="hsl(215, 15%, 55%)"
                  icon="📊"
                  disabled={!hasMvrv}
                />
                <IndicatorCard
                  title="200W Moving Avg"
                  value={snapshot?.ma_200w_value ? `$${Number(snapshot.ma_200w_value).toLocaleString()}` : '—'}
                  score={snapshot?.ma_200w_score ?? 0}
                  maxScore={4}
                  status={getStatusLabel(snapshot?.ma_200w_score ?? 2)}
                  statusColor={getStatusColor(snapshot?.ma_200w_score ?? 2)}
                  icon="📈"
                  history={maHistory}
                  chartLabel="200W MA ($)"
                  formatValue={(v) => `$${v.toLocaleString()}`}
                />
                <IndicatorCard
                  title="Rainbow Model"
                  value={snapshot?.rainbow_band ?? '—'}
                  score={snapshot?.rainbow_score ?? 0}
                  maxScore={4}
                  status={snapshot?.rainbow_band ?? 'N/A'}
                  statusColor={getPhaseColor(snapshot?.cycle_phase ?? 'Bull Trend')}
                  icon="🌈"
                  history={rainbowHistory}
                  chartLabel="Rainbow Score"
                />
                <IndicatorCard
                  title="Macro / DXY"
                  value={snapshot?.macro_value ? Number(snapshot.macro_value).toFixed(2) : '—'}
                  score={snapshot?.macro_score ?? 0}
                  maxScore={4}
                  status={getMacroRegime(snapshot?.macro_score ?? null)}
                  statusColor={getStatusColor(snapshot?.macro_score ?? 2)}
                  icon="🌐"
                  history={macroHistory}
                  chartLabel="DXY Index"
                  formatValue={(v) => v.toFixed(2)}
                />
              </>
            )}
          </div>
        </section>

        {/* Section 3: BTC Price vs 200W MA */}
        <section>
          <PriceTrendChart priceHistory={btcHistory ?? []} maHistory={maHistory} />
        </section>

        {/* Section 4: Macro Environment */}
        <section>
          <MacroPanel
            dxyValue={snapshot?.macro_value ? Number(snapshot.macro_value) : null}
            macroScore={snapshot?.macro_score ?? 0}
            regime={getMacroRegime(snapshot?.macro_score ?? null)}
          />
        </section>

        {/* Section 4: Weekly Commentary */}
        <section>
          <WeeklyCommentary
            headline={report?.headline ?? null}
            markdown={report?.summary_markdown ?? null}
            weekEnding={report?.week_ending ?? null}
          />
        </section>

        {/* Footer */}
        <footer className="text-center py-6 text-xs text-muted-foreground/50">
          <p>Data refreshed daily ~6 AM ET · Not financial advice</p>
          <p className="mt-1">© {new Date().getFullYear()} MCG · The Crypto Investors</p>
        </footer>
      </main>
    </div>
  );
}
