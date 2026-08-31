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
      calorie_log: {
        Row: {
          calories: number
          consumed_at: string
          created_at: string
          id: string
          recipe_id: string | null
          recipe_title: string
          user_id: string
        }
        Insert: {
          calories: number
          consumed_at?: string
          created_at?: string
          id?: string
          recipe_id?: string | null
          recipe_title: string
          user_id: string
        }
        Update: {
          calories?: number
          consumed_at?: string
          created_at?: string
          id?: string
          recipe_id?: string | null
          recipe_title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calorie_log_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "user_recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_usage: {
        Row: {
          created_at: string
          id: string
          message_count: number
          reference_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_count?: number
          reference_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_count?: number
          reference_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      diet_plans: {
        Row: {
          created_at: string
          generated_plan: Json | null
          id: string
          objective: string
          profile_notes: string | null
          restrictions: string[] | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          generated_plan?: Json | null
          id?: string
          objective: string
          profile_notes?: string | null
          restrictions?: string[] | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          generated_plan?: Json | null
          id?: string
          objective?: string
          profile_notes?: string | null
          restrictions?: string[] | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pantry_items: {
        Row: {
          category: string
          created_at: string
          expires_at: string | null
          expires_in: number
          id: string
          name: string
          purchased_at: string | null
          quantity: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          expires_at?: string | null
          expires_in?: number
          id?: string
          name: string
          purchased_at?: string | null
          quantity?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          expires_at?: string | null
          expires_in?: number
          id?: string
          name?: string
          purchased_at?: string | null
          quantity?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      photo_recognition_requests: {
        Row: {
          created_at: string
          generated_recipe_id: string | null
          id: string
          image_url: string | null
          recognized_item: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          generated_recipe_id?: string | null
          id?: string
          image_url?: string | null
          recognized_item?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          generated_recipe_id?: string | null
          id?: string
          image_url?: string | null
          recognized_item?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_recognition_requests_generated_recipe_id_fkey"
            columns: ["generated_recipe_id"]
            isOneToOne: false
            referencedRelation: "user_recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      shopping_list_items: {
        Row: {
          category: string | null
          created_at: string
          id: string
          is_purchased: boolean
          name: string
          quantity: string | null
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          is_purchased?: boolean
          name: string
          quantity?: string | null
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          is_purchased?: boolean
          name?: string
          quantity?: string | null
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          payment_provider_id: string | null
          plan_tier: Database["public"]["Enums"]["plan_tier"]
          started_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          payment_provider_id?: string | null
          plan_tier?: Database["public"]["Enums"]["plan_tier"]
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          payment_provider_id?: string | null
          plan_tier?: Database["public"]["Enums"]["plan_tier"]
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_recipes: {
        Row: {
          calories_per_serving: number | null
          category: string | null
          cost_delivery_brl: number | null
          cost_home_brl: number | null
          created_at: string
          description: string | null
          diet: string[] | null
          difficulty: string | null
          id: string
          image_photographer: string | null
          image_photographer_url: string | null
          image_url: string | null
          ingredients: string[] | null
          instructions: string | null
          is_favorite: boolean
          notes: string | null
          rating: number | null
          time_minutes: number | null
          times_cooked: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          calories_per_serving?: number | null
          category?: string | null
          cost_delivery_brl?: number | null
          cost_home_brl?: number | null
          created_at?: string
          description?: string | null
          diet?: string[] | null
          difficulty?: string | null
          id?: string
          image_photographer?: string | null
          image_photographer_url?: string | null
          image_url?: string | null
          ingredients?: string[] | null
          instructions?: string | null
          is_favorite?: boolean
          notes?: string | null
          rating?: number | null
          time_minutes?: number | null
          times_cooked?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          calories_per_serving?: number | null
          category?: string | null
          cost_delivery_brl?: number | null
          cost_home_brl?: number | null
          created_at?: string
          description?: string | null
          diet?: string[] | null
          difficulty?: string | null
          id?: string
          image_photographer?: string | null
          image_photographer_url?: string | null
          image_url?: string | null
          ingredients?: string[] | null
          instructions?: string | null
          is_favorite?: boolean
          notes?: string | null
          rating?: number | null
          time_minutes?: number | null
          times_cooked?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_chat_usage: { Args: never; Returns: number }
    }
    Enums: {
      plan_tier: "free" | "basico" | "premium"
      subscription_status: "active" | "canceled" | "expired"
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
      plan_tier: ["free", "basico", "premium"],
      subscription_status: ["active", "canceled", "expired"],
    },
  },
} as const
