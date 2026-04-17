// Auth removed — dashboard is public for now
import {
  useLatestSnapshot,
  usePreviousSnapshot,
  useLatestWeeklyReport,
  useFearGreedHistory,
  useBtcPriceHistory,
  useFullBtcPriceHistory,
  useSnapshotHistory,
} from '@/hooks/useDashboard';
import { CycleGauge } from '@/components/dashboard/CycleGauge';
import { IndicatorCard } from '@/components/dashboard/IndicatorCard';
import { FearGreedGauge } from '@/components/dashboard/FearGreedGauge';
import { MacroPanel } from '@/components/dashboard/MacroPanel';
import { RainbowChart } from '@/components/dashboard/RainbowChart';
import { PriceTrendChart } from '@/components/dashboard/PriceTrendChart';
import { WeeklyCommentary } from '@/components/dashboard/WeeklyCommentary';
import { WeeklySummaryCard } from '@/components/dashboard/WeeklySummaryCard';
import { CycleTimeline } from '@/components/dashboard/CycleTimeline';
import { WeeklyChanges } from '@/components/dashboard/WeeklyChanges';
import { PhaseHistory } from '@/components/dashboard/PhaseHistory';
import { UserGuide } from '@/components/dashboard/UserGuide';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import {
  getStatusLabel,
  getStatusColor,
  getPhaseColor,
  mapPhaseToStrategy,
  mapPhaseToAction,
  calculateSignalStrength,
  INDICATOR_TOOLTIPS,
} from '@/lib/scoring';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo } from 'react';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { data: snapshot, isLoading } = useLatestSnapshot();
  const { data: prevSnapshot } = usePreviousSnapshot();
  const { data: report } = useLatestWeeklyReport();
  const { data: fgHistory } = useFearGreedHistory();
  const { data: btcHistory } = useBtcPriceHistory();
  const { data: btcFullHistory } = useFullBtcPriceHistory();
  const { data: snapHistory } = useSnapshotHistory();

  const hasMvrv = snapshot?.mvrv_score != null;
  const maxScore = hasMvrv ? 20 : 16;
  const totalScore = snapshot?.cycle_total_score ?? 0;
  const phase = snapshot?.cycle_phase ?? 'Bull Trend';
  const strategy = snapshot?.strategy_signal ?? mapPhaseToStrategy(phase);
  const action = mapPhaseToAction(phase);

  const signalStrength = useMemo(
    () =>
      calculateSignalStrength([
        snapshot?.fear_greed_score ?? null,
        snapshot?.mvrv_score ?? null,
        snapshot?.ma_200w_score ?? null,
        snapshot?.rainbow_score ?? null,
        snapshot?.macro_score ?? null,
      ]),
    [snapshot]
  );

  const scoreDelta = useMemo(() => {
    if (snapshot?.cycle_total_score == null || prevSnapshot?.cycle_total_score == null) return null;
    return snapshot.cycle_total_score - prevSnapshot.cycle_total_score;
  }, [snapshot, prevSnapshot]);

  const maHistory = useMemo(
    () => (snapHistory ?? []).filter((s) => s.ma_200w_value != null).map((s) => ({ date: s.date, value: Number(s.ma_200w_value) })),
    [snapHistory]
  );
  const rainbowHistory = useMemo(
    () => (snapHistory ?? []).filter((s) => s.rainbow_score != null).map((s) => ({ date: s.date, value: s.rainbow_score! })),
    [snapHistory]
  );
  const macroHistory = useMemo(
    () => (snapHistory ?? []).filter((s) => s.macro_value != null).map((s) => ({ date: s.date, value: Number(s.macro_value) })),
    [snapHistory]
  );
  const mvrvHistory = useMemo(
    () => (snapHistory ?? []).filter((s) => s.mvrv_value != null).map((s) => ({ date: s.date, value: Number(s.mvrv_value) })),
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
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-primary/10">
              <span className="text-base sm:text-lg font-bold text-primary">₿</span>
            </div>
            <h1 className="text-sm sm:text-lg font-semibold">MCG Bitcoin Cycle Dashboard</h1>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <UserGuide />
            {user && (
              <>
                <span className="hidden sm:inline text-xs text-muted-foreground truncate max-w-[200px]">
                  {user.email}
                </span>
                <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign out</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 py-4 space-y-4 sm:px-4 sm:py-8 sm:space-y-8">
        {/* Hero Cycle Gauge */}
        <section className="rounded-2xl border border-border/50 bg-card/50 p-4 sm:p-6 md:p-10">
          <h2 className="text-center text-sm font-medium uppercase tracking-widest text-muted-foreground mb-6">
            Bitcoin Market Signal
          </h2>
          {isLoading ? (
            <div className="flex flex-col items-center gap-4">
              <Skeleton className="h-48 w-full max-w-md" />
              <Skeleton className="h-8 w-32" />
            </div>
          ) : (
            <CycleGauge
              score={totalScore}
              maxScore={maxScore}
              phase={phase}
              strategy={strategy}
              action={action}
              signalStrength={signalStrength}
              scoreDelta={scoreDelta}
            />
          )}
        </section>

        {/* Weekly Summary */}
        {!isLoading && snapshot && (
          <section>
            <WeeklySummaryCard
              snapshot={snapshot}
              previousSnapshot={prevSnapshot ?? null}
              signalStrength={signalStrength}
            />
          </section>
        )}

        {/* Core Indicators */}
        <section>
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground mb-4">
            Core Indicators
            <span className="ml-2 text-[10px] text-muted-foreground/50 normal-case tracking-normal">
              Click a card to expand chart
            </span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-44" />)
            ) : (
              <>
                <FearGreedGauge
                  value={snapshot?.fear_greed_value ?? 0}
                  score={snapshot?.fear_greed_score ?? 0}
                  history={fgHistory}
                  tooltip={INDICATOR_TOOLTIPS['Fear & Greed']}
                  previousValue={prevSnapshot?.fear_greed_value}
                  previousScore={prevSnapshot?.fear_greed_score}
                />
                <IndicatorCard
                  title="MVRV Ratio"
                  value={snapshot?.mvrv_value ? Number(snapshot.mvrv_value).toFixed(2) : '—'}
                  score={snapshot?.mvrv_score ?? 0}
                  maxScore={4}
                  status={hasMvrv ? getStatusLabel(snapshot?.mvrv_score ?? 2) : 'Awaiting Data'}
                  statusColor={hasMvrv ? getStatusColor(snapshot?.mvrv_score ?? 2) : 'hsl(215, 15%, 55%)'}
                  icon="📊"
                  disabled={!hasMvrv}
                  history={mvrvHistory}
                  chartLabel="MVRV Ratio"
                  formatValue={(v) => v.toFixed(2)}
                  tooltip={INDICATOR_TOOLTIPS['MVRV Ratio']}
                  previousValue={prevSnapshot?.mvrv_value ? Number(prevSnapshot.mvrv_value).toFixed(2) : null}
                  previousScore={prevSnapshot?.mvrv_score}
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
                  tooltip={INDICATOR_TOOLTIPS['200W Moving Avg']}
                  previousValue={prevSnapshot?.ma_200w_value ? `$${Number(prevSnapshot.ma_200w_value).toLocaleString()}` : null}
                  previousScore={prevSnapshot?.ma_200w_score}
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
                  tooltip={INDICATOR_TOOLTIPS['Rainbow Model']}
                  previousValue={prevSnapshot?.rainbow_band}
                  previousScore={prevSnapshot?.rainbow_score}
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
                  tooltip={INDICATOR_TOOLTIPS['Macro / DXY']}
                  previousValue={prevSnapshot?.macro_value ? Number(prevSnapshot.macro_value).toFixed(2) : null}
                  previousScore={prevSnapshot?.macro_score}
                />
              </>
            )}
          </div>
        </section>

        {/* Cycle Score Timeline */}
        {snapHistory && snapHistory.length > 1 && (
          <section>
            <CycleTimeline snapshots={snapHistory} />
          </section>
        )}

        {/* BTC Price vs 200W MA */}
        <section>
          <PriceTrendChart priceHistory={btcHistory ?? []} maHistory={maHistory} />
        </section>

        {/* Rainbow Chart */}
        <section>
          <RainbowChart priceHistory={btcFullHistory ?? btcHistory ?? []} currentBand={snapshot?.rainbow_band ?? null} />
        </section>
        {!isLoading && snapshot && prevSnapshot && (
          <section>
            <WeeklyChanges snapshot={snapshot} previousSnapshot={prevSnapshot} />
          </section>
        )}

        {/* Macro Environment */}
        <section>
          <MacroPanel
            dxyValue={snapshot?.macro_value ? Number(snapshot.macro_value) : null}
            macroScore={snapshot?.macro_score ?? 0}
            regime={getMacroRegime(snapshot?.macro_score ?? null)}
          />
        </section>

        {/* Phase History */}
        {snapHistory && snapHistory.length > 1 && (
          <section>
            <PhaseHistory snapshots={snapHistory} />
          </section>
        )}

        {/* Weekly Commentary */}
        <section>
          <WeeklyCommentary
            headline={report?.headline ?? null}
            markdown={report?.summary_markdown ?? null}
            weekEnding={report?.week_ending ?? null}
          />
        </section>

        <footer className="text-center py-6 text-xs text-muted-foreground/50">
          <p>Data refreshed daily ~6 AM ET · Not financial advice</p>
          <p className="mt-1">© {new Date().getFullYear()} MCG · The Crypto Investors</p>
        </footer>
      </main>
    </div>
  );
}
