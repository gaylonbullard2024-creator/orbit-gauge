import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface IndicatorCardProps {
  title: string;
  value: string | number;
  score: number;
  maxScore: number;
  status: string;
  statusColor: string;
  icon: string;
  subtitle?: string;
  disabled?: boolean;
}

export function IndicatorCard({
  title,
  value,
  score,
  maxScore,
  status,
  statusColor,
  icon,
  subtitle,
  disabled,
}: IndicatorCardProps) {
  return (
    <Card className={`border-border/50 bg-card/80 transition-all hover:border-primary/30 ${disabled ? 'opacity-50' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <span className="text-lg">{icon}</span>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold text-foreground">
            {disabled ? '—' : value}
          </span>
          {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        </div>
        <div className="flex items-center justify-between">
          <span
            className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{ backgroundColor: statusColor + '22', color: statusColor }}
          >
            {disabled ? 'Coming Soon' : status}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {disabled ? '—' : score} / {maxScore}
          </span>
        </div>
        {/* Score bar */}
        <div className="h-1.5 w-full rounded-full bg-secondary">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: disabled ? '0%' : `${(score / maxScore) * 100}%`,
              backgroundColor: statusColor,
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
