export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      daily_tasks: {
        Row: {
          completed_at: string
          id: string
          task_type: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          task_type: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          task_type?: string
          user_id?: string
        }
        Relationships: []
      }
      mining_boosts: {
        Row: {
          created_at: string
          duration: number
          expires_at: string | null
          id: string
          multiplier: number
          price: number
          status: string
          ton_tx: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration: number
          expires_at?: string | null
          id?: string
          multiplier: number
          price: number
          status?: string
          ton_tx?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          duration?: number
          expires_at?: string | null
          id?: string
          multiplier?: number
          price?: number
          status?: string
          ton_tx?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_paid: number
          created_at: string
          id: string
          task_type: string
          telegram_id: string
          transaction_hash: string | null
          wallet_address: string
        }
        Insert: {
          amount_paid: number
          created_at?: string
          id?: string
          task_type: string
          telegram_id: string
          transaction_hash?: string | null
          wallet_address: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          id?: string
          task_type?: string
          telegram_id?: string
          transaction_hash?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      tasks_completed: {
        Row: {
          id: string
          is_done: boolean
          task_id: string
          tx_hash: string | null
          user_id: string
          verified_at: string | null
        }
        Insert: {
          id?: string
          is_done?: boolean
          task_id: string
          tx_hash?: string | null
          user_id: string
          verified_at?: string | null
        }
        Update: {
          id?: string
          is_done?: boolean
          task_id?: string
          tx_hash?: string | null
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          balance: number | null
          daily: Json | null
          firstname: string | null
          fortune_cookies: number | null
          id: string
          ismining: boolean | null
          ispremium: boolean | null
          languagecode: string | null
          last_seen_at: string | null
          lastname: string | null
          links: string | null
          minerate: number | null
          miningstartedtime: string | null
          referrals: Json | null
          username: string | null
        }
        Insert: {
          balance?: number | null
          daily?: Json | null
          firstname?: string | null
          fortune_cookies?: number | null
          id?: string
          ismining?: boolean | null
          ispremium?: boolean | null
          languagecode?: string | null
          last_seen_at?: string | null
          lastname?: string | null
          links?: string | null
          minerate?: number | null
          miningstartedtime?: string | null
          referrals?: Json | null
          username?: string | null
        }
        Update: {
          balance?: number | null
          daily?: Json | null
          firstname?: string | null
          fortune_cookies?: number | null
          id?: string
          ismining?: boolean | null
          ispremium?: boolean | null
          languagecode?: string | null
          last_seen_at?: string | null
          lastname?: string | null
          links?: string | null
          minerate?: number | null
          miningstartedtime?: string | null
          referrals?: Json | null
          username?: string | null
        }
        Relationships: []
      }
      wallets: {
        Row: {
          created_at: string
          id: string
          telegram_id: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          id?: string
          telegram_id: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          id?: string
          telegram_id?: string
          wallet_address?: string
        }
        Relationships: []
      }
      wheel_spins: {
        Row: {
          created_at: string
          id: string
          prize_amount: number
          prize_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          prize_amount: number
          prize_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          prize_amount?: number
          prize_type?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_fortune_cookies: {
        Args: { p_user_id: string; p_cookie_count: number }
        Returns: undefined
      }
      can_do_daily_task: {
        Args: { p_user_id: string; p_task_type: string }
        Returns: boolean
      }
      can_free_wheel_spin: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      create_get_wallet_connections_function: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_insert_payment_function: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_save_wallet_connection_function: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_wallet_connections: {
        Args: Record<PropertyKey, never>
        Returns: {
          telegram_id: string
          wallet_address: string
        }[]
      }
      insert_payment: {
        Args: {
          p_telegram_id: string
          p_wallet_address: string
          p_amount_paid: number
          p_task_type: string
          p_transaction_hash?: string
        }
        Returns: undefined
      }
      save_wallet_connection: {
        Args: { p_telegram_id: string; p_wallet_address: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
