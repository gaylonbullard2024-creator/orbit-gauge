import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DashboardSnapshot {
  date: string;
  btc_close_usd: number | null;
  fear_greed_value: number | null;
  fear_greed_score: number | null;
  mvrv_value: number | null;
  mvrv_score: number | null;
  ma_200w_value: number | null;
  ma_200w_score: number | null;
  rainbow_band: string | null;
  rainbow_score: number | null;
  macro_value: number | null;
  macro_score: number | null;
  cycle_total_score: number | null;
  cycle_phase: string | null;
  strategy_signal: string | null;
}

export interface WeeklyReport {
  week_ending: string;
  headline: string | null;
  summary_markdown: string | null;
}

export function useLatestSnapshot() {
  return useQuery({
    queryKey: ['dashboard-snapshot-latest'],
    queryFn: async (): Promise<DashboardSnapshot | null> => {
      const { data, error } = await supabase
        .from('dashboard_snapshots')
        .select('*')
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useLatestWeeklyReport() {
  return useQuery({
    queryKey: ['weekly-report-latest'],
    queryFn: async (): Promise<WeeklyReport | null> => {
      const { data, error } = await supabase
        .from('weekly_reports')
        .select('week_ending, headline, summary_markdown')
        .order('week_ending', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
