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
      ai_chat_messages: {
        Row: {
          character_id: string
          created_at: string
          id: string
          role: string
          text: string
          wallet: string
        }
        Insert: {
          character_id: string
          created_at?: string
          id?: string
          role?: string
          text: string
          wallet: string
        }
        Update: {
          character_id?: string
          created_at?: string
          id?: string
          role?: string
          text?: string
          wallet?: string
        }
        Relationships: []
      }
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
      chat_moderation: {
        Row: {
          last_message_at: string | null
          last_normalized_text: string | null
          muted_until: string | null
          profanity_count: number
          submission_times: string[]
          updated_at: string
          wallet: string
          warning_window_started_at: string | null
        }
        Insert: {
          last_message_at?: string | null
          last_normalized_text?: string | null
          muted_until?: string | null
          profanity_count?: number
          submission_times?: string[]
          updated_at?: string
          wallet: string
          warning_window_started_at?: string | null
        }
        Update: {
          last_message_at?: string | null
          last_normalized_text?: string | null
          muted_until?: string | null
          profanity_count?: number
          submission_times?: string[]
          updated_at?: string
          wallet?: string
          warning_window_started_at?: string | null
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
      credit_purchases: {
        Row: {
          amount: number
          attempts: number
          chats: number
          created_at: string
          id: string
          keys: number
          kind: string
          memo: string
          pack_id: string | null
          rooms: number
          status: string
          token: string
          tx_hash: string | null
          updated_at: string
          wallet: string
        }
        Insert: {
          amount: number
          attempts?: number
          chats?: number
          created_at?: string
          id?: string
          keys?: number
          kind: string
          memo: string
          pack_id?: string | null
          rooms?: number
          status?: string
          token: string
          tx_hash?: string | null
          updated_at?: string
          wallet: string
        }
        Update: {
          amount?: number
          attempts?: number
          chats?: number
          created_at?: string
          id?: string
          keys?: number
          kind?: string
          memo?: string
          pack_id?: string | null
          rooms?: number
          status?: string
          token?: string
          tx_hash?: string | null
          updated_at?: string
          wallet?: string
        }
        Relationships: []
      }
      daily_claims: {
        Row: {
          claim_date: string
          created_at: string
          id: string
          wallet: string
        }
        Insert: {
          claim_date: string
          created_at?: string
          id?: string
          wallet: string
        }
        Update: {
          claim_date?: string
          created_at?: string
          id?: string
          wallet?: string
        }
        Relationships: []
      }
      daily_visits: {
        Row: {
          created_at: string
          id: string
          link_id: string
          visit_date: string
          wallet: string
        }
        Insert: {
          created_at?: string
          id?: string
          link_id: string
          visit_date?: string
          wallet: string
        }
        Update: {
          created_at?: string
          id?: string
          link_id?: string
          visit_date?: string
          wallet?: string
        }
        Relationships: []
      }
      game_run_sessions: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          game_slug: string
          id: string
          league_id: string | null
          seed: number
          wallet: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          game_slug: string
          id?: string
          league_id?: string | null
          seed: number
          wallet: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          game_slug?: string
          id?: string
          league_id?: string | null
          seed?: number
          wallet?: string
        }
        Relationships: []
      }
      league_deposits: {
        Row: {
          amount: number
          created_at: string
          id: string
          league_id: string
          tx_hash: string
          wallet: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          league_id: string
          tx_hash: string
          wallet: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          league_id?: string
          tx_hash?: string
          wallet?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_deposits_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_payouts: {
        Row: {
          amount: number
          claimed_at: string
          id: string
          league_id: string
          ranks: number[]
          status: string
          to_address: string
          tx_hash: string | null
          wallet: string
        }
        Insert: {
          amount: number
          claimed_at?: string
          id?: string
          league_id: string
          ranks?: number[]
          status?: string
          to_address: string
          tx_hash?: string | null
          wallet: string
        }
        Update: {
          amount?: number
          claimed_at?: string
          id?: string
          league_id?: string
          ranks?: number[]
          status?: string
          to_address?: string
          tx_hash?: string | null
          wallet?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_payouts_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_pending_deposits: {
        Row: {
          amount: number
          attempts: number
          created_at: string
          id: string
          league_id: string
          status: string
          token: string
          tx_hash: string
          updated_at: string
          wallet: string
        }
        Insert: {
          amount: number
          attempts?: number
          created_at?: string
          id?: string
          league_id: string
          status?: string
          token?: string
          tx_hash: string
          updated_at?: string
          wallet: string
        }
        Update: {
          amount?: number
          attempts?: number
          created_at?: string
          id?: string
          league_id?: string
          status?: string
          token?: string
          tx_hash?: string
          updated_at?: string
          wallet?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_pending_deposits_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_scores: {
        Row: {
          best: number
          id: string
          league_id: string
          updated_at: string
          wallet: string
        }
        Insert: {
          best: number
          id?: string
          league_id: string
          updated_at?: string
          wallet: string
        }
        Update: {
          best?: number
          id?: string
          league_id?: string
          updated_at?: string
          wallet?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_scores_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          created_at: string
          creator_wallet: string
          ends_at: string
          game_slug: string
          id: string
          payout: string
          pool: number
          starts_at: string
          status: string
          title: string
          token: string
        }
        Insert: {
          created_at?: string
          creator_wallet: string
          ends_at: string
          game_slug: string
          id?: string
          payout?: string
          pool?: number
          starts_at: string
          status?: string
          title: string
          token?: string
        }
        Update: {
          created_at?: string
          creator_wallet?: string
          ends_at?: string
          game_slug?: string
          id?: string
          payout?: string
          pool?: number
          starts_at?: string
          status?: string
          title?: string
          token?: string
        }
        Relationships: []
      }
      mp_moves: {
        Row: {
          created_at: string
          id: string
          kind: string
          payload: Json
          room_id: string
          turn_no: number
          wallet: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          room_id: string
          turn_no: number
          wallet: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          room_id?: string
          turn_no?: number
          wallet?: string
        }
        Relationships: [
          {
            foreignKeyName: "mp_moves_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "mp_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      mp_queue: {
        Row: {
          game_slug: string
          heartbeat_at: string
          id: string
          joined_at: string
          max_players: number
          rank_hint: number
          room_id: string | null
          settings: Json
          wallet: string
        }
        Insert: {
          game_slug: string
          heartbeat_at?: string
          id?: string
          joined_at?: string
          max_players?: number
          rank_hint?: number
          room_id?: string | null
          settings?: Json
          wallet: string
        }
        Update: {
          game_slug?: string
          heartbeat_at?: string
          id?: string
          joined_at?: string
          max_players?: number
          rank_hint?: number
          room_id?: string | null
          settings?: Json
          wallet?: string
        }
        Relationships: []
      }
      mp_room_players: {
        Row: {
          id: string
          joined_at: string
          room_id: string
          score: number
          seat: number
          stats: Json
          status: string
          updated_at: string
          wallet: string
        }
        Insert: {
          id?: string
          joined_at?: string
          room_id: string
          score?: number
          seat?: number
          stats?: Json
          status?: string
          updated_at?: string
          wallet: string
        }
        Update: {
          id?: string
          joined_at?: string
          room_id?: string
          score?: number
          seat?: number
          stats?: Json
          status?: string
          updated_at?: string
          wallet?: string
        }
        Relationships: [
          {
            foreignKeyName: "mp_room_players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "mp_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      mp_rooms: {
        Row: {
          code: string | null
          created_at: string
          ends_at: string | null
          game_slug: string
          host_wallet: string
          id: string
          kind: string
          max_players: number
          settings: Json
          started_at: string | null
          status: string
          turn_no: number
          turn_started_at: string
          turn_wallet: string | null
          updated_at: string
          winner_wallet: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          ends_at?: string | null
          game_slug: string
          host_wallet: string
          id?: string
          kind?: string
          max_players?: number
          settings?: Json
          started_at?: string | null
          status?: string
          turn_no?: number
          turn_started_at?: string
          turn_wallet?: string | null
          updated_at?: string
          winner_wallet?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          ends_at?: string | null
          game_slug?: string
          host_wallet?: string
          id?: string
          kind?: string
          max_players?: number
          settings?: Json
          started_at?: string | null
          status?: string
          turn_no?: number
          turn_started_at?: string
          turn_wallet?: string | null
          updated_at?: string
          winner_wallet?: string | null
        }
        Relationships: []
      }
      mp_ticks: {
        Row: {
          alive: boolean
          dir: number
          room_id: string
          score: number
          updated_at: string
          wallet: string
          x: number
          y: number
        }
        Insert: {
          alive?: boolean
          dir?: number
          room_id: string
          score?: number
          updated_at?: string
          wallet: string
          x?: number
          y?: number
        }
        Update: {
          alive?: boolean
          dir?: number
          room_id?: string
          score?: number
          updated_at?: string
          wallet?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "mp_ticks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "mp_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      nim_payments: {
        Row: {
          chat_credits: number
          created_at: string
          id: string
          key_credits: number
          kind: string
          nim: number
          room_credits: number
          tx_hash: string
          wallet: string
        }
        Insert: {
          chat_credits?: number
          created_at?: string
          id?: string
          key_credits?: number
          kind: string
          nim: number
          room_credits?: number
          tx_hash: string
          wallet: string
        }
        Update: {
          chat_credits?: number
          created_at?: string
          id?: string
          key_credits?: number
          kind?: string
          nim?: number
          room_credits?: number
          tx_hash?: string
          wallet?: string
        }
        Relationships: []
      }
      player_sessions: {
        Row: {
          created_at: string
          expires_at: string
          token: string
          token_hash: string | null
          wallet: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          token?: string
          token_hash?: string | null
          wallet: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          token?: string
          token_hash?: string | null
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
          entry_cost: string
          guest_seen_at: string
          guest_wallet: string | null
          host_seen_at: string
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
          entry_cost?: string
          guest_seen_at?: string
          guest_wallet?: string | null
          host_seen_at?: string
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
          entry_cost?: string
          guest_seen_at?: string
          guest_wallet?: string | null
          host_seen_at?: string
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
      village_letters: {
        Row: {
          amount: number
          created_at: string
          from_wallet: string
          id: string
          message: string
          opened_at: string | null
          to_address: string
          to_chain: string
          token: string
          tx_hash: string | null
          usdt_to: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          from_wallet: string
          id?: string
          message: string
          opened_at?: string | null
          to_address: string
          to_chain?: string
          token?: string
          tx_hash?: string | null
          usdt_to?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          from_wallet?: string
          id?: string
          message?: string
          opened_at?: string | null
          to_address?: string
          to_chain?: string
          token?: string
          tx_hash?: string | null
          usdt_to?: string | null
        }
        Relationships: []
      }
      wallet_credits: {
        Row: {
          chat_credits: number
          free_chats_date: string | null
          free_chats_used: number
          free_keys_date: string | null
          match_keys: number
          room_credits: number
          updated_at: string
          wallet: string
        }
        Insert: {
          chat_credits?: number
          free_chats_date?: string | null
          free_chats_used?: number
          free_keys_date?: string | null
          match_keys?: number
          room_credits?: number
          updated_at?: string
          wallet: string
        }
        Update: {
          chat_credits?: number
          free_chats_date?: string | null
          free_chats_used?: number
          free_keys_date?: string | null
          match_keys?: number
          room_credits?: number
          updated_at?: string
          wallet?: string
        }
        Relationships: []
      }
      wallet_login_challenges: {
        Row: {
          challenge: string
          created_at: string
          expires_at: string
          id: string
          used_at: string | null
          wallet: string
        }
        Insert: {
          challenge: string
          created_at?: string
          expires_at: string
          id?: string
          used_at?: string | null
          wallet: string
        }
        Update: {
          challenge?: string
          created_at?: string
          expires_at?: string
          id?: string
          used_at?: string | null
          wallet?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_league_deposit: {
        Args: {
          p_amount: number
          p_league: string
          p_tx: string
          p_wallet: string
        }
        Returns: number
      }
      confirm_credit_purchase: { Args: { p_id: string }; Returns: string }
      confirm_league_deposit: { Args: { p_pending: string }; Returns: number }
      disarm_league_deposit_checker: { Args: never; Returns: undefined }
      moderate_chat_submission: {
        Args: {
          _is_profane: boolean
          _normalized_text: string
          _wallet: string
        }
        Returns: Json
      }
      spend_match_key: { Args: { p_wallet: string }; Returns: boolean }
      spend_room_credit: { Args: { p_wallet: string }; Returns: boolean }
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
