import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, XCircle, RefreshCw, Activity } from 'lucide-react';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

type ProviderStatus = {
  provider: string;
  status: 'ok' | 'degraded' | 'down' | 'unknown';
  last_success_at: string | null;
  last_error_at: string | null;
  last_error: string | null;
  last_checked_at: string;
  latency_ms: number | null;
  success_rate_24h: number | null;
  notes: string | null;
};

type LogEntry = {
  id: string;
  checked_at: string;
  provider: string;
  category: string;
  severity: 'info' | 'warning' | 'error';
  affected_date: string | null;
  field: string | null;
  observed: number | null;
  expected: number | null;
  message: string;
  rejected: boolean;
};

const STATUS_TONE: Record<string, { dot: string; label: string; badge: string }> = {
  ok:       { dot: 'bg-emerald-400',  label: 'Operational', badge: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' },
  degraded: { dot: 'bg-amber-400',    label: 'Degraded',    badge: 'border-amber-500/30 text-amber-400 bg-amber-500/10' },
  down:     { dot: 'bg-rose-500',     label: 'Down',        badge: 'border-rose-500/30 text-rose-400 bg-rose-500/10' },
  unknown:  { dot: 'bg-muted-foreground', label: 'Unknown', badge: 'border-border text-muted-foreground bg-muted/30' },
};

const SEV_ICON = {
  info:    <Activity className="h-3.5 w-3.5 text-sky-400" />,
  warning: <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />,
  error:   <XCircle className="h-3.5 w-3.5 text-rose-400" />,
};

const CATEGORY_LABEL: Record<string, string> = {
  timestamp:      'Timestamp',
  missing_candle: 'Missing candle',
  ath:            'ATH',
  atl:            'ATL',
  volume:         'Volume',
  range:          'Indicator range',
  provider_diff:  'Provider mismatch',
  fetch:          'Fetch error',
};

async function fetchStatus(): Promise<ProviderStatus[]> {
  const { data, error } = await supabase
    .from('data_provider_status')
    .select('*')
    .order('provider', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProviderStatus[];
}

async function fetchLog(): Promise<LogEntry[]> {
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data, error } = await supabase
    .from('data_integrity_log')
    .select('*')
    .gte('checked_at', since)
    .order('checked_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as LogEntry[];
}

export function DataIntegrityPanel() {
  const [running, setRunning] = useState(false);
  const status = useQuery({ queryKey: ['provider-status'], queryFn: fetchStatus, staleTime: 60_000, refetchInterval: 5 * 60_000 });
  const log = useQuery({ queryKey: ['integrity-log'], queryFn: fetchLog, staleTime: 60_000, refetchInterval: 5 * 60_000 });

  const runValidation = async () => {
    setRunning(true);
    try {
      await supabase.functions.invoke('validate-data', { body: {} });
      await Promise.all([status.refetch(), log.refetch()]);
    } finally {
      setRunning(false);
    }
  };

  const issues = log.data ?? [];
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warnCount  = issues.filter((i) => i.severity === 'warning').length;

  return (
    <Card className="bg-card/40 border border-border/60 p-4 md:p-6 space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h2 className="text-base md:text-lg font-semibold tracking-tight">Data Integrity Validator</h2>
          </div>
          <p className="text-xs text-muted-foreground/80 mt-1 max-w-2xl">
            Live health of every upstream provider. Validates timestamps, missing candles, ATH/ATL,
            volume, indicator ranges, and cross-provider price agreement on every data fetch.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {errorCount === 0 && warnCount === 0 ? (
            <Badge className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
              <CheckCircle2 className="h-3 w-3 mr-1" /> All checks passing
            </Badge>
          ) : (
            <>
              {errorCount > 0 && (
                <Badge className="border-rose-500/30 text-rose-400 bg-rose-500/10">
                  {errorCount} error{errorCount > 1 ? 's' : ''}
                </Badge>
              )}
              {warnCount > 0 && (
                <Badge className="border-amber-500/30 text-amber-400 bg-amber-500/10">
                  {warnCount} warning{warnCount > 1 ? 's' : ''}
                </Badge>
              )}
            </>
          )}
          <Button size="sm" variant="outline" onClick={runValidation} disabled={running}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${running ? 'animate-spin' : ''}`} />
            {running ? 'Validating…' : 'Run checks'}
          </Button>
        </div>
      </header>

      {/* Provider status grid */}
      <div>
        <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground/70 mb-2">Provider status</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(status.data ?? []).length === 0 && (
            <div className="col-span-full text-xs text-muted-foreground/60 italic">
              No status yet — click <span className="font-semibold">Run checks</span> to ping every provider.
            </div>
          )}
          {(status.data ?? []).map((p) => {
            const tone = STATUS_TONE[p.status] ?? STATUS_TONE.unknown;
            const last = p.last_checked_at ? formatDistanceToNow(new Date(p.last_checked_at), { addSuffix: true }) : '—';
            return (
              <div key={p.provider} className="rounded-lg border border-border/60 bg-background/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium tracking-tight truncate">{p.provider}</span>
                  <span className={`h-2 w-2 rounded-full ${tone.dot} shrink-0`} />
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${tone.badge}`}>{tone.label}</Badge>
                  {p.latency_ms != null && (
                    <span className="text-[10px] text-muted-foreground/70">{p.latency_ms} ms</span>
                  )}
                </div>
                <dl className="mt-2 space-y-0.5 text-[11px] text-muted-foreground/70">
                  <div className="flex justify-between gap-2">
                    <dt>Success 24h</dt>
                    <dd className="font-mono text-foreground/80">{p.success_rate_24h != null ? `${p.success_rate_24h}%` : '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Last checked</dt>
                    <dd className="truncate">{last}</dd>
                  </div>
                </dl>
                {p.last_error && p.status !== 'ok' && (
                  <p className="mt-1.5 text-[10px] text-rose-400/90 line-clamp-2" title={p.last_error}>{p.last_error}</p>
                )}
                {p.notes && p.status === 'ok' && (
                  <p className="mt-1.5 text-[10px] text-muted-foreground/60 truncate">{p.notes}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Issues log */}
      <div>
        <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground/70 mb-2">
          Recent inconsistencies <span className="text-muted-foreground/40">· last 7d</span>
        </h3>
        <div className="rounded-lg border border-border/60 bg-background/40 overflow-hidden">
          {issues.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground/60">
              <CheckCircle2 className="h-4 w-4 mx-auto mb-1.5 text-emerald-400" />
              No inconsistencies logged in the last 7 days.
            </div>
          ) : (
            <ul className="divide-y divide-border/40 max-h-80 overflow-y-auto">
              {issues.map((i) => (
                <li key={i.id} className="px-3 py-2 text-xs flex items-start gap-2.5">
                  <span className="mt-0.5 shrink-0">{SEV_ICON[i.severity]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-foreground/90 truncate">{i.message}</span>
                      {i.rejected && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-rose-500/40 text-rose-400 bg-rose-500/10">
                          Rejected
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground/70 flex flex-wrap gap-x-2 gap-y-0.5">
                      <span>{CATEGORY_LABEL[i.category] ?? i.category}</span>
                      <span>· {i.provider}</span>
                      {i.affected_date && <span>· {i.affected_date}</span>}
                      <span>· {formatDistanceToNow(new Date(i.checked_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

export default DataIntegrityPanel;
