export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      calendar_event_links: {
        Row: {
          calendar_id: string;
          created_at: string;
          google_event_id: string;
          id: string;
          project_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          calendar_id: string;
          created_at?: string;
          google_event_id: string;
          id?: string;
          project_id?: string | null;
          updated_at?: string;
        };
        Update: {
          calendar_id?: string;
          created_at?: string;
          google_event_id?: string;
          id?: string;
          project_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "calendar_event_links_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };
      organization_document_translations: {
        Row: {
          created_at: string;
          description: string | null;
          document_id: string;
          id: string;
          locale: Database["public"]["Enums"]["content_locale"];
          needs_review: boolean;
          slug: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string | null;
          document_id: string;
          id?: string;
          locale: Database["public"]["Enums"]["content_locale"];
          needs_review?: boolean;
          slug: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          document_id?: string;
          id?: string;
          locale?: Database["public"]["Enums"]["content_locale"];
          needs_review?: boolean;
          slug?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_document_translations_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "organization_documents";
            referencedColumns: ["id"];
          }
        ];
      };
      organization_documents: {
        Row: {
          created_at: string;
          document_type: string;
          file_size_bytes: number | null;
          id: string;
          language: Database["public"]["Enums"]["content_locale"];
          mime_type: string | null;
          publication_date: string | null;
          published_at: string | null;
          sort_order: number;
          status: Database["public"]["Enums"]["content_status"];
          storage_path: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          document_type: string;
          file_size_bytes?: number | null;
          id?: string;
          language: Database["public"]["Enums"]["content_locale"];
          mime_type?: string | null;
          publication_date?: string | null;
          published_at?: string | null;
          sort_order?: number;
          status?: Database["public"]["Enums"]["content_status"];
          storage_path: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          document_type?: string;
          file_size_bytes?: number | null;
          id?: string;
          language?: Database["public"]["Enums"]["content_locale"];
          mime_type?: string | null;
          publication_date?: string | null;
          published_at?: string | null;
          sort_order?: number;
          status?: Database["public"]["Enums"]["content_status"];
          storage_path?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_translations: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          locale: Database["public"]["Enums"]["content_locale"];
          needs_review: boolean;
          project_id: string;
          slug: string;
          summary: string | null;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          locale: Database["public"]["Enums"]["content_locale"];
          needs_review?: boolean;
          project_id: string;
          slug: string;
          summary?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          locale?: Database["public"]["Enums"]["content_locale"];
          needs_review?: boolean;
          project_id?: string;
          slug?: string;
          summary?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_translations_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };
      projects: {
        Row: {
          cover_path: string | null;
          created_at: string;
          end_date: string | null;
          featured_rank: number | null;
          id: string;
          published_at: string | null;
          start_date: string | null;
          status: Database["public"]["Enums"]["content_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          cover_path?: string | null;
          created_at?: string;
          end_date?: string | null;
          featured_rank?: number | null;
          id?: string;
          published_at?: string | null;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["content_status"];
          updated_at?: string;
        };
        Update: {
          cover_path?: string | null;
          created_at?: string;
          end_date?: string | null;
          featured_rank?: number | null;
          id?: string;
          published_at?: string | null;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["content_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      publication_files: {
        Row: {
          created_at: string;
          file_size_bytes: number | null;
          id: string;
          label: string | null;
          locale: Database["public"]["Enums"]["content_locale"];
          mime_type: string | null;
          publication_id: string;
          storage_path: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          file_size_bytes?: number | null;
          id?: string;
          label?: string | null;
          locale: Database["public"]["Enums"]["content_locale"];
          mime_type?: string | null;
          publication_id: string;
          storage_path: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          file_size_bytes?: number | null;
          id?: string;
          label?: string | null;
          locale?: Database["public"]["Enums"]["content_locale"];
          mime_type?: string | null;
          publication_id?: string;
          storage_path?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "publication_files_publication_id_fkey";
            columns: ["publication_id"];
            isOneToOne: false;
            referencedRelation: "publications";
            referencedColumns: ["id"];
          }
        ];
      };
      publication_translations: {
        Row: {
          abstract: string | null;
          authors: string | null;
          created_at: string;
          id: string;
          locale: Database["public"]["Enums"]["content_locale"];
          needs_review: boolean;
          publication_id: string;
          slug: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          abstract?: string | null;
          authors?: string | null;
          created_at?: string;
          id?: string;
          locale: Database["public"]["Enums"]["content_locale"];
          needs_review?: boolean;
          publication_id: string;
          slug: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          abstract?: string | null;
          authors?: string | null;
          created_at?: string;
          id?: string;
          locale?: Database["public"]["Enums"]["content_locale"];
          needs_review?: boolean;
          publication_id?: string;
          slug?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "publication_translations_publication_id_fkey";
            columns: ["publication_id"];
            isOneToOne: false;
            referencedRelation: "publications";
            referencedColumns: ["id"];
          }
        ];
      };
      publications: {
        Row: {
          created_at: string;
          external_url: string | null;
          id: string;
          language: Database["public"]["Enums"]["content_locale"] | null;
          publication_date: string | null;
          published_at: string | null;
          sort_order: number;
          status: Database["public"]["Enums"]["content_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          external_url?: string | null;
          id?: string;
          language?: Database["public"]["Enums"]["content_locale"] | null;
          publication_date?: string | null;
          published_at?: string | null;
          sort_order?: number;
          status?: Database["public"]["Enums"]["content_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          external_url?: string | null;
          id?: string;
          language?: Database["public"]["Enums"]["content_locale"] | null;
          publication_date?: string | null;
          published_at?: string | null;
          sort_order?: number;
          status?: Database["public"]["Enums"]["content_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      site_page_translations: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          locale: Database["public"]["Enums"]["content_locale"];
          meta_description: string | null;
          needs_review: boolean;
          page_id: string;
          slug: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          locale: Database["public"]["Enums"]["content_locale"];
          meta_description?: string | null;
          needs_review?: boolean;
          page_id: string;
          slug: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          locale?: Database["public"]["Enums"]["content_locale"];
          meta_description?: string | null;
          needs_review?: boolean;
          page_id?: string;
          slug?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "site_page_translations_page_id_fkey";
            columns: ["page_id"];
            isOneToOne: false;
            referencedRelation: "site_pages";
            referencedColumns: ["id"];
          }
        ];
      };
      site_pages: {
        Row: {
          created_at: string;
          id: string;
          page_key: string;
          published_at: string | null;
          sort_order: number;
          status: Database["public"]["Enums"]["content_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          page_key: string;
          published_at?: string | null;
          sort_order?: number;
          status?: Database["public"]["Enums"]["content_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          page_key?: string;
          published_at?: string | null;
          sort_order?: number;
          status?: Database["public"]["Enums"]["content_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      team_member_translations: {
        Row: {
          bio: string | null;
          created_at: string;
          id: string;
          locale: Database["public"]["Enums"]["content_locale"];
          member_id: string;
          needs_review: boolean;
          role: string | null;
          slug: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          bio?: string | null;
          created_at?: string;
          id?: string;
          locale: Database["public"]["Enums"]["content_locale"];
          member_id: string;
          needs_review?: boolean;
          role?: string | null;
          slug: string;
          updated_at?: string;
        };
        Update: {
          bio?: string | null;
          created_at?: string;
          id?: string;
          locale?: Database["public"]["Enums"]["content_locale"];
          member_id?: string;
          needs_review?: boolean;
          role?: string | null;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_member_translations_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "team_members";
            referencedColumns: ["id"];
          }
        ];
      };
      team_members: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          portrait_path: string | null;
          published_at: string | null;
          sort_order: number;
          status: Database["public"]["Enums"]["content_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          portrait_path?: string | null;
          published_at?: string | null;
          sort_order?: number;
          status?: Database["public"]["Enums"]["content_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          portrait_path?: string | null;
          published_at?: string | null;
          sort_order?: number;
          status?: Database["public"]["Enums"]["content_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_published: {
        Args: { p_status: Database["public"]["Enums"]["content_status"] };
        Returns: boolean;
      };
    };
    Enums: {
      content_locale: "en" | "pl" | "uk";
      content_status: "draft" | "published" | "archived";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {}
  },
  public: {
    Enums: {
      content_locale: ["en", "pl", "uk"],
      content_status: ["draft", "published", "archived"]
    }
  }
} as const;
