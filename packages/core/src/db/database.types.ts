export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      collections: {
        Row: {
          amount_cents: number;
          created_at: string;
          customer_id: string;
          id: string;
          recorded_by: string;
          store_id: string;
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          customer_id: string;
          id?: string;
          recorded_by: string;
          store_id: string;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          customer_id?: string;
          id?: string;
          recorded_by?: string;
          store_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'collections_store_id_customer_id_fkey';
            columns: ['store_id', 'customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['store_id', 'id'];
          },
          {
            foreignKeyName: 'collections_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      customers: {
        Row: {
          consent_at: string | null;
          consented: boolean;
          created_at: string;
          id: string;
          link_token: string;
          name: string;
          notes: string | null;
          pin: string;
          reference: string | null;
          store_id: string;
          updated_at: string;
          whatsapp: string;
        };
        Insert: {
          consent_at?: string | null;
          consented?: boolean;
          created_at?: string;
          id?: string;
          link_token?: string;
          name: string;
          notes?: string | null;
          pin: string;
          reference?: string | null;
          store_id: string;
          updated_at?: string;
          whatsapp: string;
        };
        Update: {
          consent_at?: string | null;
          consented?: boolean;
          created_at?: string;
          id?: string;
          link_token?: string;
          name?: string;
          notes?: string | null;
          pin?: string;
          reference?: string | null;
          store_id?: string;
          updated_at?: string;
          whatsapp?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'customers_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      payments: {
        Row: {
          amount_cents: number;
          cancelled_at: string | null;
          cancelled_by: string | null;
          created_at: string;
          customer_id: string | null;
          id: string;
          method: string;
          recorded_by: string;
          sale_id: string | null;
          status: string;
          store_id: string;
        };
        Insert: {
          amount_cents: number;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          customer_id?: string | null;
          id?: string;
          method: string;
          recorded_by: string;
          sale_id?: string | null;
          status?: string;
          store_id: string;
        };
        Update: {
          amount_cents?: number;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          customer_id?: string | null;
          id?: string;
          method?: string;
          recorded_by?: string;
          sale_id?: string | null;
          status?: string;
          store_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_customer_fkey';
            columns: ['store_id', 'customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['store_id', 'id'];
          },
          {
            foreignKeyName: 'payments_sale_fkey';
            columns: ['store_id', 'sale_id'];
            isOneToOne: false;
            referencedRelation: 'sales';
            referencedColumns: ['store_id', 'id'];
          },
          {
            foreignKeyName: 'payments_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      points_ledger: {
        Row: {
          created_at: string;
          customer_id: string;
          id: string;
          kind: string;
          points: number;
          sale_id: string | null;
          store_id: string;
        };
        Insert: {
          created_at?: string;
          customer_id: string;
          id?: string;
          kind: string;
          points: number;
          sale_id?: string | null;
          store_id: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          id?: string;
          kind?: string;
          points?: number;
          sale_id?: string | null;
          store_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'points_ledger_customer_fkey';
            columns: ['store_id', 'customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['store_id', 'id'];
          },
          {
            foreignKeyName: 'points_ledger_sale_fkey';
            columns: ['store_id', 'sale_id'];
            isOneToOne: false;
            referencedRelation: 'sales';
            referencedColumns: ['store_id', 'id'];
          },
          {
            foreignKeyName: 'points_ledger_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      products: {
        Row: {
          can_be_prize: boolean;
          created_at: string;
          id: string;
          is_active: boolean;
          is_combo: boolean;
          name: string;
          points: number;
          price_cents: number;
          store_id: string;
        };
        Insert: {
          can_be_prize?: boolean;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          is_combo?: boolean;
          name: string;
          points?: number;
          price_cents: number;
          store_id: string;
        };
        Update: {
          can_be_prize?: boolean;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          is_combo?: boolean;
          name?: string;
          points?: number;
          price_cents?: number;
          store_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'products_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      sale_item_revisions: {
        Row: {
          id: string;
          points: number;
          position: number;
          product_id: string;
          product_name: string;
          quantity: number;
          replaced_at: string;
          replaced_by: string;
          revision: number;
          sale_id: string;
          store_id: string;
          unit_price_cents: number;
        };
        Insert: {
          id?: string;
          points: number;
          position: number;
          product_id: string;
          product_name: string;
          quantity: number;
          replaced_at?: string;
          replaced_by: string;
          revision: number;
          sale_id: string;
          store_id: string;
          unit_price_cents: number;
        };
        Update: {
          id?: string;
          points?: number;
          position?: number;
          product_id?: string;
          product_name?: string;
          quantity?: number;
          replaced_at?: string;
          replaced_by?: string;
          revision?: number;
          sale_id?: string;
          store_id?: string;
          unit_price_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'sale_item_revisions_sale_fkey';
            columns: ['store_id', 'sale_id'];
            isOneToOne: false;
            referencedRelation: 'sales';
            referencedColumns: ['store_id', 'id'];
          },
          {
            foreignKeyName: 'sale_item_revisions_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      sale_items: {
        Row: {
          id: string;
          points: number;
          position: number;
          product_id: string;
          product_name: string;
          quantity: number;
          sale_id: string;
          store_id: string;
          unit_price_cents: number;
        };
        Insert: {
          id?: string;
          points: number;
          position: number;
          product_id: string;
          product_name: string;
          quantity: number;
          sale_id: string;
          store_id: string;
          unit_price_cents: number;
        };
        Update: {
          id?: string;
          points?: number;
          position?: number;
          product_id?: string;
          product_name?: string;
          quantity?: number;
          sale_id?: string;
          store_id?: string;
          unit_price_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'sale_items_product_fkey';
            columns: ['store_id', 'product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['store_id', 'id'];
          },
          {
            foreignKeyName: 'sale_items_sale_fkey';
            columns: ['store_id', 'sale_id'];
            isOneToOne: false;
            referencedRelation: 'sales';
            referencedColumns: ['store_id', 'id'];
          },
          {
            foreignKeyName: 'sale_items_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      sales: {
        Row: {
          cancelled_at: string | null;
          cancelled_by: string | null;
          created_at: string;
          customer_id: string | null;
          edited_at: string | null;
          edited_by: string | null;
          id: string;
          recorded_by: string;
          status: string;
          store_id: string;
        };
        Insert: {
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          customer_id?: string | null;
          edited_at?: string | null;
          edited_by?: string | null;
          id?: string;
          recorded_by: string;
          status?: string;
          store_id: string;
        };
        Update: {
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          customer_id?: string | null;
          edited_at?: string | null;
          edited_by?: string | null;
          id?: string;
          recorded_by?: string;
          status?: string;
          store_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sales_customer_fkey';
            columns: ['store_id', 'customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['store_id', 'id'];
          },
          {
            foreignKeyName: 'sales_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      store_invites: {
        Row: {
          code: string;
          created_at: string;
          created_by: string | null;
          store_id: string;
          used_at: string | null;
          used_by: string | null;
        };
        Insert: {
          code: string;
          created_at?: string;
          created_by?: string | null;
          store_id: string;
          used_at?: string | null;
          used_by?: string | null;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string | null;
          store_id?: string;
          used_at?: string | null;
          used_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'store_invites_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      store_members: {
        Row: {
          created_at: string;
          store_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          store_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          store_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'store_members_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      stores: {
        Row: {
          brand_color: string | null;
          city: string;
          collection_template: string | null;
          created_at: string;
          id: string;
          logo_data: string | null;
          name: string;
          pix_key: string;
          points_validity_days: number | null;
          welcome_text: string | null;
        };
        Insert: {
          brand_color?: string | null;
          city: string;
          collection_template?: string | null;
          created_at?: string;
          id?: string;
          logo_data?: string | null;
          name: string;
          pix_key: string;
          points_validity_days?: number | null;
          welcome_text?: string | null;
        };
        Update: {
          brand_color?: string | null;
          city?: string;
          collection_template?: string | null;
          created_at?: string;
          id?: string;
          logo_data?: string | null;
          name?: string;
          pix_key?: string;
          points_validity_days?: number | null;
          welcome_text?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      cancel_payment: { Args: { p_payment_id: string }; Returns: undefined };
      cancel_sale: { Args: { p_sale_id: string }; Returns: undefined };
      create_store: {
        Args: { p_city: string; p_name: string; p_pix_key: string };
        Returns: {
          brand_color: string | null;
          city: string;
          collection_template: string | null;
          created_at: string;
          id: string;
          logo_data: string | null;
          name: string;
          pix_key: string;
          points_validity_days: number | null;
          welcome_text: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'stores';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_store_invite: {
        Args: never;
        Returns: {
          code: string;
          created_at: string;
          created_by: string | null;
          store_id: string;
          used_at: string | null;
          used_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'store_invites';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      expire_customer_points: {
        Args: { p_customer_id: string };
        Returns: string;
      };
      get_customer_balance: {
        Args: { p_customer_id: string };
        Returns: {
          created_at: string;
          paid_cents: number;
          sale_id: string;
          total_cents: number;
        }[];
      };
      get_customer_page: { Args: { p_token: string }; Returns: Json };
      join_store_with_invite: {
        Args: { p_code: string };
        Returns: {
          brand_color: string | null;
          city: string;
          collection_template: string | null;
          created_at: string;
          id: string;
          logo_data: string | null;
          name: string;
          pix_key: string;
          points_validity_days: number | null;
          welcome_text: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'stores';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      list_collection_queue: {
        Args: never;
        Returns: {
          balance_cents: number;
          customer_id: string;
          debt_since: string;
          last_collection_at: string;
          name: string;
          whatsapp: string;
        }[];
      };
      list_store_members: {
        Args: never;
        Returns: {
          email: string;
          user_id: string;
        }[];
      };
      record_collection: {
        Args: { p_customer_id: string };
        Returns: {
          amount_cents: number;
          created_at: string;
          id: string;
        }[];
      };
      record_payment: {
        Args: {
          p_amount_cents: number;
          p_customer_id: string;
          p_method: string;
        };
        Returns: string;
      };
      record_sale: {
        Args: { p_customer_id: string; p_items: Json; p_payment_method: string };
        Returns: string;
      };
      search_customers: {
        Args: { p_query: string };
        Returns: {
          consent_at: string | null;
          consented: boolean;
          created_at: string;
          id: string;
          link_token: string;
          name: string;
          notes: string | null;
          pin: string;
          reference: string | null;
          store_id: string;
          updated_at: string;
          whatsapp: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'customers';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      update_sale: {
        Args: { p_items: Json; p_sale_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
