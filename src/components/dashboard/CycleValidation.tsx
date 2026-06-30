import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  buildCurrentPivot,
  computeSimilarity,
  fetchPivotSnapshots,
  type PivotSnapshot,
  type SimilarityResult,
} from '@/lib/cycleValidation';
import type { DashboardSnapshot } from '@/hooks/useDashboard';

interface Props {
  latest: DashboardSnapshot | null | undefined;
}

const fmtUSD = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 1 : 2)}k` : `$${n.toFixed(2)}`;
const fmtNum = (n: number | null, digits = 2) =>
  n == null ? '—' : Number(n).toFixed(digits);

export function CycleValidation({ latest }: Props) {
  const { data: pivots, isLoading } = useQuery({
    queryKey: ['cycle-pivots'],
    queryFn: fetchPivotSnapshots,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const current = useMemo(
    () => (latest ? buildCurrentPivot(latest as any) : null),
    [latest],
  );

  const results = useMemo<SimilarityResult[]>(() => {
    if (!current || !pivots) return [];
    return pivots
      .map((p) => computeSimilarity(current, p))
      .sort((a, b) => b.similarity - a.similarity);
  }, [current, pivots]);

  const best = results[0];

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <span className="text-lg">🔁</span>
          Historical Cycle Validation
        </CardTitle>
        <p className="text-xs text-muted-foreground/70">
          Every recorded BTC cycle ATH and ATL, scored against today's market fingerprint.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading || !current || !pivots ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <>
            {best && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="text-[10px] uppercase tracking-widest text-primary/80">
                  Closest historical analogue
                </div>
                <div className="mt-1 flex items-baseline gap-3">
                  <div className="text-xl font-semibold text-foreground">{best.pivot.label}</div>
                  <div className="text-sm text-muted-foreground">{best.pivot.date}</div>
                  <div className="ml-auto text-2xl font-bold text-primary">{best.similarity}%</div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Today's market most closely resembles the <strong>{best.pivot.label}</strong>{' '}
                  ({best.pivot.kind} at {fmtUSD(best.pivot.btc_close_usd)}). Composite similarity
                  is calculated from price/200W-MA ratio, MVRV, Fear &amp; Greed, Puell, LTH-SOPR
                  and the classified market phase — weighted equally over the metrics available
                  for both dates.
                </p>
              </div>
            )}

            {/* Today fingerprint */}
            <FingerprintRow title="Today" pivot={current} highlight />

            {/* Ranked historical comparisons */}
            <div className="space-y-3">
              {results.map((r) => (
                <div
                  key={r.pivot.label}
                  className="rounded-lg border border-border/50 bg-muted/20 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {r.pivot.label}
                        </span>
                        <span
                          className={`text-[10px] font-medium uppercase tracking-wider ${
                            r.pivot.kind === 'ATH' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {r.pivot.kind}
                        </span>
                        <span className="text-xs text-muted-foreground">{r.pivot.date}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        BTC {fmtUSD(r.pivot.btc_close_usd)} · MVRV {fmtNum(r.pivot.mvrv_value)} ·
                        P/MA {fmtNum(r.pivot.price_to_ma_ratio)} · F&amp;G{' '}
                        {r.pivot.fear_greed_value ?? '—'} · Phase {r.pivot.cycle_phase ?? '—'}
                      </div>
                    </div>
                    <div className="w-24 text-right">
                      <div className="text-lg font-bold text-foreground">{r.similarity}%</div>
                      <Progress value={r.similarity} className="mt-1 h-1.5" />
                    </div>
                  </div>

                  {/* Component breakdown */}
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] sm:grid-cols-3">
                    {Object.entries(r.componentScores).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between">
                        <span className="text-muted-foreground/80">{k}</span>
                        <span className="font-mono text-foreground/90">{v.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-muted-foreground/60">
              Note: Puell Multiple, LTH-SOPR, on-chain whale activity and exchange flows require
              paid on-chain feeds and are not yet populated in the snapshot table; those signals
              are skipped automatically when missing and similarity is averaged over the available
              components only.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FingerprintRow({
  title,
  pivot,
  highlight,
}: {
  title: string;
  pivot: PivotSnapshot;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        highlight ? 'border-primary/40 bg-primary/5' : 'border-border/50 bg-muted/20'
      }`}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">{pivot.date}</span>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] sm:grid-cols-4">
        <Cell k="BTC" v={fmtUSD(pivot.btc_close_usd)} />
        <Cell k="200W MA" v={pivot.ma_200w_value ? fmtUSD(pivot.ma_200w_value) : '—'} />
        <Cell k="P / 200W MA" v={fmtNum(pivot.price_to_ma_ratio)} />
        <Cell k="MVRV" v={fmtNum(pivot.mvrv_value)} />
        <Cell k="Fear & Greed" v={pivot.fear_greed_value?.toString() ?? '—'} />
        <Cell k="Puell" v={fmtNum(pivot.puell_value)} />
        <Cell k="LTH-SOPR" v={fmtNum(pivot.lth_sopr_value)} />
        <Cell k="Phase" v={pivot.cycle_phase ?? '—'} />
      </div>
    </div>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground/80">{k}</span>
      <span className="font-mono text-foreground/90 truncate">{v}</span>
    </div>
  );
}
