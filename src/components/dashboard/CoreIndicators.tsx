import { Skeleton } from '@/components/ui/skeleton';
import { FearGreedGauge } from './FearGreedGauge';
import { IndicatorCard } from './IndicatorCard';
import {
  getStatusLabel,
  getStatusColor,
  getPhaseColor,
  INDICATOR_TOOLTIPS,
} from '@/lib/scoring';
import type { DashboardSnapshot, HistoricalPoint } from '@/hooks/useDashboard';

interface CoreIndicatorsProps {
  isLoading: boolean;
  snapshot: DashboardSnapshot | null | undefined;
  prevSnapshot: DashboardSnapshot | null | undefined;
  fgHistory: HistoricalPoint[] | undefined;
  maHistory: HistoricalPoint[];
  rainbowHistory: HistoricalPoint[];
  macroHistory: HistoricalPoint[];
  mvrvHistory: HistoricalPoint[];
}

function getMacroRegime(score: number | null): string {
  if (score == null) return 'Neutral';
  if (score <= 1) return 'Supportive';
  if (score <= 2) return 'Neutral';
  return 'Restrictive';
}

export function CoreIndicators({
  isLoading,
  snapshot,
  prevSnapshot,
  fgHistory,
  maHistory,
  rainbowHistory,
  macroHistory,
  mvrvHistory,
}: CoreIndicatorsProps) {
  const hasMvrv = snapshot?.mvrv_score != null;

  return (
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
  );
}
