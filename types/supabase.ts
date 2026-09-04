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
      activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      application_status_history: {
        Row: {
          application_id: string
          changed_at: string
          changed_by: string | null
          from_status: Database["public"]["Enums"]["application_status"] | null
          id: string
          note: string | null
          to_status: Database["public"]["Enums"]["application_status"]
        }
        Insert: {
          application_id: string
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["application_status"] | null
          id?: string
          note?: string | null
          to_status: Database["public"]["Enums"]["application_status"]
        }
        Update: {
          application_id?: string
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["application_status"] | null
          id?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["application_status"]
        }
        Relationships: [
          {
            foreignKeyName: "application_status_history_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_status_history_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_allocations"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "application_status_history_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_interactions"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "application_status_history_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_rechurn"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "application_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          assigned_recruiter_id: string | null
          candidate_id: string
          created_at: string
          id: string
          job_id: string
          pipeline_stage_id: string | null
          status: Database["public"]["Enums"]["application_status"]
        }
        Insert: {
          assigned_recruiter_id?: string | null
          candidate_id: string
          created_at?: string
          id?: string
          job_id: string
          pipeline_stage_id?: string | null
          status?: Database["public"]["Enums"]["application_status"]
        }
        Update: {
          assigned_recruiter_id?: string | null
          candidate_id?: string
          created_at?: string
          id?: string
          job_id?: string
          pipeline_stage_id?: string | null
          status?: Database["public"]["Enums"]["application_status"]
        }
        Relationships: [
          {
            foreignKeyName: "applications_assigned_recruiter_id_fkey"
            columns: ["assigned_recruiter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_allocations"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_interactions"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_rechurn"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_allocations"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "applications_pipeline_stage_id_fkey"
            columns: ["pipeline_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          application_id: string
          assigned_at: string
          assigned_by: string | null
          id: string
          method: Database["public"]["Enums"]["assign_method"]
          recruiter_id: string
          status: Database["public"]["Enums"]["assignment_status"]
          unassigned_at: string | null
        }
        Insert: {
          application_id: string
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          method?: Database["public"]["Enums"]["assign_method"]
          recruiter_id: string
          status?: Database["public"]["Enums"]["assignment_status"]
          unassigned_at?: string | null
        }
        Update: {
          application_id?: string
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          method?: Database["public"]["Enums"]["assign_method"]
          recruiter_id?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          unassigned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_allocations"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "assignments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_interactions"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "assignments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_rechurn"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_recruiter_id_fkey"
            columns: ["recruiter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          agent_id: string | null
          application_id: string | null
          b2_url: string | null
          call_record_id: string | null
          call_time: string
          callback_due_at: string | null
          candidate_id: string | null
          created_at: string
          direction: string | null
          direction_normalized:
            | Database["public"]["Enums"]["call_direction"]
            | null
          disposition: Database["public"]["Enums"]["call_disposition"] | null
          duration_seconds: number | null
          id: number
          notes: string | null
          number: string | null
          recording_url: string | null
          resolved_agent_id: string | null
          storage_path: string | null
          topic: string | null
        }
        Insert: {
          agent_id?: string | null
          application_id?: string | null
          b2_url?: string | null
          call_record_id?: string | null
          call_time?: string
          callback_due_at?: string | null
          candidate_id?: string | null
          created_at?: string
          direction?: string | null
          direction_normalized?:
            | Database["public"]["Enums"]["call_direction"]
            | null
          disposition?: Database["public"]["Enums"]["call_disposition"] | null
          duration_seconds?: number | null
          id?: never
          notes?: string | null
          number?: string | null
          recording_url?: string | null
          resolved_agent_id?: string | null
          storage_path?: string | null
          topic?: string | null
        }
        Update: {
          agent_id?: string | null
          application_id?: string | null
          b2_url?: string | null
          call_record_id?: string | null
          call_time?: string
          callback_due_at?: string | null
          candidate_id?: string | null
          created_at?: string
          direction?: string | null
          direction_normalized?:
            | Database["public"]["Enums"]["call_direction"]
            | null
          disposition?: Database["public"]["Enums"]["call_disposition"] | null
          duration_seconds?: number | null
          id?: never
          notes?: string | null
          number?: string | null
          recording_url?: string | null
          resolved_agent_id?: string | null
          storage_path?: string | null
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_allocations"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "calls_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_interactions"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "calls_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_rechurn"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "calls_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_allocations"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "calls_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_interactions"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "calls_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_rechurn"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "calls_resolved_agent_id_fkey"
            columns: ["resolved_agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          duplicate_of: string | null
          email: string | null
          id: string
          is_duplicate: boolean
          name: string
          notes: string | null
          phone: string | null
          process_id: string | null
          resume_url: string | null
          source: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          duplicate_of?: string | null
          email?: string | null
          id?: string
          is_duplicate?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          process_id?: string | null
          resume_url?: string | null
          source?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          duplicate_of?: string | null
          email?: string | null
          id?: string
          is_duplicate?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          process_id?: string | null
          resume_url?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "v_allocations"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "candidates_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "v_interactions"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "candidates_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "v_rechurn"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "candidates_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          account_manager_id: string | null
          company: string
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          industry: string | null
          phone: string | null
        }
        Insert: {
          account_manager_id?: string | null
          company: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          phone?: string | null
        }
        Update: {
          account_manager_id?: string | null
          company?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_account_manager_id_fkey"
            columns: ["account_manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
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
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_ups: {
        Row: {
          application_id: string
          assign_to: string | null
          assigned_by: string | null
          candidate_id: string
          completed_at: string | null
          created_at: string
          due_at: string
          id: string
          is_recurring: boolean
          note: string | null
          recurrence_rule: string | null
          status: Database["public"]["Enums"]["follow_up_status"]
        }
        Insert: {
          application_id: string
          assign_to?: string | null
          assigned_by?: string | null
          candidate_id: string
          completed_at?: string | null
          created_at?: string
          due_at: string
          id?: string
          is_recurring?: boolean
          note?: string | null
          recurrence_rule?: string | null
          status?: Database["public"]["Enums"]["follow_up_status"]
        }
        Update: {
          application_id?: string
          assign_to?: string | null
          assigned_by?: string | null
          candidate_id?: string
          completed_at?: string | null
          created_at?: string
          due_at?: string
          id?: string
          is_recurring?: boolean
          note?: string | null
          recurrence_rule?: string | null
          status?: Database["public"]["Enums"]["follow_up_status"]
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_allocations"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "follow_ups_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_interactions"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "follow_ups_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_rechurn"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "follow_ups_assign_to_fkey"
            columns: ["assign_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_allocations"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "follow_ups_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_interactions"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "follow_ups_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "v_rechurn"
            referencedColumns: ["candidate_id"]
          },
        ]
      }
      import_batches: {
        Row: {
          created_at: string
          filename: string
          id: string
          imported_rows: number
          process_id: string | null
          skipped_rows: number
          status: Database["public"]["Enums"]["import_status"]
          total_rows: number
          upload_type: Database["public"]["Enums"]["upload_type"]
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          imported_rows?: number
          process_id?: string | null
          skipped_rows?: number
          status?: Database["public"]["Enums"]["import_status"]
          total_rows?: number
          upload_type: Database["public"]["Enums"]["upload_type"]
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          imported_rows?: number
          process_id?: string | null
          skipped_rows?: number
          status?: Database["public"]["Enums"]["import_status"]
          total_rows?: number
          upload_type?: Database["public"]["Enums"]["upload_type"]
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_batches_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      import_rows: {
        Row: {
          created_at: string
          decision: Database["public"]["Enums"]["import_decision"]
          id: string
          import_batch_id: string
          matched_candidate_id: string | null
          raw: Json
        }
        Insert: {
          created_at?: string
          decision?: Database["public"]["Enums"]["import_decision"]
          id?: string
          import_batch_id: string
          matched_candidate_id?: string | null
          raw: Json
        }
        Update: {
          created_at?: string
          decision?: Database["public"]["Enums"]["import_decision"]
          id?: string
          import_batch_id?: string
          matched_candidate_id?: string | null
          raw?: Json
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_rows_matched_candidate_id_fkey"
            columns: ["matched_candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_rows_matched_candidate_id_fkey"
            columns: ["matched_candidate_id"]
            isOneToOne: false
            referencedRelation: "v_allocations"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "import_rows_matched_candidate_id_fkey"
            columns: ["matched_candidate_id"]
            isOneToOne: false
            referencedRelation: "v_interactions"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "import_rows_matched_candidate_id_fkey"
            columns: ["matched_candidate_id"]
            isOneToOne: false
            referencedRelation: "v_rechurn"
            referencedColumns: ["candidate_id"]
          },
        ]
      }
      jobs: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          openings: number
          pipeline_template_id: string
          status: Database["public"]["Enums"]["job_status"]
          title: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          openings?: number
          pipeline_template_id: string
          status?: Database["public"]["Enums"]["job_status"]
          title: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          openings?: number
          pipeline_template_id?: string
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_pipeline_template_id_fkey"
            columns: ["pipeline_template_id"]
            isOneToOne: false
            referencedRelation: "pipeline_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          application_id: string
          author_id: string | null
          body: string
          created_at: string
          id: string
        }
        Insert: {
          application_id: string
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
        }
        Update: {
          application_id?: string
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_allocations"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_interactions"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_rechurn"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          enabled: boolean
          id: string
          key: string
          threshold_unit: Database["public"]["Enums"]["threshold_unit"] | null
          threshold_value: number | null
          user_id: string | null
        }
        Insert: {
          enabled?: boolean
          id?: string
          key: string
          threshold_unit?: Database["public"]["Enums"]["threshold_unit"] | null
          threshold_value?: number | null
          user_id?: string | null
        }
        Update: {
          enabled?: boolean
          id?: string
          key?: string
          threshold_unit?: Database["public"]["Enums"]["threshold_unit"] | null
          threshold_value?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string | null
          id: string
          key: string
          label: string
        }
        Insert: {
          category?: string | null
          id?: string
          key: string
          label: string
        }
        Update: {
          category?: string | null
          id?: string
          key?: string
          label?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          id: string
          is_terminal: boolean
          name: string
          pipeline_template_id: string
          sequence_order: number
        }
        Insert: {
          id?: string
          is_terminal?: boolean
          name: string
          pipeline_template_id: string
          sequence_order: number
        }
        Update: {
          id?: string
          is_terminal?: boolean
          name?: string
          pipeline_template_id?: string
          sequence_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_pipeline_template_id_fkey"
            columns: ["pipeline_template_id"]
            isOneToOne: false
            referencedRelation: "pipeline_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_templates: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
        }
        Relationships: []
      }
      processes: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
        }
        Relationships: []
      }
      report_requests: {
        Row: {
          created_at: string
          date_basis: Database["public"]["Enums"]["date_basis"]
          date_from: string
          date_to: string
          file_url: string | null
          id: string
          report_type: string
          requested_by: string | null
          status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          created_at?: string
          date_basis?: Database["public"]["Enums"]["date_basis"]
          date_from: string
          date_to: string
          file_url?: string | null
          id?: string
          report_type: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          created_at?: string
          date_basis?: Database["public"]["Enums"]["date_basis"]
          date_from?: string
          date_to?: string
          file_url?: string | null
          id?: string
          report_type?: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "report_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          badge_bg: string | null
          created_at: string
          dot_color: string | null
          id: string
          is_system: boolean
          name: string
        }
        Insert: {
          badge_bg?: string | null
          created_at?: string
          dot_color?: string | null
          id?: string
          is_system?: boolean
          name: string
        }
        Update: {
          badge_bg?: string | null
          created_at?: string
          dot_color?: string | null
          id?: string
          is_system?: boolean
          name?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          add_ons: string | null
          avatar_color: string | null
          created_at: string
          email: string
          id: string
          joined_on: string | null
          live_status: Database["public"]["Enums"]["live_status"] | null
          live_status_since: string | null
          name: string
          phone: string | null
          process_id: string | null
          reports_to: string | null
          role_id: string | null
          status: Database["public"]["Enums"]["user_status"]
        }
        Insert: {
          add_ons?: string | null
          avatar_color?: string | null
          created_at?: string
          email: string
          id: string
          joined_on?: string | null
          live_status?: Database["public"]["Enums"]["live_status"] | null
          live_status_since?: string | null
          name: string
          phone?: string | null
          process_id?: string | null
          reports_to?: string | null
          role_id?: string | null
          status?: Database["public"]["Enums"]["user_status"]
        }
        Update: {
          add_ons?: string | null
          avatar_color?: string | null
          created_at?: string
          email?: string
          id?: string
          joined_on?: string | null
          live_status?: Database["public"]["Enums"]["live_status"] | null
          live_status_since?: string | null
          name?: string
          phone?: string | null
          process_id?: string | null
          reports_to?: string | null
          role_id?: string | null
          status?: Database["public"]["Enums"]["user_status"]
        }
        Relationships: [
          {
            foreignKeyName: "users_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_reports_to_fkey"
            columns: ["reports_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          created_at: string
          created_by: string | null
          full_text: string
          id: string
          name: string
          process_id: string | null
          visibility: Database["public"]["Enums"]["template_visibility"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          full_text: string
          id?: string
          name: string
          process_id?: string | null
          visibility?: Database["public"]["Enums"]["template_visibility"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          full_text?: string
          id?: string
          name?: string
          process_id?: string | null
          visibility?: Database["public"]["Enums"]["template_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_templates_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_allocations: {
        Row: {
          application_id: string | null
          application_status:
            | Database["public"]["Enums"]["application_status"]
            | null
          assign_to: string | null
          bucket: string | null
          candidate_id: string | null
          created_by: string | null
          created_on: string | null
          job_id: string | null
          job_title: string | null
          name: string | null
          phone: string | null
          sourced_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_assigned_recruiter_id_fkey"
            columns: ["assign_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_created_by_fkey"
            columns: ["sourced_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      v_interactions: {
        Row: {
          application_id: string | null
          application_status:
            | Database["public"]["Enums"]["application_status"]
            | null
          assign_to: string | null
          assigned_by: string | null
          candidate_id: string | null
          interacted_on: string | null
          name: string | null
          phone: string | null
          sourced_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_assigned_recruiter_id_fkey"
            columns: ["assign_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_created_by_fkey"
            columns: ["sourced_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      v_rechurn: {
        Row: {
          application_id: string | null
          application_status:
            | Database["public"]["Enums"]["application_status"]
            | null
          assigned_recruiter_id: string | null
          candidate_id: string | null
          created_at: string | null
          last_interaction_at: string | null
          name: string | null
          phone: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_assigned_recruiter_id_fkey"
            columns: ["assigned_recruiter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      application_status:
        | "new"
        | "contacted"
        | "interview_scheduled"
        | "interview_done"
        | "selected"
        | "rejected"
        | "not_interested"
        | "no_response"
        | "joined"
      assign_method: "round_robin" | "load_balanced" | "manual"
      assignment_status: "active" | "reassigned"
      call_direction: "outbound" | "inbound"
      call_disposition: "interested" | "callback_later" | "not_reachable"
      date_basis: "created_date" | "last_interaction"
      follow_up_status: "pending" | "completed" | "cancelled"
      import_decision: "pending" | "skip" | "import_anyway"
      import_status:
        | "uploading"
        | "validating"
        | "review"
        | "completed"
        | "failed"
      job_status: "open" | "on_hold" | "closed"
      live_status: "on_call" | "idle" | "on_break" | "offline"
      report_status: "queued" | "ready" | "failed"
      template_visibility: "all" | "process" | "private"
      threshold_unit: "hours" | "minutes"
      upload_type: "allocations" | "customers"
      user_status: "active" | "invited" | "inactive"
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
    Enums: {
      application_status: [
        "new",
        "contacted",
        "interview_scheduled",
        "interview_done",
        "selected",
        "rejected",
        "not_interested",
        "no_response",
        "joined",
      ],
      assign_method: ["round_robin", "load_balanced", "manual"],
      assignment_status: ["active", "reassigned"],
      call_direction: ["outbound", "inbound"],
      call_disposition: ["interested", "callback_later", "not_reachable"],
      date_basis: ["created_date", "last_interaction"],
      follow_up_status: ["pending", "completed", "cancelled"],
      import_decision: ["pending", "skip", "import_anyway"],
      import_status: [
        "uploading",
        "validating",
        "review",
        "completed",
        "failed",
      ],
      job_status: ["open", "on_hold", "closed"],
      live_status: ["on_call", "idle", "on_break", "offline"],
      report_status: ["queued", "ready", "failed"],
      template_visibility: ["all", "process", "private"],
      threshold_unit: ["hours", "minutes"],
      upload_type: ["allocations", "customers"],
      user_status: ["active", "invited", "inactive"],
    },
  },
} as const
