import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardSnapshot } from '@/hooks/useDashboard';
import { getPhaseColor } from '@/lib/scoring';
import { useMemo } from 'react';

interface PhaseHistoryProps {
  snapshots: DashboardSnapshot[];
}

interface MonthPhase {
  label: string;
  phase: string;
}

export function PhaseHistory({ snapshots }: PhaseHistoryProps) {
  const monthlyPhases = useMemo((): MonthPhase[] => {
    // Month-end snapshot: pick the LAST dated snapshot of each calendar month.
    const lastByMonth = new Map<string, { date: string; phase: string }>();
    for (const s of snapshots) {
      if (!s.cycle_phase) continue;
      const d = new Date(s.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const prev = lastByMonth.get(key);
      if (!prev || s.date > prev.date) {
        lastByMonth.set(key, { date: s.date, phase: s.cycle_phase });
      }
    }

    return Array.from(lastByMonth.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, v]) => {
        const d = new Date(key + '-01');
        return {
          label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          phase: v.phase,
        };
      });
  }, [snapshots]);

  if (monthlyPhases.length < 2) return null;

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <span className="text-lg">📅</span>
          Market Phase History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {monthlyPhases.map((mp) => {
            const color = getPhaseColor(mp.phase);
            return (
              <div key={mp.label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-mono text-xs">{mp.label}</span>
                <span
                  className="rounded-full px-3 py-0.5 text-xs font-semibold"
                  style={{ backgroundColor: color + '22', color }}
                >
                  {mp.phase}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
