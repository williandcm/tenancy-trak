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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      contracts: {
        Row: {
          adjustment_index: string | null
          cleaning_fee: number | null
          created_at: string
          deposit_amount: number | null
          duration_months: number
          end_date: string
          id: string
          landlord_id: string
          late_fee_max_percent: number | null
          late_fee_percent: number | null
          monthly_rent: number
          notes: string | null
          payment_day: number
          rescission_penalty_months: number | null
          second_landlord_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["contract_status"]
          tenant_id: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          adjustment_index?: string | null
          cleaning_fee?: number | null
          created_at?: string
          deposit_amount?: number | null
          duration_months?: number
          end_date: string
          id?: string
          landlord_id: string
          late_fee_max_percent?: number | null
          late_fee_percent?: number | null
          monthly_rent: number
          notes?: string | null
          payment_day?: number
          rescission_penalty_months?: number | null
          second_landlord_id?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["contract_status"]
          tenant_id: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          adjustment_index?: string | null
          cleaning_fee?: number | null
          created_at?: string
          deposit_amount?: number | null
          duration_months?: number
          end_date?: string
          id?: string
          landlord_id?: string
          late_fee_max_percent?: number | null
          late_fee_percent?: number | null
          monthly_rent?: number
          notes?: string | null
          payment_day?: number
          rescission_penalty_months?: number | null
          second_landlord_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["contract_status"]
          tenant_id?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "landlords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_second_landlord_id_fkey"
            columns: ["second_landlord_id"]
            isOneToOne: false
            referencedRelation: "landlords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      landlords: {
        Row: {
          address: string
          cep: string | null
          city: string | null
          cpf: string
          created_at: string
          full_name: string
          id: string
          is_active: boolean | null
          marital_status: string | null
          nationality: string | null
          rg: string
          rg_issuer: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address: string
          cep?: string | null
          city?: string | null
          cpf: string
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean | null
          marital_status?: string | null
          nationality?: string | null
          rg: string
          rg_issuer?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          cep?: string | null
          city?: string | null
          cpf?: string
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          marital_status?: string | null
          nationality?: string | null
          rg?: string
          rg_issuer?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          related_entity_id: string | null
          related_entity_type: string | null
          title: string
          type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          title: string
          type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          title?: string
          type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          contract_id: string
          created_at: string
          due_date: string
          id: string
          is_paid: boolean | null
          late_fee: number | null
          notes: string | null
          paid_date: string | null
        }
        Insert: {
          amount: number
          contract_id: string
          created_at?: string
          due_date: string
          id?: string
          is_paid?: boolean | null
          late_fee?: number | null
          notes?: string | null
          paid_date?: string | null
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string
          due_date?: string
          id?: string
          is_paid?: boolean | null
          late_fee?: number | null
          notes?: string | null
          paid_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tenant_documents: {
        Row: {
          document_type: string
          file_name: string
          file_url: string
          id: string
          notes: string | null
          reviewed_at: string | null
          status: Database["public"]["Enums"]["document_status"]
          submitted_at: string
          tenant_id: string
        }
        Insert: {
          document_type: string
          file_name: string
          file_url: string
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          submitted_at?: string
          tenant_id: string
        }
        Update: {
          document_type?: string
          file_name?: string
          file_url?: string
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          submitted_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          address: string | null
          cep: string | null
          city: string | null
          cpf: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          nationality: string | null
          notes: string | null
          phone: string | null
          rg: string | null
          rg_issuer: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          cep?: string | null
          city?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          rg?: string | null
          rg_issuer?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          cep?: string | null
          city?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          rg?: string | null
          rg_issuer?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          address_number: string
          area_sqm: number
          created_at: string
          description: string | null
          electricity_connection: string | null
          floor: string | null
          id: string
          identifier: string
          monthly_rent: number | null
          name: string
          status: Database["public"]["Enums"]["unit_status"]
          updated_at: string
          water_connection: string | null
        }
        Insert: {
          address_number: string
          area_sqm: number
          created_at?: string
          description?: string | null
          electricity_connection?: string | null
          floor?: string | null
          id?: string
          identifier: string
          monthly_rent?: number | null
          name: string
          status?: Database["public"]["Enums"]["unit_status"]
          updated_at?: string
          water_connection?: string | null
        }
        Update: {
          address_number?: string
          area_sqm?: number
          created_at?: string
          description?: string | null
          electricity_connection?: string | null
          floor?: string | null
          id?: string
          identifier?: string
          monthly_rent?: number | null
          name?: string
          status?: Database["public"]["Enums"]["unit_status"]
          updated_at?: string
          water_connection?: string | null
        }
        Relationships: []
      }
      utility_readings: {
        Row: {
          connection_identifier: string
          connection_type: string
          created_at: string
          id: string
          notes: string | null
          reading_date: string
          reading_value: number
        }
        Insert: {
          connection_identifier: string
          connection_type: string
          created_at?: string
          id?: string
          notes?: string | null
          reading_date: string
          reading_value: number
        }
        Update: {
          connection_identifier?: string
          connection_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          reading_date?: string
          reading_value?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      contract_status: "active" | "expired" | "terminated" | "pending"
      document_status: "pending" | "approved" | "rejected"
      unit_status: "available" | "occupied" | "maintenance"
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
      contract_status: ["active", "expired", "terminated", "pending"],
      document_status: ["pending", "approved", "rejected"],
      unit_status: ["available", "occupied", "maintenance"],
    },
  },
} as const
