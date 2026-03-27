import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MacroPanelProps {
  dxyValue: number | null;
  macroScore: number;
  regime: string;
}

function getRegimeColor(regime: string) {
  if (regime.toLowerCase().includes('supportive')) return 'hsl(152, 60%, 40%)';
  if (regime.toLowerCase().includes('restrictive')) return 'hsl(0, 72%, 51%)';
  return 'hsl(45, 90%, 50%)';
}

export function MacroPanel({ dxyValue, macroScore, regime }: MacroPanelProps) {
  const color = getRegimeColor(regime);
  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader>
        <CardTitle className="text-lg">Macro Environment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">DXY / Dollar Index</p>
            <p className="font-mono text-xl font-bold">{dxyValue ? dxyValue.toFixed(2) : '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Macro Score</p>
            <p className="font-mono text-xl font-bold">{macroScore} / 4</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Regime</p>
            <span
              className="inline-block rounded-full px-3 py-1 text-sm font-semibold"
              style={{ backgroundColor: color + '22', color }}
            >
              {regime}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
