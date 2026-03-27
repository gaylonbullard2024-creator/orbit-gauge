import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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

const MACRO_TABLE = [
  { condition: 'Dollar strengthening', impact: 'BTC Pressure', icon: TrendingDown, impactColor: 'hsl(0, 72%, 51%)' },
  { condition: 'Dollar weakening', impact: 'BTC Bullish', icon: TrendingUp, impactColor: 'hsl(152, 60%, 40%)' },
  { condition: 'Liquidity expansion', impact: 'Risk Assets Rise', icon: TrendingUp, impactColor: 'hsl(152, 60%, 40%)' },
  { condition: 'Liquidity tightening', impact: 'Risk Assets Fall', icon: TrendingDown, impactColor: 'hsl(0, 72%, 51%)' },
];

export function MacroPanel({ dxyValue, macroScore, regime }: MacroPanelProps) {
  const color = getRegimeColor(regime);
  const RegimeIcon = regime === 'Supportive' ? TrendingUp : regime === 'Restrictive' ? TrendingDown : Minus;

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <span className="text-lg">🌐</span>
            Global Liquidity & Dollar Index
          </CardTitle>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[250px] text-xs">
                Bitcoin is heavily influenced by global liquidity cycles. When the dollar weakens and liquidity expands, Bitcoin tends to rally.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Key metrics row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">DXY / Dollar Index</p>
            <p className="font-mono text-2xl font-bold">{dxyValue ? dxyValue.toFixed(2) : '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Macro Score</p>
            <p className="font-mono text-2xl font-bold">{macroScore} / 4</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Current Regime</p>
            <div className="flex items-center gap-2">
              <RegimeIcon className="h-4 w-4" style={{ color }} />
              <span
                className="inline-block rounded-full px-3 py-1 text-sm font-semibold"
                style={{ backgroundColor: color + '22', color }}
              >
                {regime}
              </span>
            </div>
          </div>
        </div>

        {/* Interpretation table */}
        <div>
          <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">How Macro Affects BTC</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {MACRO_TABLE.map((row) => {
              const Icon = row.icon;
              return (
                <div
                  key={row.condition}
                  className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2 text-sm"
                >
                  <span className="text-muted-foreground">{row.condition}</span>
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" style={{ color: row.impactColor }} />
                    <span className="font-medium text-xs" style={{ color: row.impactColor }}>
                      {row.impact}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
