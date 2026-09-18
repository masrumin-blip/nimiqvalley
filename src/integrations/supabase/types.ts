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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      chat_dms: {
        Row: {
          created_at: string
          from_wallet: string
          id: string
          pair_key: string
          text: string
          to_wallet: string
        }
        Insert: {
          created_at?: string
          from_wallet: string
          id?: string
          pair_key: string
          text: string
          to_wallet: string
        }
        Update: {
          created_at?: string
          from_wallet?: string
          id?: string
          pair_key?: string
          text?: string
          to_wallet?: string
        }
        Relationships: []
      }
      chat_friends: {
        Row: {
          created_at: string
          from_wallet: string
          id: string
          status: string
          to_wallet: string
        }
        Insert: {
          created_at?: string
          from_wallet: string
          id?: string
          status?: string
          to_wallet: string
        }
        Update: {
          created_at?: string
          from_wallet?: string
          id?: string
          status?: string
          to_wallet?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          created_at: string
          id: string
          kind: string
          text: string
          wallet: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          text: string
          wallet: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          text?: string
          wallet?: string
        }
        Relationships: []
      }
      chat_presence: {
        Row: {
          last_seen: string
          wallet: string
        }
        Insert: {
          last_seen?: string
          wallet: string
        }
        Update: {
          last_seen?: string
          wallet?: string
        }
        Relationships: []
      }
      chat_profiles: {
        Row: {
          bio: string
          discord: string
          dm_policy: string
          instagram: string
          twitter: string
          updated_at: string
          visibility: string
          wallet: string
        }
        Insert: {
          bio?: string
          discord?: string
          dm_policy?: string
          instagram?: string
          twitter?: string
          updated_at?: string
          visibility?: string
          wallet: string
        }
        Update: {
          bio?: string
          discord?: string
          dm_policy?: string
          instagram?: string
          twitter?: string
          updated_at?: string
          visibility?: string
          wallet?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          updated_at: string
          wallet: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          updated_at?: string
          wallet: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          updated_at?: string
          wallet?: string
        }
        Relationships: []
      }
      scores: {
        Row: {
          game_slug: string
          id: string
          updated_at: string
          value: number
          wallet: string
        }
        Insert: {
          game_slug: string
          id?: string
          updated_at?: string
          value: number
          wallet: string
        }
        Update: {
          game_slug?: string
          id?: string
          updated_at?: string
          value?: number
          wallet?: string
        }
        Relationships: [
          {
            foreignKeyName: "scores_wallet_fkey"
            columns: ["wallet"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["wallet"]
          },
        ]
      }
      soccer_matches: {
        Row: {
          code: string | null
          created_at: string
          guest_wallet: string | null
          host_wallet: string
          id: string
          kind: string
          status: string
          target_goals: number
          turn_no: number
          turn_started_at: string
          turn_wallet: string | null
          updated_at: string
          winner_wallet: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          guest_wallet?: string | null
          host_wallet: string
          id?: string
          kind?: string
          status?: string
          target_goals?: number
          turn_no?: number
          turn_started_at?: string
          turn_wallet?: string | null
          updated_at?: string
          winner_wallet?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          guest_wallet?: string | null
          host_wallet?: string
          id?: string
          kind?: string
          status?: string
          target_goals?: number
          turn_no?: number
          turn_started_at?: string
          turn_wallet?: string | null
          updated_at?: string
          winner_wallet?: string | null
        }
        Relationships: []
      }
      soccer_moves: {
        Row: {
          created_at: string
          id: string
          kind: string
          match_id: string
          piece: number
          turn_no: number
          vx: number
          vy: number
          wallet: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          match_id: string
          piece?: number
          turn_no: number
          vx?: number
          vy?: number
          wallet: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          match_id?: string
          piece?: number
          turn_no?: number
          vx?: number
          vy?: number
          wallet?: string
        }
        Relationships: [
          {
            foreignKeyName: "soccer_moves_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "soccer_matches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
