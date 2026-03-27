export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      btc_daily_prices: {
        Row: {
          close_usd: number
          created_at: string
          date: string
          market_cap_usd: number | null
          source: string | null
          updated_at: string
          volume_usd: number | null
        }
        Insert: {
          close_usd: number
          created_at?: string
          date: string
          market_cap_usd?: number | null
          source?: string | null
          updated_at?: string
          volume_usd?: number | null
        }
        Update: {
          close_usd?: number
          created_at?: string
          date?: string
          market_cap_usd?: number | null
          source?: string | null
          updated_at?: string
          volume_usd?: number | null
        }
        Relationships: []
      }
      dashboard_snapshots: {
        Row: {
          btc_close_usd: number | null
          commentary_payload: Json | null
          created_at: string
          cycle_phase: string | null
          cycle_total_score: number | null
          date: string
          fear_greed_score: number | null
          fear_greed_value: number | null
          ma_200w_score: number | null
          ma_200w_value: number | null
          macro_score: number | null
          macro_value: number | null
          mvrv_score: number | null
          mvrv_value: number | null
          rainbow_band: string | null
          rainbow_score: number | null
          strategy_signal: string | null
          updated_at: string
        }
        Insert: {
          btc_close_usd?: number | null
          commentary_payload?: Json | null
          created_at?: string
          cycle_phase?: string | null
          cycle_total_score?: number | null
          date: string
          fear_greed_score?: number | null
          fear_greed_value?: number | null
          ma_200w_score?: number | null
          ma_200w_value?: number | null
          macro_score?: number | null
          macro_value?: number | null
          mvrv_score?: number | null
          mvrv_value?: number | null
          rainbow_band?: string | null
          rainbow_score?: number | null
          strategy_signal?: string | null
          updated_at?: string
        }
        Update: {
          btc_close_usd?: number | null
          commentary_payload?: Json | null
          created_at?: string
          cycle_phase?: string | null
          cycle_total_score?: number | null
          date?: string
          fear_greed_score?: number | null
          fear_greed_value?: number | null
          ma_200w_score?: number | null
          ma_200w_value?: number | null
          macro_score?: number | null
          macro_value?: number | null
          mvrv_score?: number | null
          mvrv_value?: number | null
          rainbow_band?: string | null
          rainbow_score?: number | null
          strategy_signal?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fear_greed_daily: {
        Row: {
          classification: string | null
          created_at: string
          date: string
          source: string | null
          updated_at: string
          value: number
        }
        Insert: {
          classification?: string | null
          created_at?: string
          date: string
          source?: string | null
          updated_at?: string
          value: number
        }
        Update: {
          classification?: string | null
          created_at?: string
          date?: string
          source?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      macro_series_daily: {
        Row: {
          created_at: string
          date: string
          series_id: string
          source: string | null
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          date: string
          series_id: string
          source?: string | null
          updated_at?: string
          value: number
        }
        Update: {
          created_at?: string
          date?: string
          series_id?: string
          source?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      onchain_metrics_daily: {
        Row: {
          created_at: string
          date: string
          metric_name: string
          source: string | null
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          date: string
          metric_name: string
          source?: string | null
          updated_at?: string
          value: number
        }
        Update: {
          created_at?: string
          date?: string
          metric_name?: string
          source?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weekly_reports: {
        Row: {
          created_at: string
          dashboard_snapshot_date: string | null
          email_payload: Json | null
          headline: string | null
          summary_markdown: string | null
          updated_at: string
          week_ending: string
        }
        Insert: {
          created_at?: string
          dashboard_snapshot_date?: string | null
          email_payload?: Json | null
          headline?: string | null
          summary_markdown?: string | null
          updated_at?: string
          week_ending: string
        }
        Update: {
          created_at?: string
          dashboard_snapshot_date?: string | null
          email_payload?: Json | null
          headline?: string | null
          summary_markdown?: string | null
          updated_at?: string
          week_ending?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_reports_dashboard_snapshot_date_fkey"
            columns: ["dashboard_snapshot_date"]
            isOneToOne: false
            referencedRelation: "dashboard_snapshots"
            referencedColumns: ["date"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
