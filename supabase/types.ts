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
      admin_audit_log: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_value: boolean | null
          old_value: boolean | null
          target_user_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_value?: boolean | null
          old_value?: boolean | null
          target_user_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_value?: boolean | null
          old_value?: boolean | null
          target_user_id?: string
        }
        Relationships: []
      }
      ai_rate_limits: {
        Row: {
          hit_count: number
          user_id: string
          window_key: number
        }
        Insert: {
          hit_count?: number
          user_id: string
          window_key: number
        }
        Update: {
          hit_count?: number
          user_id?: string
          window_key?: number
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          created_at: string
          est_cost: number
          id: number
          input_tokens: number
          latency_ms: number | null
          model: string
          output_tokens: number
          ttft_ms: number | null
          user_id: string
          workflow_id: string
        }
        Insert: {
          created_at?: string
          est_cost?: number
          id?: never
          input_tokens?: number
          latency_ms?: number | null
          model: string
          output_tokens?: number
          ttft_ms?: number | null
          user_id: string
          workflow_id: string
        }
        Update: {
          created_at?: string
          est_cost?: number
          id?: never
          input_tokens?: number
          latency_ms?: number | null
          model?: string
          output_tokens?: number
          ttft_ms?: number | null
          user_id?: string
          workflow_id?: string
        }
        Relationships: []
      }
      application_packages: {
        Row: {
          cover_letter_text: string | null
          created_at: string
          error: string | null
          fit_score: number | null
          id: string
          job_posting_id: string
          package_status: string
          tailored_resume_storage_path: string | null
          tailored_resume_text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_letter_text?: string | null
          created_at?: string
          error?: string | null
          fit_score?: number | null
          id?: string
          job_posting_id: string
          package_status?: string
          tailored_resume_storage_path?: string | null
          tailored_resume_text?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_letter_text?: string | null
          created_at?: string
          error?: string | null
          fit_score?: number | null
          id?: string
          job_posting_id?: string
          package_status?: string
          tailored_resume_storage_path?: string | null
          tailored_resume_text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_packages_job_posting_id_fkey"
            columns: ["job_posting_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          category: string
          content: string
          created_at: string
          editor_rounds: number | null
          editor_score: number | null
          excerpt: string | null
          generated_at: string | null
          hero_emoji: string | null
          model: string | null
          published: boolean
          published_at: string
          reading_minutes: number | null
          scheduled_for: string | null
          slug: string
          sources: Json
          status: string
          tags: Json
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          editor_rounds?: number | null
          editor_score?: number | null
          excerpt?: string | null
          generated_at?: string | null
          hero_emoji?: string | null
          model?: string | null
          published?: boolean
          published_at?: string
          reading_minutes?: number | null
          scheduled_for?: string | null
          slug: string
          sources?: Json
          status?: string
          tags?: Json
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          editor_rounds?: number | null
          editor_score?: number | null
          excerpt?: string | null
          generated_at?: string | null
          hero_emoji?: string | null
          model?: string | null
          published?: boolean
          published_at?: string
          reading_minutes?: number | null
          scheduled_for?: string | null
          slug?: string
          sources?: Json
          status?: string
          tags?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_profile_requests: {
        Row: {
          company: string
          company_slug: string
          created_at: string
          id: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company: string
          company_slug: string
          created_at?: string
          id?: never
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string
          company_slug?: string
          created_at?: string
          id?: never
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      company_profiles: {
        Row: {
          created_at: string
          data: Json
          fetched_at: string | null
          name: string
          slug: string
          sources: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: Json
          fetched_at?: string | null
          name: string
          slug: string
          sources?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          fetched_at?: string | null
          name?: string
          slug?: string
          sources?: Json
          updated_at?: string
        }
        Relationships: []
      }
      company_research_cache: {
        Row: {
          cache_key: string
          company: string
          created_at: string
          data: Json
          kind: string
          updated_at: string
        }
        Insert: {
          cache_key: string
          company: string
          created_at?: string
          data: Json
          kind: string
          updated_at?: string
        }
        Update: {
          cache_key?: string
          company?: string
          created_at?: string
          data?: Json
          kind?: string
          updated_at?: string
        }
        Relationships: []
      }
      employer_boost_orders: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          days: number
          expires_at: string | null
          id: string
          listing_id: string
          status: string
          tier: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          days: number
          expires_at?: string | null
          id?: string
          listing_id: string
          status?: string
          tier: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          days?: number
          expires_at?: string | null
          id?: string
          listing_id?: string
          status?: string
          tier?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employer_boost_orders_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "employer_job_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      employer_company_profiles: {
        Row: {
          about: string | null
          benefits: string | null
          created_at: string
          culture: string | null
          extra: Json
          headquarters: string | null
          id: string
          industry: string | null
          logo_url: string | null
          mission: string | null
          name: string
          size: string | null
          tagline: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          about?: string | null
          benefits?: string | null
          created_at?: string
          culture?: string | null
          extra?: Json
          headquarters?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          mission?: string | null
          name: string
          size?: string | null
          tagline?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          about?: string | null
          benefits?: string | null
          created_at?: string
          culture?: string | null
          extra?: Json
          headquarters?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          mission?: string | null
          name?: string
          size?: string | null
          tagline?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      employer_job_listings: {
        Row: {
          boost_tier: string | null
          boosted_until: string | null
          company_id: string
          created_at: string
          description: string | null
          employment_type: string | null
          extra: Json
          id: string
          location: string | null
          promo_assets: Json
          remote: boolean | null
          requirements: string | null
          responsibilities: string | null
          salary_currency: string
          salary_max: number | null
          salary_min: number | null
          seniority: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          boost_tier?: string | null
          boosted_until?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          employment_type?: string | null
          extra?: Json
          id?: string
          location?: string | null
          promo_assets?: Json
          remote?: boolean | null
          requirements?: string | null
          responsibilities?: string | null
          salary_currency?: string
          salary_max?: number | null
          salary_min?: number | null
          seniority?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          boost_tier?: string | null
          boosted_until?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          employment_type?: string | null
          extra?: Json
          id?: string
          location?: string | null
          promo_assets?: Json
          remote?: boolean | null
          requirements?: string | null
          responsibilities?: string | null
          salary_currency?: string
          salary_max?: number | null
          salary_min?: number | null
          seniority?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employer_job_listings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "employer_company_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_sessions: {
        Row: {
          created_at: string
          focus: string | null
          id: string
          improvements: Json | null
          overall_score: number | null
          question_feedback: Json
          role: string | null
          scores: Json | null
          strengths: Json | null
          summary: string | null
          transcript: Json
          user_id: string
          workflow: string
        }
        Insert: {
          created_at?: string
          focus?: string | null
          id?: string
          improvements?: Json | null
          overall_score?: number | null
          question_feedback?: Json
          role?: string | null
          scores?: Json | null
          strengths?: Json | null
          summary?: string | null
          transcript?: Json
          user_id: string
          workflow: string
        }
        Update: {
          created_at?: string
          focus?: string | null
          id?: string
          improvements?: Json | null
          overall_score?: number | null
          question_feedback?: Json
          role?: string | null
          scores?: Json | null
          strengths?: Json | null
          summary?: string | null
          transcript?: Json
          user_id?: string
          workflow?: string
        }
        Relationships: []
      }
      job_applications: {
        Row: {
          applied_date: string
          company: string
          created_at: string
          id: string
          location: string
          notes: string | null
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          applied_date: string
          company: string
          created_at?: string
          id?: string
          location?: string
          notes?: string | null
          role: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          applied_date?: string
          company?: string
          created_at?: string
          id?: string
          location?: string
          notes?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      job_postings: {
        Row: {
          applied_at: string | null
          applied_cover_letter_id: string | null
          applied_resume_id: string | null
          company: string | null
          created_at: string
          description: string | null
          employment_type: string | null
          external_id: string | null
          favorite: boolean
          id: string
          location: string | null
          match_score: number | null
          notes: string | null
          posting_data: Json
          remote: boolean | null
          source: string
          status: string
          target_company_id: string | null
          target_role_id: string | null
          title: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          applied_cover_letter_id?: string | null
          applied_resume_id?: string | null
          company?: string | null
          created_at?: string
          description?: string | null
          employment_type?: string | null
          external_id?: string | null
          favorite?: boolean
          id?: string
          location?: string | null
          match_score?: number | null
          notes?: string | null
          posting_data?: Json
          remote?: boolean | null
          source?: string
          status?: string
          target_company_id?: string | null
          target_role_id?: string | null
          title: string
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          applied_at?: string | null
          applied_cover_letter_id?: string | null
          applied_resume_id?: string | null
          company?: string | null
          created_at?: string
          description?: string | null
          employment_type?: string | null
          external_id?: string | null
          favorite?: boolean
          id?: string
          location?: string | null
          match_score?: number | null
          notes?: string | null
          posting_data?: Json
          remote?: boolean | null
          source?: string
          status?: string
          target_company_id?: string | null
          target_role_id?: string | null
          title?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      market_data_cache: {
        Row: {
          cache_key: string
          created_at: string
          data: Json
          location: string
          role: string
          secondary_location: string | null
          updated_at: string
          yoe_tier: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          data: Json
          location: string
          role: string
          secondary_location?: string | null
          updated_at?: string
          yoe_tier: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          data?: Json
          location?: string
          role?: string
          secondary_location?: string | null
          updated_at?: string
          yoe_tier?: string
        }
        Relationships: []
      }
      negotiation_sessions: {
        Row: {
          counterpart: string | null
          created_at: string
          id: string
          improvements: Json | null
          move_feedback: Json
          overall_score: number | null
          role: string | null
          scenario: string | null
          scores: Json | null
          strengths: Json | null
          summary: string | null
          transcript: Json
          user_id: string
        }
        Insert: {
          counterpart?: string | null
          created_at?: string
          id?: string
          improvements?: Json | null
          move_feedback?: Json
          overall_score?: number | null
          role?: string | null
          scenario?: string | null
          scores?: Json | null
          strengths?: Json | null
          summary?: string | null
          transcript?: Json
          user_id: string
        }
        Update: {
          counterpart?: string | null
          created_at?: string
          id?: string
          improvements?: Json | null
          move_feedback?: Json
          overall_score?: number | null
          role?: string | null
          scenario?: string | null
          scores?: Json | null
          strengths?: Json | null
          summary?: string | null
          transcript?: Json
          user_id?: string
        }
        Relationships: []
      }
      outreach_contacts: {
        Row: {
          company: string
          contact_linkedin: string | null
          contact_name: string | null
          contact_title: string | null
          created_at: string
          id: string
          job_posting_id: string | null
          last_contacted_at: string | null
          message_draft: string | null
          notes: string | null
          outreach_type: string | null
          persona_type: string | null
          status: string
          target_company_id: string | null
          tone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company: string
          contact_linkedin?: string | null
          contact_name?: string | null
          contact_title?: string | null
          created_at?: string
          id?: string
          job_posting_id?: string | null
          last_contacted_at?: string | null
          message_draft?: string | null
          notes?: string | null
          outreach_type?: string | null
          persona_type?: string | null
          status?: string
          target_company_id?: string | null
          tone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string
          contact_linkedin?: string | null
          contact_name?: string | null
          contact_title?: string | null
          created_at?: string
          id?: string
          job_posting_id?: string | null
          last_contacted_at?: string | null
          message_draft?: string | null
          notes?: string | null
          outreach_type?: string | null
          persona_type?: string | null
          status?: string
          target_company_id?: string | null
          tone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_contacts_job_posting_id_fkey"
            columns: ["job_posting_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string
          ai_consent_given_at: string | null
          career_survey: Json
          created_at: string
          current_job_role: string | null
          current_role: string | null
          education: Json
          email: string
          github: string | null
          id: string
          is_admin: boolean
          linkedin: string | null
          linkedin_score: number | null
          linkedin_score_at: string | null
          linkedin_storage_path: string | null
          mfa_enrolled: boolean
          name: string
          onboarding_complete: boolean
          phone: string | null
          portfolio: string | null
          resume_score: number | null
          resume_score_at: string | null
          resume_storage_path: string | null
          saved_career_plans: Json
          saved_cover_letters: Json
          saved_resumes: Json
          skills: string[]
          summary: string | null
          target_companies: Json
          target_role: string | null
          target_roles: Json
          updated_at: string
          work_history: Json
          years_of_experience: number | null
        }
        Insert: {
          account_type?: string
          ai_consent_given_at?: string | null
          career_survey?: Json
          created_at?: string
          current_job_role?: string | null
          current_role?: string | null
          education?: Json
          email?: string
          github?: string | null
          id: string
          is_admin?: boolean
          linkedin?: string | null
          linkedin_score?: number | null
          linkedin_score_at?: string | null
          linkedin_storage_path?: string | null
          mfa_enrolled?: boolean
          name?: string
          onboarding_complete?: boolean
          phone?: string | null
          portfolio?: string | null
          resume_score?: number | null
          resume_score_at?: string | null
          resume_storage_path?: string | null
          saved_career_plans?: Json
          saved_cover_letters?: Json
          saved_resumes?: Json
          skills?: string[]
          summary?: string | null
          target_companies?: Json
          target_role?: string | null
          target_roles?: Json
          updated_at?: string
          work_history?: Json
          years_of_experience?: number | null
        }
        Update: {
          account_type?: string
          ai_consent_given_at?: string | null
          career_survey?: Json
          created_at?: string
          current_job_role?: string | null
          current_role?: string | null
          education?: Json
          email?: string
          github?: string | null
          id?: string
          is_admin?: boolean
          linkedin?: string | null
          linkedin_score?: number | null
          linkedin_score_at?: string | null
          linkedin_storage_path?: string | null
          mfa_enrolled?: boolean
          name?: string
          onboarding_complete?: boolean
          phone?: string | null
          portfolio?: string | null
          resume_score?: number | null
          resume_score_at?: string | null
          resume_storage_path?: string | null
          saved_career_plans?: Json
          saved_cover_letters?: Json
          saved_resumes?: Json
          skills?: string[]
          summary?: string | null
          target_companies?: Json
          target_role?: string | null
          target_roles?: Json
          updated_at?: string
          work_history?: Json
          years_of_experience?: number | null
        }
        Relationships: []
      }
      saved_analyses: {
        Row: {
          company_intel: string | null
          created_at: string
          id: string
          interview_strategy: string | null
          job_input: string
          level: string | null
          market_data: Json | null
          resume_file_name: string | null
          resume_fit: Json | null
          user_id: string
          yoe: string | null
        }
        Insert: {
          company_intel?: string | null
          created_at?: string
          id?: string
          interview_strategy?: string | null
          job_input: string
          level?: string | null
          market_data?: Json | null
          resume_file_name?: string | null
          resume_fit?: Json | null
          user_id: string
          yoe?: string | null
        }
        Update: {
          company_intel?: string | null
          created_at?: string
          id?: string
          interview_strategy?: string | null
          job_input?: string
          level?: string | null
          market_data?: Json | null
          resume_file_name?: string | null
          resume_fit?: Json | null
          user_id?: string
          yoe?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_ai_rate_limit: {
        Args: { p_max_hits: number; p_user_id: string; p_window_key: number }
        Returns: boolean
      }
      check_ai_usage_cap: {
        Args: { p_cap: number; p_user_id: string }
        Returns: boolean
      }
      current_user_is_admin: { Args: never; Returns: boolean }
      current_user_mfa_enrolled: { Args: never; Returns: boolean }
      publish_due_scheduled_posts: { Args: never; Returns: number }
      request_company_profile: { Args: { p_company: string }; Returns: string }
      session_aal_ok: { Args: { row_mfa_enrolled: boolean }; Returns: boolean }
      slugify_company: { Args: { p_name: string }; Returns: string }
      upsert_company_research_cache: {
        Args: {
          p_cache_key: string
          p_company: string
          p_data: Json
          p_kind: string
        }
        Returns: undefined
      }
      upsert_market_data_cache: {
        Args: {
          p_cache_key: string
          p_data: Json
          p_location: string
          p_role: string
          p_secondary_location: string
          p_yoe_tier: string
        }
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
    Enums: {},
  },
} as const
