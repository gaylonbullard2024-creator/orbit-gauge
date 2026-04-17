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
      <DashboardHeader />

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

        <CoreIndicators
          isLoading={isLoading}
          snapshot={snapshot}
          prevSnapshot={prevSnapshot}
          fgHistory={fgHistory}
          maHistory={maHistory}
          rainbowHistory={rainbowHistory}
          macroHistory={macroHistory}
          mvrvHistory={mvrvHistory}
        />

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
