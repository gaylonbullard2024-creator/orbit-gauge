import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import type { DashboardSnapshot } from '@/hooks/useDashboard';
import { generateChangeDescriptions } from '@/lib/scoring';

interface WeeklyChangesProps {
  snapshot: DashboardSnapshot;
  previousSnapshot: DashboardSnapshot | null;
}

export function WeeklyChanges({ snapshot, previousSnapshot }: WeeklyChangesProps) {
  if (!previousSnapshot) return null;

  const changes = generateChangeDescriptions(snapshot, previousSnapshot);

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <span className="text-lg">🔄</span>
          What Changed Since Last Snapshot
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {changes.map((change, i) => (
            <div key={i} className="flex items-start gap-2.5 text-sm">
              <ArrowRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span className="text-foreground/90">{change}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
