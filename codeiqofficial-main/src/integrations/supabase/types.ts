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
      achievements: {
        Row: {
          created_at: string
          description: string
          icon: string
          id: string
          key: string
          name: string
          rarity: string
          requirement_type: string
          requirement_value: number
        }
        Insert: {
          created_at?: string
          description: string
          icon: string
          id?: string
          key: string
          name: string
          rarity?: string
          requirement_type: string
          requirement_value: number
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          key?: string
          name?: string
          rarity?: string
          requirement_type?: string
          requirement_value?: number
        }
        Relationships: []
      }
      ai_solution_cache: {
        Row: {
          created_at: string
          id: string
          language: string
          problem_id: string
          problem_title: string
          solution: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          language: string
          problem_id: string
          problem_title: string
          solution: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          language?: string
          problem_id?: string
          problem_title?: string
          solution?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      classroom_assignments: {
        Row: {
          assigned_by: string
          classroom_id: string
          created_at: string
          due_date: string | null
          id: string
          problem_id: string
        }
        Insert: {
          assigned_by: string
          classroom_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          problem_id: string
        }
        Update: {
          assigned_by?: string
          classroom_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          problem_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classroom_assignments_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_assignments_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problems"
            referencedColumns: ["id"]
          },
        ]
      }
      classroom_students: {
        Row: {
          classroom_id: string
          id: string
          is_active: boolean | null
          joined_at: string
          user_id: string
        }
        Insert: {
          classroom_id: string
          id?: string
          is_active?: boolean | null
          joined_at?: string
          user_id: string
        }
        Update: {
          classroom_id?: string
          id?: string
          is_active?: boolean | null
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classroom_students_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
        ]
      }
      classroom_tests: {
        Row: {
          classroom_id: string
          created_at: string
          created_by: string
          description: string | null
          difficulty: string | null
          end_time: string | null
          id: string
          is_active: boolean | null
          name: string
          start_time: string | null
          time_limit_minutes: number
          topic_id: string | null
        }
        Insert: {
          classroom_id: string
          created_at?: string
          created_by: string
          description?: string | null
          difficulty?: string | null
          end_time?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          start_time?: string | null
          time_limit_minutes?: number
          topic_id?: string | null
        }
        Update: {
          classroom_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          difficulty?: string | null
          end_time?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          start_time?: string | null
          time_limit_minutes?: number
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classroom_tests_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_tests_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      classrooms: {
        Row: {
          created_at: string
          description: string | null
          id: string
          invite_code: string
          is_active: boolean | null
          name: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          invite_code?: string
          is_active?: boolean | null
          name: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          invite_code?: string
          is_active?: boolean | null
          name?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classrooms_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          logo_url: string | null
          name: string
          problem_count: number | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          logo_url?: string | null
          name: string
          problem_count?: number | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          logo_url?: string | null
          name?: string
          problem_count?: number | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      discount_codes: {
        Row: {
          applies_to: string | null
          code: string
          created_at: string
          created_by: string
          discount_percent: number
          id: string
          is_active: boolean
          max_uses: number | null
          used_count: number
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          applies_to?: string | null
          code: string
          created_at?: string
          created_by: string
          discount_percent?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          used_count?: number
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          applies_to?: string | null
          code?: string
          created_at?: string
          created_by?: string
          discount_percent?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          used_count?: number
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      domain_plans: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          domain_id: string
          duration_days: number
          features: Json
          id: string
          is_active: boolean | null
          is_combo: boolean | null
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          domain_id: string
          duration_days?: number
          features?: Json
          id?: string
          is_active?: boolean | null
          is_combo?: boolean | null
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          domain_id?: string
          duration_days?: number
          features?: Json
          id?: string
          is_active?: boolean | null
          is_combo?: boolean | null
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_plans_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "email_domain_whitelist"
            referencedColumns: ["id"]
          },
        ]
      }
      email_domain_whitelist: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          discount_percent: number | null
          domain: string
          features: Json
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_percent?: number | null
          domain: string
          features?: Json
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_percent?: number | null
          domain?: string
          features?: Json
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          related_id: string | null
          related_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          related_id?: string | null
          related_type?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          related_id?: string | null
          related_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      password_reset_otps: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          otp: string
          used: boolean | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          otp: string
          used?: boolean | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          otp?: string
          used?: boolean | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          admin_notes: string | null
          amount: number
          approved_at: string | null
          cashfree_order_id: string | null
          cashfree_payment_id: string | null
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          declined_at: string | null
          discount_amount: number | null
          discount_code_id: string | null
          id: string
          merchant_transaction_id: string
          payment_method: string | null
          phonepay_transaction_id: string | null
          plan: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          approved_at?: string | null
          cashfree_order_id?: string | null
          cashfree_payment_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          declined_at?: string | null
          discount_amount?: number | null
          discount_code_id?: string | null
          id?: string
          merchant_transaction_id: string
          payment_method?: string | null
          phonepay_transaction_id?: string | null
          plan: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          approved_at?: string | null
          cashfree_order_id?: string | null
          cashfree_payment_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          declined_at?: string | null
          discount_amount?: number | null
          discount_code_id?: string | null
          id?: string
          merchant_transaction_id?: string
          payment_method?: string | null
          phonepay_transaction_id?: string | null
          plan?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      problems: {
        Row: {
          companies: string[] | null
          company_id: string | null
          created_at: string
          description: string | null
          difficulty: string
          display_order: number | null
          id: string
          is_premium: boolean | null
          leetcode_id: number | null
          leetcode_slug: string | null
          problem_type: string | null
          slug: string
          tags: string[] | null
          title: string
          topic_id: string
        }
        Insert: {
          companies?: string[] | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          difficulty: string
          display_order?: number | null
          id?: string
          is_premium?: boolean | null
          leetcode_id?: number | null
          leetcode_slug?: string | null
          problem_type?: string | null
          slug: string
          tags?: string[] | null
          title: string
          topic_id: string
        }
        Update: {
          companies?: string[] | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          difficulty?: string
          display_order?: number | null
          id?: string
          is_premium?: boolean | null
          leetcode_id?: number | null
          leetcode_slug?: string | null
          problem_type?: string | null
          slug?: string
          tags?: string[] | null
          title?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "problems_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "problems_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          best_streak: number | null
          college: string | null
          contest_rating: number | null
          course: string | null
          created_at: string | null
          current_streak: number | null
          easy_solved: number | null
          email: string | null
          full_name: string | null
          github_contributions: number | null
          github_repos: number | null
          github_username: string | null
          github_verified: boolean | null
          hard_solved: number | null
          id: string
          interested_roles: string | null
          invite_code_used: string | null
          invited_by: string | null
          is_disabled: boolean | null
          last_github_sync: string | null
          last_stats_sync: string | null
          leetcode_ranking: number | null
          leetcode_username: string | null
          leetcode_verified: boolean | null
          medium_solved: number | null
          mobile_number: string | null
          onboarding_completed: boolean | null
          pass_out_year: number | null
          preferred_dsa_language: string | null
          subscription_expires_at: string | null
          subscription_plan: string | null
          subscription_started_at: string | null
          total_solved: number | null
          trial_ends_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          best_streak?: number | null
          college?: string | null
          contest_rating?: number | null
          course?: string | null
          created_at?: string | null
          current_streak?: number | null
          easy_solved?: number | null
          email?: string | null
          full_name?: string | null
          github_contributions?: number | null
          github_repos?: number | null
          github_username?: string | null
          github_verified?: boolean | null
          hard_solved?: number | null
          id?: string
          interested_roles?: string | null
          invite_code_used?: string | null
          invited_by?: string | null
          is_disabled?: boolean | null
          last_github_sync?: string | null
          last_stats_sync?: string | null
          leetcode_ranking?: number | null
          leetcode_username?: string | null
          leetcode_verified?: boolean | null
          medium_solved?: number | null
          mobile_number?: string | null
          onboarding_completed?: boolean | null
          pass_out_year?: number | null
          preferred_dsa_language?: string | null
          subscription_expires_at?: string | null
          subscription_plan?: string | null
          subscription_started_at?: string | null
          total_solved?: number | null
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          best_streak?: number | null
          college?: string | null
          contest_rating?: number | null
          course?: string | null
          created_at?: string | null
          current_streak?: number | null
          easy_solved?: number | null
          email?: string | null
          full_name?: string | null
          github_contributions?: number | null
          github_repos?: number | null
          github_username?: string | null
          github_verified?: boolean | null
          hard_solved?: number | null
          id?: string
          interested_roles?: string | null
          invite_code_used?: string | null
          invited_by?: string | null
          is_disabled?: boolean | null
          last_github_sync?: string | null
          last_stats_sync?: string | null
          leetcode_ranking?: number | null
          leetcode_username?: string | null
          leetcode_verified?: boolean | null
          medium_solved?: number | null
          mobile_number?: string | null
          onboarding_completed?: boolean | null
          pass_out_year?: number | null
          preferred_dsa_language?: string | null
          subscription_expires_at?: string | null
          subscription_plan?: string | null
          subscription_started_at?: string | null
          total_solved?: number | null
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          payment_id: string | null
          plan: string
          starts_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          payment_id?: string | null
          plan: string
          starts_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          payment_id?: string | null
          plan?: string
          starts_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          id: string
          is_active: boolean | null
          name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      test_problem_answers: {
        Row: {
          created_at: string | null
          id: string
          is_verified: boolean | null
          problem_id: string
          test_submission_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          problem_id: string
          test_submission_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          problem_id?: string
          test_submission_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      test_questions: {
        Row: {
          display_order: number | null
          id: string
          points: number | null
          problem_id: string
          test_id: string
        }
        Insert: {
          display_order?: number | null
          id?: string
          points?: number | null
          problem_id: string
          test_id: string
        }
        Update: {
          display_order?: number | null
          id?: string
          points?: number | null
          problem_id?: string
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_questions_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_questions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "classroom_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      test_submissions: {
        Row: {
          id: string
          max_score: number | null
          score: number | null
          started_at: string
          student_id: string
          submitted_at: string | null
          test_id: string
        }
        Insert: {
          id?: string
          max_score?: number | null
          score?: number | null
          started_at?: string
          student_id: string
          submitted_at?: string | null
          test_id: string
        }
        Update: {
          id?: string
          max_score?: number | null
          score?: number | null
          started_at?: string
          student_id?: string
          submitted_at?: string | null
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_submissions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "classroom_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          name: string
          problem_count: number | null
          slug: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          name: string
          problem_count?: number | null
          slug: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          name?: string
          problem_count?: number | null
          slug?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_problem_progress: {
        Row: {
          ai_solution: string | null
          ai_solution_language: string | null
          created_at: string
          ease_factor: number | null
          id: string
          interval_days: number | null
          last_reviewed_at: string | null
          leetcode_verified: boolean | null
          next_review_at: string | null
          notes: string | null
          problem_id: string
          repetitions: number | null
          review_count: number | null
          solved_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_solution?: string | null
          ai_solution_language?: string | null
          created_at?: string
          ease_factor?: number | null
          id?: string
          interval_days?: number | null
          last_reviewed_at?: string | null
          leetcode_verified?: boolean | null
          next_review_at?: string | null
          notes?: string | null
          problem_id: string
          repetitions?: number | null
          review_count?: number | null
          solved_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_solution?: string | null
          ai_solution_language?: string | null
          created_at?: string
          ease_factor?: number | null
          id?: string
          interval_days?: number | null
          last_reviewed_at?: string | null
          leetcode_verified?: boolean | null
          next_review_at?: string | null
          notes?: string | null
          problem_id?: string
          repetitions?: number | null
          review_count?: number | null
          solved_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_problem_progress_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problems"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_otps: { Args: never; Returns: undefined }
      get_classmate_user_ids: {
        Args: { check_user_id?: string }
        Returns: string[]
      }
      get_excluded_leaderboard_user_ids: { Args: never; Returns: string[] }
      get_teacher_id_for_user: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_discount_usage: {
        Args: { code_id: string }
        Returns: undefined
      }
      is_classroom_student: {
        Args: { check_user_id?: string }
        Returns: boolean
      }
      is_student_of_classroom: {
        Args: { p_classroom_id: string }
        Returns: boolean
      }
      is_student_of_teacher: { Args: { teacher_id: string }; Returns: boolean }
      is_teacher_of_classroom: {
        Args: { classroom_id: string }
        Returns: boolean
      }
      teacher_can_view_profile: {
        Args: { profile_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "teacher"
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
      app_role: ["admin", "user", "teacher"],
    },
  },
} as const
