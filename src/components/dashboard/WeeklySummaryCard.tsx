import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, TrendingUp } from 'lucide-react';
import type { DashboardSnapshot } from '@/hooks/useDashboard';
import { generateChangeDescriptions, mapPhaseToAction } from '@/lib/scoring';

interface WeeklySummaryCardProps {
  snapshot: DashboardSnapshot;
  previousSnapshot: DashboardSnapshot | null;
  signalStrength: { level: string; color: string };
}

export function WeeklySummaryCard({ snapshot, previousSnapshot, signalStrength }: WeeklySummaryCardProps) {
  const phase = snapshot.cycle_phase ?? 'Bull Trend';
  const action = mapPhaseToAction(phase);
  const changes = previousSnapshot
    ? generateChangeDescriptions(snapshot, previousSnapshot)
    : ['First snapshot — baseline established'];

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            This Week's Summary
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" style={{ color: signalStrength.color }} />
            <span className="text-xs font-medium" style={{ color: signalStrength.color }}>
              {signalStrength.level} Confidence
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">{action}</p>
            <p className="text-xs text-muted-foreground">Current Phase: {phase}</p>
          </div>
        </div>

        <div className="space-y-1.5 pl-1">
          {changes.slice(0, 4).map((change, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="text-primary mt-1 shrink-0">•</span>
              <span className="text-muted-foreground">{change}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
