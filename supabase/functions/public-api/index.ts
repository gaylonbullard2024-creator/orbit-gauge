import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, max-age=300',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function err(message: string, status = 400) {
  return json({ error: message }, status);
}

async function getLatestSnapshot() {
  const { data, error } = await supabase
    .from('dashboard_snapshots')
    .select('*')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getSnapshotHistory(days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase
    .from('dashboard_snapshots')
    .select('*')
    .gte('date', since.toISOString().split('T')[0])
    .order('date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function getBtcPrices(days: number | null) {
  let q = supabase.from('btc_daily_prices').select('date, close_usd').order('date', { ascending: true });
  if (days != null) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    q = q.gte('date', since.toISOString().split('T')[0]);
  }
  // Paginate past 1000-row default
  const pageSize = 1000;
  const all: { date: string; close_usd: number }[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await q.range(from, from + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    all.push(...page.map((d) => ({ date: d.date, close_usd: Number(d.close_usd) })));
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function getFearGreed(days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase
    .from('fear_greed_daily')
    .select('date, value, classification')
    .gte('date', since.toISOString().split('T')[0])
    .order('date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function getMacro(days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase
    .from('macro_series_daily')
    .select('date, series_id, value')
    .gte('date', since.toISOString().split('T')[0])
    .order('date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function getLatestWeeklyReport() {
  const { data, error } = await supabase
    .from('weekly_reports')
    .select('week_ending, headline, summary_markdown')
    .order('week_ending', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'GET') return err('Method not allowed', 405);

  const url = new URL(req.url);
  // Path after /functions/v1/public-api
  const segments = url.pathname.split('/').filter(Boolean);
  const idx = segments.indexOf('public-api');
  const route = idx >= 0 ? segments.slice(idx + 1).join('/') : '';
  const days = Math.max(1, Math.min(3650, Number(url.searchParams.get('days') ?? '365')));

  try {
    switch (route) {
      case '':
      case 'index': {
        return json({
          name: 'Bitcoin Cycle Dashboard API',
          version: '1.0',
          endpoints: {
            'GET /latest': 'Latest dashboard snapshot (score, phase, all indicators)',
            'GET /snapshots?days=365': 'Historical dashboard snapshots',
            'GET /btc-price?days=365': 'BTC daily close prices (omit days for full history)',
            'GET /fear-greed?days=365': 'Fear & Greed index history',
            'GET /macro?days=365': 'Macro (DXY) history',
            'GET /weekly-report': 'Latest weekly commentary',
            'GET /all?days=365': 'Everything in one response',
            'GET /health': 'Service status and last snapshot timestamp',
          },
          docs: 'https://orbit-gauge.lovable.app/api',
        });
      }
      case 'health': {
        const started = Date.now();
        const { data, error } = await supabase
          .from('dashboard_snapshots')
          .select('date, updated_at')
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle();
        const latencyMs = Date.now() - started;
        if (error) {
          return json({ status: 'degraded', error: error.message, latencyMs }, 503);
        }
        const lastDate = data?.date ?? null;
        const ageHours = lastDate
          ? (Date.now() - new Date(lastDate + 'T00:00:00Z').getTime()) / 3_600_000
          : null;
        const stale = ageHours == null || ageHours > 36;
        return json({
          status: stale ? 'stale' : 'ok',
          lastSnapshotDate: lastDate,
          lastSnapshotUpdatedAt: data?.updated_at ?? null,
          ageHours: ageHours != null ? Number(ageHours.toFixed(2)) : null,
          latencyMs,
          time: new Date().toISOString(),
        });
      }
      case 'latest':
        return json(await getLatestSnapshot());
      case 'snapshots':
        return json(await getSnapshotHistory(days));
      case 'btc-price': {
        const hasDays = url.searchParams.has('days');
        return json(await getBtcPrices(hasDays ? days : null));
      }
      case 'fear-greed':
        return json(await getFearGreed(days));
      case 'macro':
        return json(await getMacro(days));
      case 'weekly-report':
        return json(await getLatestWeeklyReport());
      case 'all': {
        const [latest, snapshots, fearGreed, macro, weekly] = await Promise.all([
          getLatestSnapshot(),
          getSnapshotHistory(days),
          getFearGreed(days),
          getMacro(days),
          getLatestWeeklyReport(),
        ]);
        return json({ latest, snapshots, fearGreed, macro, weeklyReport: weekly });
      }
      default:
        return err(`Unknown route: /${route}`, 404);
    }
  } catch (e) {
    console.error('public-api error', e);
    return err((e as Error).message ?? 'Internal error', 500);
  }
});
