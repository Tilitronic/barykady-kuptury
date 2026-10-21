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
      content_assets: {
        Row: {
          created_at: string;
          height: number;
          id: string;
          locale: Database["public"]["Enums"]["content_locale"];
          mime_type: string;
          organization_document_id: string | null;
          publication_id: string | null;
          sha256: string;
          size_bytes: number | null;
          storage_path: string;
          updated_at: string;
          width: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          height: number;
          id?: string;
          locale: Database["public"]["Enums"]["content_locale"];
          mime_type: string;
          organization_document_id?: string | null;
          publication_id?: string | null;
          sha256: string;
          size_bytes?: number | null;
          storage_path: string;
          updated_at?: string;
          width: number;
        };
        Update: {
          created_at?: string;
          height?: number;
          id?: string;
          locale?: Database["public"]["Enums"]["content_locale"];
          mime_type?: string;
          organization_document_id?: string | null;
          publication_id?: string | null;
          sha256?: string;
          size_bytes?: number | null;
          storage_path?: string;
          updated_at?: string;
          width?: number;
        };
        Relationships: [
          {
            foreignKeyName: "content_assets_organization_document_id_fkey";
            columns: ["organization_document_id"];
            isOneToOne: false;
            referencedRelation: "organization_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_assets_publication_id_fkey";
            columns: ["publication_id"];
            isOneToOne: false;
            referencedRelation: "publications";
            referencedColumns: ["id"];
          }
        ];
      };
      content_sync_jobs: {
        Row: {
          created_at: string;
          entity_id: string | null;
          error_code: string | null;
          finished_at: string | null;
          id: string;
          kind: string;
          locale: Database["public"]["Enums"]["content_locale"];
          request: NonNullable<Json>;
          requested_by: string | null;
          started_at: string | null;
          status: string;
          summary: Json | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          entity_id?: string | null;
          error_code?: string | null;
          finished_at?: string | null;
          id?: string;
          kind: string;
          locale: Database["public"]["Enums"]["content_locale"];
          request: NonNullable<Json>;
          requested_by?: string | null;
          started_at?: string | null;
          status?: string;
          summary?: Json | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          entity_id?: string | null;
          error_code?: string | null;
          finished_at?: string | null;
          id?: string;
          kind?: string;
          locale?: Database["public"]["Enums"]["content_locale"];
          request?: NonNullable<Json>;
          requested_by?: string | null;
          started_at?: string | null;
          status?: string;
          summary?: Json | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      content_sync_runs: {
        Row: {
          checked: number;
          created_at: string;
          failed: number;
          finished_at: string | null;
          id: string;
          skipped: number;
          started_at: string;
          updated: number;
        };
        ComputedFields: never;
        Insert: {
          checked?: number;
          created_at?: string;
          failed?: number;
          finished_at?: string | null;
          id?: string;
          skipped?: number;
          started_at: string;
          updated?: number;
        };
        Update: {
          checked?: number;
          created_at?: string;
          failed?: number;
          finished_at?: string | null;
          id?: string;
          skipped?: number;
          started_at?: string;
          updated?: number;
        };
        Relationships: [];
      };
      organization_document_translations: {
        Row: {
          body: string | null;
          body_ast: Json | null;
          body_ast_version: number | null;
          created_at: string;
          description: string | null;
          document_id: string;
          id: string;
          locale: Database["public"]["Enums"]["content_locale"];
          needs_review: boolean;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          body?: string | null;
          body_ast?: Json | null;
          body_ast_version?: number | null;
          created_at?: string;
          description?: string | null;
          document_id: string;
          id?: string;
          locale: Database["public"]["Enums"]["content_locale"];
          needs_review?: boolean;
          title: string;
          updated_at?: string;
        };
        Update: {
          body?: string | null;
          body_ast?: Json | null;
          body_ast_version?: number | null;
          created_at?: string;
          description?: string | null;
          document_id?: string;
          id?: string;
          locale?: Database["public"]["Enums"]["content_locale"];
          needs_review?: boolean;
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
          allow_original_download: boolean;
          created_at: string;
          document_type: string;
          file_size_bytes: number | null;
          id: string;
          language: Database["public"]["Enums"]["content_locale"] | null;
          mime_type: string | null;
          publication_date: string | null;
          published_at: string | null;
          slug: string;
          sort_order: number;
          source_check_failures: number;
          source_checked_at: string | null;
          source_external_id: string | null;
          source_mime: string | null;
          source_modified_at: string | null;
          source_path: string | null;
          source_provider: Database["public"]["Enums"]["content_source_provider"];
          source_synced_at: string | null;
          source_url: string | null;
          status: Database["public"]["Enums"]["content_status"];
          storage_path: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          allow_original_download?: boolean;
          created_at?: string;
          document_type: string;
          file_size_bytes?: number | null;
          id?: string;
          language?: Database["public"]["Enums"]["content_locale"] | null;
          mime_type?: string | null;
          publication_date?: string | null;
          published_at?: string | null;
          slug: string;
          sort_order?: number;
          source_check_failures?: number;
          source_checked_at?: string | null;
          source_external_id?: string | null;
          source_mime?: string | null;
          source_modified_at?: string | null;
          source_path?: string | null;
          source_provider?: Database["public"]["Enums"]["content_source_provider"];
          source_synced_at?: string | null;
          source_url?: string | null;
          status?: Database["public"]["Enums"]["content_status"];
          storage_path?: string | null;
          updated_at?: string;
        };
        Update: {
          allow_original_download?: boolean;
          created_at?: string;
          document_type?: string;
          file_size_bytes?: number | null;
          id?: string;
          language?: Database["public"]["Enums"]["content_locale"] | null;
          mime_type?: string | null;
          publication_date?: string | null;
          published_at?: string | null;
          slug?: string;
          sort_order?: number;
          source_check_failures?: number;
          source_checked_at?: string | null;
          source_external_id?: string | null;
          source_mime?: string | null;
          source_modified_at?: string | null;
          source_path?: string | null;
          source_provider?: Database["public"]["Enums"]["content_source_provider"];
          source_synced_at?: string | null;
          source_url?: string | null;
          status?: Database["public"]["Enums"]["content_status"];
          storage_path?: string | null;
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
          slug: string;
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
          slug: string;
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
          slug?: string;
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
          body: string | null;
          body_ast: Json | null;
          body_ast_version: number | null;
          created_at: string;
          id: string;
          locale: Database["public"]["Enums"]["content_locale"];
          needs_review: boolean;
          publication_id: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          abstract?: string | null;
          authors?: string | null;
          body?: string | null;
          body_ast?: Json | null;
          body_ast_version?: number | null;
          created_at?: string;
          id?: string;
          locale: Database["public"]["Enums"]["content_locale"];
          needs_review?: boolean;
          publication_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          abstract?: string | null;
          authors?: string | null;
          body?: string | null;
          body_ast?: Json | null;
          body_ast_version?: number | null;
          created_at?: string;
          id?: string;
          locale?: Database["public"]["Enums"]["content_locale"];
          needs_review?: boolean;
          publication_id?: string;
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
          allow_original_download: boolean;
          created_at: string;
          external_url: string | null;
          id: string;
          language: Database["public"]["Enums"]["content_locale"] | null;
          publication_date: string | null;
          published_at: string | null;
          slug: string;
          sort_order: number;
          source_check_failures: number;
          source_checked_at: string | null;
          source_external_id: string | null;
          source_mime: string | null;
          source_modified_at: string | null;
          source_path: string | null;
          source_provider: Database["public"]["Enums"]["content_source_provider"];
          source_synced_at: string | null;
          source_url: string | null;
          status: Database["public"]["Enums"]["content_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          allow_original_download?: boolean;
          created_at?: string;
          external_url?: string | null;
          id?: string;
          language?: Database["public"]["Enums"]["content_locale"] | null;
          publication_date?: string | null;
          published_at?: string | null;
          slug: string;
          sort_order?: number;
          source_check_failures?: number;
          source_checked_at?: string | null;
          source_external_id?: string | null;
          source_mime?: string | null;
          source_modified_at?: string | null;
          source_path?: string | null;
          source_provider?: Database["public"]["Enums"]["content_source_provider"];
          source_synced_at?: string | null;
          source_url?: string | null;
          status?: Database["public"]["Enums"]["content_status"];
          updated_at?: string;
        };
        Update: {
          allow_original_download?: boolean;
          created_at?: string;
          external_url?: string | null;
          id?: string;
          language?: Database["public"]["Enums"]["content_locale"] | null;
          publication_date?: string | null;
          published_at?: string | null;
          slug?: string;
          sort_order?: number;
          source_check_failures?: number;
          source_checked_at?: string | null;
          source_external_id?: string | null;
          source_mime?: string | null;
          source_modified_at?: string | null;
          source_path?: string | null;
          source_provider?: Database["public"]["Enums"]["content_source_provider"];
          source_synced_at?: string | null;
          source_url?: string | null;
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
      assert_reader_ast_assets_v1: {
        Args: {
          asset_locale: Database["public"]["Enums"]["content_locale"];
          ast: Json;
          target_document_id: string;
          target_publication_id: string;
        };
        Returns: undefined;
      };
      claim_content_check_v1: {
        Args: {
          p_base_interval_minutes?: number;
          p_kind: string;
          p_slug: string;
        };
        Returns: {
          allow_original_download: boolean;
          check_failures: number;
          entity_id: string;
          file_id: string;
          locale: Database["public"]["Enums"]["content_locale"];
          outcome: string;
          source_modified_at: string;
          source_synced_at: string;
          source_url: string;
          status: Database["public"]["Enums"]["content_status"];
        }[];
      };
      claim_scheduled_content_sync_job_v1: {
        Args: {
          p_entity_id: string;
          p_kind: string;
          p_locale: Database["public"]["Enums"]["content_locale"];
          p_request: Json;
        };
        Returns: string;
      };
      enqueue_content_sync_job_v1: {
        Args: {
          p_entity_id: string;
          p_kind: string;
          p_locale: Database["public"]["Enums"]["content_locale"];
          p_request: Json;
        };
        Returns: string;
      };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_published: {
        Args: { p_status: Database["public"]["Enums"]["content_status"] };
        Returns: boolean;
      };
      persist_reader_import_v1: {
        Args: {
          p_allow_original_download: boolean;
          p_assets: Json;
          p_body_ast: Json;
          p_description: string;
          p_document_type: string;
          p_entity_id: string;
          p_kind: string;
          p_locale: Database["public"]["Enums"]["content_locale"];
          p_slug: string;
          p_source_external_id: string;
          p_source_mime: string;
          p_source_modified_at: string;
          p_source_path: string;
          p_source_provider: Database["public"]["Enums"]["content_source_provider"];
          p_source_synced_at: string;
          p_source_url: string;
          p_status: Database["public"]["Enums"]["content_status"];
          p_title: string;
        };
        Returns: string;
      };
      reader_ast_assert_keys_v1: {
        Args: { allowed_keys: string[]; node: Json; required_keys: string[] };
        Returns: undefined;
      };
      reader_ast_block_text_v1: { Args: { block: Json }; Returns: string };
      reader_ast_inline_text_v1: { Args: { nodes: Json }; Returns: string };
      reader_ast_to_plain_text_v1: { Args: { ast: Json }; Returns: string };
      reader_ast_validate_blocks_v1: {
        Args: { children: Json; depth?: number };
        Returns: undefined;
      };
      reader_ast_validate_inlines_v1: {
        Args: { children: Json; depth?: number };
        Returns: undefined;
      };
      record_content_check_result_v1: {
        Args: { p_entity_id: string; p_kind: string; p_success: boolean };
        Returns: undefined;
      };
      search_published_content: {
        Args: {
          result_kinds?: string[];
          result_limit?: number;
          result_locale: Database["public"]["Enums"]["content_locale"];
          search_query: string;
        };
        Returns: {
          entity_id: string;
          excerpt: string;
          kind: string;
          page_key: string;
          rank: number;
          slug: string;
          title: string;
        }[];
      };
      validate_reader_ast_v1: {
        Args: { ast: Json; ast_version: number };
        Returns: undefined;
      };
      validate_reader_block_v1: {
        Args: { block: Json; depth?: number };
        Returns: undefined;
      };
      validate_reader_inline_v1: {
        Args: { depth?: number; node: Json };
        Returns: undefined;
      };
    };
    Enums: {
      content_locale: "en" | "pl" | "uk";
      content_source_provider: "manual" | "upload" | "google_doc";
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
      content_source_provider: ["manual", "upload", "google_doc"],
      content_status: ["draft", "published", "archived"]
    }
  }
} as const;
