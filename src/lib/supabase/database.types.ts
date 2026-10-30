
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "academic_sessions": {
                  Row: {
                    "created_at": string,"end_date": string,"id": string,"is_current": boolean,"name": string,"start_date": string,"status": Database["public"]['Enums']["record_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"end_date": string,"id"?: string,"is_current"?: boolean,"name": string,"start_date": string,"status"?: Database["public"]['Enums']["record_status"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"end_date"?: string,"id"?: string,"is_current"?: boolean,"name"?: string,"start_date"?: string,"status"?: Database["public"]['Enums']["record_status"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"admission_documents": {
                  Row: {
                    "admission_id": string,"created_at": string,"document_name": string,"file_document_id": string | null,"id": string,"is_required": boolean,"remarks": string | null,"submitted": boolean,"verified": boolean,"verified_at": string | null,"verified_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "admission_id": string,"created_at"?: string,"document_name": string,"file_document_id"?: string | null,"id"?: string,"is_required"?: boolean,"remarks"?: string | null,"submitted"?: boolean,"verified"?: boolean,"verified_at"?: string | null,"verified_by"?: string | null
                  }
                  Update: {
                    "admission_id"?: string,"created_at"?: string,"document_name"?: string,"file_document_id"?: string | null,"id"?: string,"is_required"?: boolean,"remarks"?: string | null,"submitted"?: boolean,"verified"?: boolean,"verified_at"?: string | null,"verified_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "admission_documents_admission_id_fkey"
      columns: ["admission_id"]
isOneToOne: false
      referencedRelation: "admissions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "admission_documents_file_fk"
      columns: ["file_document_id"]
isOneToOne: false
      referencedRelation: "document_metadata"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "admission_documents_verified_by_fkey"
      columns: ["verified_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"admission_periods": {
                  Row: {
                    "academic_session_id": string,"admission_fee": number,"closes_on": string,"created_at": string,"eligibility_rules": string | null,"id": string,"is_active": boolean,"min_qualifying_percent": number | null,"opens_on": string,"programme_id": string,"required_documents": (string)[],"seats": number | null,"term_id": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_session_id": string,"admission_fee"?: number,"closes_on": string,"created_at"?: string,"eligibility_rules"?: string | null,"id"?: string,"is_active"?: boolean,"min_qualifying_percent"?: number | null,"opens_on": string,"programme_id": string,"required_documents"?: (string)[],"seats"?: number | null,"term_id": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "academic_session_id"?: string,"admission_fee"?: number,"closes_on"?: string,"created_at"?: string,"eligibility_rules"?: string | null,"id"?: string,"is_active"?: boolean,"min_qualifying_percent"?: number | null,"opens_on"?: string,"programme_id"?: string,"required_documents"?: (string)[],"seats"?: number | null,"term_id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "admission_periods_academic_session_id_fkey"
      columns: ["academic_session_id"]
isOneToOne: false
      referencedRelation: "academic_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "admission_periods_programme_id_fkey"
      columns: ["programme_id"]
isOneToOne: false
      referencedRelation: "programmes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "admission_periods_term_id_fkey"
      columns: ["term_id"]
isOneToOne: false
      referencedRelation: "programme_terms"
      referencedColumns: ["id"]
    }
                  ]
                },"admissions": {
                  Row: {
                    "address": string | null,"admission_fee_paid": boolean,"admission_fee_payment_id": string | null,"admission_period_id": string,"applicant_name": string,"application_no": string,"created_at": string,"created_by": string | null,"date_of_birth": string,"email": string | null,"gender": Database["public"]['Enums']["gender"],"guardian_name": string | null,"guardian_phone": string | null,"guardian_relationship": string | null,"id": string,"phone": string,"preferred_offering_ids": (string)[],"previous_board": string | null,"previous_exam": string | null,"previous_institution": string | null,"previous_percentage": number | null,"previous_year": number | null,"review_remarks": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"status": Database["public"]['Enums']["admission_status"],"student_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"admission_fee_paid"?: boolean,"admission_fee_payment_id"?: string | null,"admission_period_id": string,"applicant_name": string,"application_no": string,"created_at"?: string,"created_by"?: string | null,"date_of_birth": string,"email"?: string | null,"gender"?: Database["public"]['Enums']["gender"],"guardian_name"?: string | null,"guardian_phone"?: string | null,"guardian_relationship"?: string | null,"id"?: string,"phone": string,"preferred_offering_ids"?: (string)[],"previous_board"?: string | null,"previous_exam"?: string | null,"previous_institution"?: string | null,"previous_percentage"?: number | null,"previous_year"?: number | null,"review_remarks"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["admission_status"],"student_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"admission_fee_paid"?: boolean,"admission_fee_payment_id"?: string | null,"admission_period_id"?: string,"applicant_name"?: string,"application_no"?: string,"created_at"?: string,"created_by"?: string | null,"date_of_birth"?: string,"email"?: string | null,"gender"?: Database["public"]['Enums']["gender"],"guardian_name"?: string | null,"guardian_phone"?: string | null,"guardian_relationship"?: string | null,"id"?: string,"phone"?: string,"preferred_offering_ids"?: (string)[],"previous_board"?: string | null,"previous_exam"?: string | null,"previous_institution"?: string | null,"previous_percentage"?: number | null,"previous_year"?: number | null,"review_remarks"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["admission_status"],"student_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "admissions_admission_period_id_fkey"
      columns: ["admission_period_id"]
isOneToOne: false
      referencedRelation: "admission_periods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "admissions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "admissions_fee_payment_fk"
      columns: ["admission_fee_payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "admissions_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "admissions_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"attendance_records": {
                  Row: {
                    "attendance_session_id": string,"id": string,"recorded_by": string | null,"remarks": string | null,"status_code": string,"student_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attendance_session_id": string,"id"?: string,"recorded_by"?: string | null,"remarks"?: string | null,"status_code": string,"student_id": string,"updated_at"?: string
                  }
                  Update: {
                    "attendance_session_id"?: string,"id"?: string,"recorded_by"?: string | null,"remarks"?: string | null,"status_code"?: string,"student_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_records_attendance_session_id_fkey"
      columns: ["attendance_session_id"]
isOneToOne: false
      referencedRelation: "attendance_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_records_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_records_status_code_fkey"
      columns: ["status_code"]
isOneToOne: false
      referencedRelation: "attendance_statuses"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "attendance_records_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"attendance_sessions": {
                  Row: {
                    "academic_session_id": string,"course_offering_id": string | null,"created_at": string,"created_by": string | null,"date": string,"id": string,"is_locked": boolean,"period": number,"programme_id": string,"term_id": string,"topic": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_session_id": string,"course_offering_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"date": string,"id"?: string,"is_locked"?: boolean,"period"?: number,"programme_id": string,"term_id": string,"topic"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "academic_session_id"?: string,"course_offering_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"date"?: string,"id"?: string,"is_locked"?: boolean,"period"?: number,"programme_id"?: string,"term_id"?: string,"topic"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_sessions_academic_session_id_fkey"
      columns: ["academic_session_id"]
isOneToOne: false
      referencedRelation: "academic_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_sessions_course_offering_id_fkey"
      columns: ["course_offering_id"]
isOneToOne: false
      referencedRelation: "course_offerings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_sessions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_sessions_programme_id_fkey"
      columns: ["programme_id"]
isOneToOne: false
      referencedRelation: "programmes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_sessions_term_id_fkey"
      columns: ["term_id"]
isOneToOne: false
      referencedRelation: "programme_terms"
      referencedColumns: ["id"]
    }
                  ]
                },"attendance_statuses": {
                  Row: {
                    "code": string,"counts_as_present": boolean,"counts_in_total": boolean,"is_active": boolean,"label": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"counts_as_present": boolean,"counts_in_total"?: boolean,"is_active"?: boolean,"label": string,"sort_order"?: number
                  }
                  Update: {
                    "code"?: string,"counts_as_present"?: boolean,"counts_in_total"?: boolean,"is_active"?: boolean,"label"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_label": string | null,"created_at": string,"details": NonNullable<Json>,"entity_id": string | null,"entity_type": string,"id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_label"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"entity_id"?: string | null,"entity_type": string,"id"?: never
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_label"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"entity_id"?: string | null,"entity_type"?: string,"id"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"course_categories": {
                  Row: {
                    "code": string,"id": string,"level": Database["public"]['Enums']["programme_level"],"name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"id"?: string,"level": Database["public"]['Enums']["programme_level"],"name": string,"sort_order"?: number
                  }
                  Update: {
                    "code"?: string,"id"?: string,"level"?: Database["public"]['Enums']["programme_level"],"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"course_offerings": {
                  Row: {
                    "academic_session_id": string,"category_id": string | null,"created_at": string,"credits": number | null,"id": string,"is_compulsory": boolean,"programme_id": string,"subject_id": string,"term_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_session_id": string,"category_id"?: string | null,"created_at"?: string,"credits"?: number | null,"id"?: string,"is_compulsory"?: boolean,"programme_id": string,"subject_id": string,"term_id": string
                  }
                  Update: {
                    "academic_session_id"?: string,"category_id"?: string | null,"created_at"?: string,"credits"?: number | null,"id"?: string,"is_compulsory"?: boolean,"programme_id"?: string,"subject_id"?: string,"term_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "course_offerings_academic_session_id_fkey"
      columns: ["academic_session_id"]
isOneToOne: false
      referencedRelation: "academic_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "course_offerings_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "course_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "course_offerings_programme_id_fkey"
      columns: ["programme_id"]
isOneToOne: false
      referencedRelation: "programmes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "course_offerings_subject_id_fkey"
      columns: ["subject_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "course_offerings_term_id_fkey"
      columns: ["term_id"]
isOneToOne: false
      referencedRelation: "programme_terms"
      referencedColumns: ["id"]
    }
                  ]
                },"departments": {
                  Row: {
                    "code": string,"created_at": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"document_metadata": {
                  Row: {
                    "bucket": string,"category": string | null,"created_at": string,"id": string,"mime_type": string,"original_name": string,"owner_id": string | null,"owner_type": string,"path": string,"size_bytes": number,"uploaded_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket": string,"category"?: string | null,"created_at"?: string,"id"?: string,"mime_type": string,"original_name": string,"owner_id"?: string | null,"owner_type": string,"path": string,"size_bytes": number,"uploaded_by"?: string | null
                  }
                  Update: {
                    "bucket"?: string,"category"?: string | null,"created_at"?: string,"id"?: string,"mime_type"?: string,"original_name"?: string,"owner_id"?: string | null,"owner_type"?: string,"path"?: string,"size_bytes"?: number,"uploaded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "document_metadata_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"examination_candidates": {
                  Row: {
                    "course_offering_id": string,"created_at": string,"examination_id": string,"source_result_id": string | null,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_offering_id": string,"created_at"?: string,"examination_id": string,"source_result_id"?: string | null,"student_id": string
                  }
                  Update: {
                    "course_offering_id"?: string,"created_at"?: string,"examination_id"?: string,"source_result_id"?: string | null,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "examination_candidates_course_offering_id_fkey"
      columns: ["course_offering_id"]
isOneToOne: false
      referencedRelation: "course_offerings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "examination_candidates_examination_id_fkey"
      columns: ["examination_id"]
isOneToOne: false
      referencedRelation: "examinations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "examination_candidates_source_fk"
      columns: ["source_result_id"]
isOneToOne: false
      referencedRelation: "results"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "examination_candidates_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"examination_subjects": {
                  Row: {
                    "component": Database["public"]['Enums']["exam_component"],"course_offering_id": string,"created_at": string,"duration_minutes": number | null,"exam_date": string | null,"examination_id": string,"examiner_staff_id": string | null,"id": string,"marks_deadline": string | null,"max_marks": number,"pass_marks": number | null,"start_time": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "component"?: Database["public"]['Enums']["exam_component"],"course_offering_id": string,"created_at"?: string,"duration_minutes"?: number | null,"exam_date"?: string | null,"examination_id": string,"examiner_staff_id"?: string | null,"id"?: string,"marks_deadline"?: string | null,"max_marks": number,"pass_marks"?: number | null,"start_time"?: string | null
                  }
                  Update: {
                    "component"?: Database["public"]['Enums']["exam_component"],"course_offering_id"?: string,"created_at"?: string,"duration_minutes"?: number | null,"exam_date"?: string | null,"examination_id"?: string,"examiner_staff_id"?: string | null,"id"?: string,"marks_deadline"?: string | null,"max_marks"?: number,"pass_marks"?: number | null,"start_time"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "examination_subjects_course_offering_id_fkey"
      columns: ["course_offering_id"]
isOneToOne: false
      referencedRelation: "course_offerings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "examination_subjects_examination_id_fkey"
      columns: ["examination_id"]
isOneToOne: false
      referencedRelation: "examinations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "examination_subjects_examiner_staff_id_fkey"
      columns: ["examiner_staff_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    }
                  ]
                },"examination_types": {
                  Row: {
                    "code": string,"id": string,"is_active": boolean,"is_supplementary": boolean,"name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"id"?: string,"is_active"?: boolean,"is_supplementary"?: boolean,"name": string,"sort_order"?: number
                  }
                  Update: {
                    "code"?: string,"id"?: string,"is_active"?: boolean,"is_supplementary"?: boolean,"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"examinations": {
                  Row: {
                    "academic_session_id": string,"approved_at": string | null,"approved_by": string | null,"candidate_mode": string,"created_at": string,"created_by": string | null,"end_date": string | null,"examination_type_id": string,"grading_scheme_id": string,"id": string,"is_provisional": boolean,"locked_at": string | null,"locked_by": string | null,"marks_entry_deadline": string | null,"name": string,"processed_at": string | null,"processed_by": string | null,"programme_id": string,"published_at": string | null,"published_by": string | null,"start_date": string | null,"status": Database["public"]['Enums']["exam_status"],"term_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_session_id": string,"approved_at"?: string | null,"approved_by"?: string | null,"candidate_mode"?: string,"created_at"?: string,"created_by"?: string | null,"end_date"?: string | null,"examination_type_id": string,"grading_scheme_id": string,"id"?: string,"is_provisional"?: boolean,"locked_at"?: string | null,"locked_by"?: string | null,"marks_entry_deadline"?: string | null,"name": string,"processed_at"?: string | null,"processed_by"?: string | null,"programme_id": string,"published_at"?: string | null,"published_by"?: string | null,"start_date"?: string | null,"status"?: Database["public"]['Enums']["exam_status"],"term_id": string,"updated_at"?: string
                  }
                  Update: {
                    "academic_session_id"?: string,"approved_at"?: string | null,"approved_by"?: string | null,"candidate_mode"?: string,"created_at"?: string,"created_by"?: string | null,"end_date"?: string | null,"examination_type_id"?: string,"grading_scheme_id"?: string,"id"?: string,"is_provisional"?: boolean,"locked_at"?: string | null,"locked_by"?: string | null,"marks_entry_deadline"?: string | null,"name"?: string,"processed_at"?: string | null,"processed_by"?: string | null,"programme_id"?: string,"published_at"?: string | null,"published_by"?: string | null,"start_date"?: string | null,"status"?: Database["public"]['Enums']["exam_status"],"term_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "examinations_academic_session_id_fkey"
      columns: ["academic_session_id"]
isOneToOne: false
      referencedRelation: "academic_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "examinations_approved_by_fkey"
      columns: ["approved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "examinations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "examinations_examination_type_id_fkey"
      columns: ["examination_type_id"]
isOneToOne: false
      referencedRelation: "examination_types"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "examinations_grading_scheme_id_fkey"
      columns: ["grading_scheme_id"]
isOneToOne: false
      referencedRelation: "grading_schemes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "examinations_locked_by_fkey"
      columns: ["locked_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "examinations_processed_by_fkey"
      columns: ["processed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "examinations_programme_id_fkey"
      columns: ["programme_id"]
isOneToOne: false
      referencedRelation: "programmes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "examinations_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "examinations_term_id_fkey"
      columns: ["term_id"]
isOneToOne: false
      referencedRelation: "programme_terms"
      referencedColumns: ["id"]
    }
                  ]
                },"fee_concessions": {
                  Row: {
                    "amount": number,"decided_at": string | null,"decided_by": string | null,"decision_remarks": string | null,"id": string,"kind": string,"reason": string,"requested_at": string,"requested_by": string | null,"status": Database["public"]['Enums']["concession_status"],"student_fee_assignment_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"decided_at"?: string | null,"decided_by"?: string | null,"decision_remarks"?: string | null,"id"?: string,"kind": string,"reason": string,"requested_at"?: string,"requested_by"?: string | null,"status"?: Database["public"]['Enums']["concession_status"],"student_fee_assignment_id": string
                  }
                  Update: {
                    "amount"?: number,"decided_at"?: string | null,"decided_by"?: string | null,"decision_remarks"?: string | null,"id"?: string,"kind"?: string,"reason"?: string,"requested_at"?: string,"requested_by"?: string | null,"status"?: Database["public"]['Enums']["concession_status"],"student_fee_assignment_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fee_concessions_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fee_concessions_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fee_concessions_student_fee_assignment_id_fkey"
      columns: ["student_fee_assignment_id"]
isOneToOne: false
      referencedRelation: "student_fee_assignments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fee_concessions_student_fee_assignment_id_fkey"
      columns: ["student_fee_assignment_id"]
isOneToOne: false
      referencedRelation: "student_fee_balances"
      referencedColumns: ["assignment_id"]
    }
                  ]
                },"fee_heads": {
                  Row: {
                    "category": Database["public"]['Enums']["fee_category"],"code": string,"id": string,"is_active": boolean,"is_optional": boolean,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": Database["public"]['Enums']["fee_category"],"code": string,"id"?: string,"is_active"?: boolean,"is_optional"?: boolean,"name": string
                  }
                  Update: {
                    "category"?: Database["public"]['Enums']["fee_category"],"code"?: string,"id"?: string,"is_active"?: boolean,"is_optional"?: boolean,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"fee_structure_items": {
                  Row: {
                    "amount": number,"fee_head_id": string,"fee_structure_id": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"fee_head_id": string,"fee_structure_id": string,"id"?: string
                  }
                  Update: {
                    "amount"?: number,"fee_head_id"?: string,"fee_structure_id"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fee_structure_items_fee_head_id_fkey"
      columns: ["fee_head_id"]
isOneToOne: false
      referencedRelation: "fee_heads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fee_structure_items_fee_structure_id_fkey"
      columns: ["fee_structure_id"]
isOneToOne: false
      referencedRelation: "fee_structures"
      referencedColumns: ["id"]
    }
                  ]
                },"fee_structures": {
                  Row: {
                    "academic_session_id": string,"created_at": string,"due_date": string | null,"id": string,"is_active": boolean,"late_fine_per_day": number,"name": string,"programme_id": string,"term_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_session_id": string,"created_at"?: string,"due_date"?: string | null,"id"?: string,"is_active"?: boolean,"late_fine_per_day"?: number,"name": string,"programme_id": string,"term_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "academic_session_id"?: string,"created_at"?: string,"due_date"?: string | null,"id"?: string,"is_active"?: boolean,"late_fine_per_day"?: number,"name"?: string,"programme_id"?: string,"term_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fee_structures_academic_session_id_fkey"
      columns: ["academic_session_id"]
isOneToOne: false
      referencedRelation: "academic_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fee_structures_programme_id_fkey"
      columns: ["programme_id"]
isOneToOne: false
      referencedRelation: "programmes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fee_structures_term_id_fkey"
      columns: ["term_id"]
isOneToOne: false
      referencedRelation: "programme_terms"
      referencedColumns: ["id"]
    }
                  ]
                },"grading_rules": {
                  Row: {
                    "description": string | null,"grade": string,"grade_point": number | null,"grading_scheme_id": string,"id": string,"is_pass": boolean,"min_percent": number
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string | null,"grade": string,"grade_point"?: number | null,"grading_scheme_id": string,"id"?: string,"is_pass"?: boolean,"min_percent": number
                  }
                  Update: {
                    "description"?: string | null,"grade"?: string,"grade_point"?: number | null,"grading_scheme_id"?: string,"id"?: string,"is_pass"?: boolean,"min_percent"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "grading_rules_grading_scheme_id_fkey"
      columns: ["grading_scheme_id"]
isOneToOne: false
      referencedRelation: "grading_schemes"
      referencedColumns: ["id"]
    }
                  ]
                },"grading_schemes": {
                  Row: {
                    "aggregate_pass_percent": number | null,"created_at": string,"decimals": number,"description": string | null,"id": string,"is_active": boolean,"level": Database["public"]['Enums']["programme_level"] | null,"max_failed_subjects_for_compartment": number,"name": string,"require_all_subjects_pass": boolean,"require_component_pass": boolean,"subject_pass_percent": number | null,"updated_at": string,"use_credits": boolean,"use_grade_points": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "aggregate_pass_percent"?: number | null,"created_at"?: string,"decimals"?: number,"description"?: string | null,"id"?: string,"is_active"?: boolean,"level"?: Database["public"]['Enums']["programme_level"] | null,"max_failed_subjects_for_compartment"?: number,"name": string,"require_all_subjects_pass"?: boolean,"require_component_pass"?: boolean,"subject_pass_percent"?: number | null,"updated_at"?: string,"use_credits"?: boolean,"use_grade_points"?: boolean
                  }
                  Update: {
                    "aggregate_pass_percent"?: number | null,"created_at"?: string,"decimals"?: number,"description"?: string | null,"id"?: string,"is_active"?: boolean,"level"?: Database["public"]['Enums']["programme_level"] | null,"max_failed_subjects_for_compartment"?: number,"name"?: string,"require_all_subjects_pass"?: boolean,"require_component_pass"?: boolean,"subject_pass_percent"?: number | null,"updated_at"?: string,"use_credits"?: boolean,"use_grade_points"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"institution_settings": {
                  Row: {
                    "address": string,"admission_no_prefix": string,"application_no_prefix": string,"attendance_edit_window_days": number,"attendance_threshold": number,"email": string | null,"financial_year_start_month": number,"id": number,"logo_path": string | null,"marksheet_footer_note": string,"name": string,"phone": string | null,"receipt_no_prefix": string,"short_name": string,"updated_at": string,"updated_by": string | null,"website": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string,"admission_no_prefix"?: string,"application_no_prefix"?: string,"attendance_edit_window_days"?: number,"attendance_threshold"?: number,"email"?: string | null,"financial_year_start_month"?: number,"id"?: number,"logo_path"?: string | null,"marksheet_footer_note"?: string,"name"?: string,"phone"?: string | null,"receipt_no_prefix"?: string,"short_name"?: string,"updated_at"?: string,"updated_by"?: string | null,"website"?: string | null
                  }
                  Update: {
                    "address"?: string,"admission_no_prefix"?: string,"application_no_prefix"?: string,"attendance_edit_window_days"?: number,"attendance_threshold"?: number,"email"?: string | null,"financial_year_start_month"?: number,"id"?: number,"logo_path"?: string | null,"marksheet_footer_note"?: string,"name"?: string,"phone"?: string | null,"receipt_no_prefix"?: string,"short_name"?: string,"updated_at"?: string,"updated_by"?: string | null,"website"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "institution_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"mark_revisions": {
                  Row: {
                    "changed_at": string,"changed_by": string | null,"examination_subject_id": string,"id": number,"mark_id": string | null,"new_marks": number | null,"new_status": Database["public"]['Enums']["mark_status"] | null,"old_marks": number | null,"old_status": Database["public"]['Enums']["mark_status"] | null,"reason": string | null,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "changed_at"?: string,"changed_by"?: string | null,"examination_subject_id": string,"id"?: never,"mark_id"?: string | null,"new_marks"?: number | null,"new_status"?: Database["public"]['Enums']["mark_status"] | null,"old_marks"?: number | null,"old_status"?: Database["public"]['Enums']["mark_status"] | null,"reason"?: string | null,"student_id": string
                  }
                  Update: {
                    "changed_at"?: string,"changed_by"?: string | null,"examination_subject_id"?: string,"id"?: never,"mark_id"?: string | null,"new_marks"?: number | null,"new_status"?: Database["public"]['Enums']["mark_status"] | null,"old_marks"?: number | null,"old_status"?: Database["public"]['Enums']["mark_status"] | null,"reason"?: string | null,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mark_revisions_changed_by_fkey"
      columns: ["changed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mark_revisions_examination_subject_id_fkey"
      columns: ["examination_subject_id"]
isOneToOne: false
      referencedRelation: "examination_subjects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mark_revisions_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"marks": {
                  Row: {
                    "entered_at": string,"entered_by": string | null,"examination_subject_id": string,"id": string,"marks_obtained": number | null,"revision": number,"status": Database["public"]['Enums']["mark_status"],"student_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "entered_at"?: string,"entered_by"?: string | null,"examination_subject_id": string,"id"?: string,"marks_obtained"?: number | null,"revision"?: number,"status"?: Database["public"]['Enums']["mark_status"],"student_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "entered_at"?: string,"entered_by"?: string | null,"examination_subject_id"?: string,"id"?: string,"marks_obtained"?: number | null,"revision"?: number,"status"?: Database["public"]['Enums']["mark_status"],"student_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "marks_entered_by_fkey"
      columns: ["entered_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "marks_examination_subject_id_fkey"
      columns: ["examination_subject_id"]
isOneToOne: false
      referencedRelation: "examination_subjects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "marks_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "marks_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notice_audiences": {
                  Row: {
                    "audience": string,"id": string,"notice_id": string,"programme_id": string | null,"term_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "audience": string,"id"?: string,"notice_id": string,"programme_id"?: string | null,"term_id"?: string | null
                  }
                  Update: {
                    "audience"?: string,"id"?: string,"notice_id"?: string,"programme_id"?: string | null,"term_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "notice_audiences_notice_id_fkey"
      columns: ["notice_id"]
isOneToOne: false
      referencedRelation: "notices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notice_audiences_programme_id_fkey"
      columns: ["programme_id"]
isOneToOne: false
      referencedRelation: "programmes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notice_audiences_term_id_fkey"
      columns: ["term_id"]
isOneToOne: false
      referencedRelation: "programme_terms"
      referencedColumns: ["id"]
    }
                  ]
                },"notices": {
                  Row: {
                    "attachment_document_id": string | null,"author_id": string | null,"body": string,"category": Database["public"]['Enums']["notice_category"],"created_at": string,"expires_at": string | null,"id": string,"is_pinned": boolean,"publish_at": string | null,"published_at": string | null,"published_by": string | null,"status": Database["public"]['Enums']["notice_status"],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attachment_document_id"?: string | null,"author_id"?: string | null,"body": string,"category"?: Database["public"]['Enums']["notice_category"],"created_at"?: string,"expires_at"?: string | null,"id"?: string,"is_pinned"?: boolean,"publish_at"?: string | null,"published_at"?: string | null,"published_by"?: string | null,"status"?: Database["public"]['Enums']["notice_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "attachment_document_id"?: string | null,"author_id"?: string | null,"body"?: string,"category"?: Database["public"]['Enums']["notice_category"],"created_at"?: string,"expires_at"?: string | null,"id"?: string,"is_pinned"?: boolean,"publish_at"?: string | null,"published_at"?: string | null,"published_by"?: string | null,"status"?: Database["public"]['Enums']["notice_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notices_attachment_document_id_fkey"
      columns: ["attachment_document_id"]
isOneToOne: false
      referencedRelation: "document_metadata"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notices_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notices_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"id": string,"kind": string,"link": string | null,"read_at": string | null,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"link"?: string | null,"read_at"?: string | null,"title": string,"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"link"?: string | null,"read_at"?: string | null,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"number_sequences": {
                  Row: {
                    "last_value": number,"scope": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "last_value"?: number,"scope": string,"updated_at"?: string
                  }
                  Update: {
                    "last_value"?: number,"scope"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"payment_adjustments": {
                  Row: {
                    "amount": number,"authorized_by": string | null,"created_at": string,"id": string,"kind": Database["public"]['Enums']["adjustment_kind"],"payment_id": string | null,"reason": string,"student_fee_assignment_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"authorized_by"?: string | null,"created_at"?: string,"id"?: string,"kind": Database["public"]['Enums']["adjustment_kind"],"payment_id"?: string | null,"reason": string,"student_fee_assignment_id": string
                  }
                  Update: {
                    "amount"?: number,"authorized_by"?: string | null,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["adjustment_kind"],"payment_id"?: string | null,"reason"?: string,"student_fee_assignment_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_adjustments_authorized_by_fkey"
      columns: ["authorized_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_adjustments_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_adjustments_student_fee_assignment_id_fkey"
      columns: ["student_fee_assignment_id"]
isOneToOne: false
      referencedRelation: "student_fee_assignments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_adjustments_student_fee_assignment_id_fkey"
      columns: ["student_fee_assignment_id"]
isOneToOne: false
      referencedRelation: "student_fee_balances"
      referencedColumns: ["assignment_id"]
    }
                  ]
                },"payment_methods": {
                  Row: {
                    "code": string,"is_active": boolean,"name": string,"requires_reference": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"is_active"?: boolean,"name": string,"requires_reference"?: boolean
                  }
                  Update: {
                    "code"?: string,"is_active"?: boolean,"name"?: string,"requires_reference"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"created_at": string,"id": string,"method_code": string,"payment_date": string,"receipt_no": string,"received_by": string | null,"reference_no": string | null,"remarks": string | null,"status": Database["public"]['Enums']["payment_status"],"student_fee_assignment_id": string,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"id"?: string,"method_code": string,"payment_date"?: string,"receipt_no": string,"received_by"?: string | null,"reference_no"?: string | null,"remarks"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"student_fee_assignment_id": string,"student_id": string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"id"?: string,"method_code"?: string,"payment_date"?: string,"receipt_no"?: string,"received_by"?: string | null,"reference_no"?: string | null,"remarks"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"student_fee_assignment_id"?: string,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_method_code_fkey"
      columns: ["method_code"]
isOneToOne: false
      referencedRelation: "payment_methods"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "payments_received_by_fkey"
      columns: ["received_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_student_fee_assignment_id_fkey"
      columns: ["student_fee_assignment_id"]
isOneToOne: false
      referencedRelation: "student_fee_assignments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_student_fee_assignment_id_fkey"
      columns: ["student_fee_assignment_id"]
isOneToOne: false
      referencedRelation: "student_fee_balances"
      referencedColumns: ["assignment_id"]
    },{
      foreignKeyName: "payments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"permissions": {
                  Row: {
                    "description": string,"key": string,"module": string
                  }
                  ComputedFields: never
                  Insert: {
                    "description": string,"key": string,"module": string
                  }
                  Update: {
                    "description"?: string,"key"?: string,"module"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"created_at": string,"email": string | null,"full_name": string,"id": string,"is_active": boolean,"last_seen_at": string | null,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"created_at"?: string,"email"?: string | null,"full_name"?: string,"id": string,"is_active"?: boolean,"last_seen_at"?: string | null,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"created_at"?: string,"email"?: string | null,"full_name"?: string,"id"?: string,"is_active"?: boolean,"last_seen_at"?: string | null,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"programme_terms": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"programme_id": string,"sequence": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"programme_id": string,"sequence": number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"programme_id"?: string,"sequence"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "programme_terms_programme_id_fkey"
      columns: ["programme_id"]
isOneToOne: false
      referencedRelation: "programmes"
      referencedColumns: ["id"]
    }
                  ]
                },"programmes": {
                  Row: {
                    "awarding_body": string | null,"code": string,"created_at": string,"department_id": string | null,"grading_scheme_id": string | null,"id": string,"is_active": boolean,"level": Database["public"]['Enums']["programme_level"],"name": string,"stream": string | null,"term_kind": Database["public"]['Enums']["term_kind"],"total_terms": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "awarding_body"?: string | null,"code": string,"created_at"?: string,"department_id"?: string | null,"grading_scheme_id"?: string | null,"id"?: string,"is_active"?: boolean,"level": Database["public"]['Enums']["programme_level"],"name": string,"stream"?: string | null,"term_kind": Database["public"]['Enums']["term_kind"],"total_terms": number,"updated_at"?: string
                  }
                  Update: {
                    "awarding_body"?: string | null,"code"?: string,"created_at"?: string,"department_id"?: string | null,"grading_scheme_id"?: string | null,"id"?: string,"is_active"?: boolean,"level"?: Database["public"]['Enums']["programme_level"],"name"?: string,"stream"?: string | null,"term_kind"?: Database["public"]['Enums']["term_kind"],"total_terms"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "programmes_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "programmes_grading_scheme_id_fkey"
      columns: ["grading_scheme_id"]
isOneToOne: false
      referencedRelation: "grading_schemes"
      referencedColumns: ["id"]
    }
                  ]
                },"receipts": {
                  Row: {
                    "id": string,"issued_at": string,"issued_by": string | null,"last_printed_at": string | null,"payment_id": string,"print_count": number,"receipt_no": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"issued_at"?: string,"issued_by"?: string | null,"last_printed_at"?: string | null,"payment_id": string,"print_count"?: number,"receipt_no": string
                  }
                  Update: {
                    "id"?: string,"issued_at"?: string,"issued_by"?: string | null,"last_printed_at"?: string | null,"payment_id"?: string,"print_count"?: number,"receipt_no"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "receipts_issued_by_fkey"
      columns: ["issued_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "receipts_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: true
      referencedRelation: "payments"
      referencedColumns: ["id"]
    }
                  ]
                },"result_subjects": {
                  Row: {
                    "category": string | null,"components": NonNullable<Json>,"course_offering_id": string,"credits": number | null,"grade": string | null,"grade_point": number | null,"id": string,"is_pass": boolean | null,"marks_obtained": number | null,"max_marks": number | null,"percentage": number | null,"result_id": string,"status": string,"subject_code": string,"subject_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string | null,"components"?: NonNullable<Json>,"course_offering_id": string,"credits"?: number | null,"grade"?: string | null,"grade_point"?: number | null,"id"?: string,"is_pass"?: boolean | null,"marks_obtained"?: number | null,"max_marks"?: number | null,"percentage"?: number | null,"result_id": string,"status": string,"subject_code": string,"subject_name": string
                  }
                  Update: {
                    "category"?: string | null,"components"?: NonNullable<Json>,"course_offering_id"?: string,"credits"?: number | null,"grade"?: string | null,"grade_point"?: number | null,"id"?: string,"is_pass"?: boolean | null,"marks_obtained"?: number | null,"max_marks"?: number | null,"percentage"?: number | null,"result_id"?: string,"status"?: string,"subject_code"?: string,"subject_name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "result_subjects_course_offering_id_fkey"
      columns: ["course_offering_id"]
isOneToOne: false
      referencedRelation: "course_offerings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "result_subjects_result_id_fkey"
      columns: ["result_id"]
isOneToOne: false
      referencedRelation: "results"
      referencedColumns: ["id"]
    }
                  ]
                },"results": {
                  Row: {
                    "computed_at": string,"computed_by": string | null,"credits_earned": number | null,"enrolment_id": string,"examination_id": string,"failed_subjects": number,"grade": string | null,"grade_point": number | null,"id": string,"percentage": number | null,"remarks": string | null,"status": Database["public"]['Enums']["result_status"],"student_id": string,"total_max": number | null,"total_obtained": number | null,"verification_code": string
                  }
                  ComputedFields: never
                  Insert: {
                    "computed_at"?: string,"computed_by"?: string | null,"credits_earned"?: number | null,"enrolment_id": string,"examination_id": string,"failed_subjects"?: number,"grade"?: string | null,"grade_point"?: number | null,"id"?: string,"percentage"?: number | null,"remarks"?: string | null,"status": Database["public"]['Enums']["result_status"],"student_id": string,"total_max"?: number | null,"total_obtained"?: number | null,"verification_code": string
                  }
                  Update: {
                    "computed_at"?: string,"computed_by"?: string | null,"credits_earned"?: number | null,"enrolment_id"?: string,"examination_id"?: string,"failed_subjects"?: number,"grade"?: string | null,"grade_point"?: number | null,"id"?: string,"percentage"?: number | null,"remarks"?: string | null,"status"?: Database["public"]['Enums']["result_status"],"student_id"?: string,"total_max"?: number | null,"total_obtained"?: number | null,"verification_code"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "results_computed_by_fkey"
      columns: ["computed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "results_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: false
      referencedRelation: "student_enrolments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "results_examination_id_fkey"
      columns: ["examination_id"]
isOneToOne: false
      referencedRelation: "examinations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "results_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"role_permissions": {
                  Row: {
                    "permission_key": string,"role_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "permission_key": string,"role_id": number
                  }
                  Update: {
                    "permission_key"?: string,"role_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "role_permissions_permission_key_fkey"
      columns: ["permission_key"]
isOneToOne: false
      referencedRelation: "permissions"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "role_permissions_role_id_fkey"
      columns: ["role_id"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["id"]
    }
                  ]
                },"roles": {
                  Row: {
                    "created_at": string,"description": string | null,"id": number,"is_system": boolean,"key": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: never,"is_system"?: boolean,"key": string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: never,"is_system"?: boolean,"key"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"staff": {
                  Row: {
                    "address": string | null,"created_at": string,"date_of_birth": string | null,"date_of_joining": string | null,"department_id": string | null,"designation": string,"email": string | null,"employee_id": string,"full_name": string,"id": string,"is_teaching": boolean,"phone": string | null,"profile_id": string | null,"qualification": string | null,"status": Database["public"]['Enums']["staff_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"created_at"?: string,"date_of_birth"?: string | null,"date_of_joining"?: string | null,"department_id"?: string | null,"designation": string,"email"?: string | null,"employee_id": string,"full_name": string,"id"?: string,"is_teaching"?: boolean,"phone"?: string | null,"profile_id"?: string | null,"qualification"?: string | null,"status"?: Database["public"]['Enums']["staff_status"],"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"created_at"?: string,"date_of_birth"?: string | null,"date_of_joining"?: string | null,"department_id"?: string | null,"designation"?: string,"email"?: string | null,"employee_id"?: string,"full_name"?: string,"id"?: string,"is_teaching"?: boolean,"phone"?: string | null,"profile_id"?: string | null,"qualification"?: string | null,"status"?: Database["public"]['Enums']["staff_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"staff_attendance": {
                  Row: {
                    "created_at": string,"date": string,"id": string,"recorded_by": string | null,"remarks": string | null,"staff_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"date": string,"id"?: string,"recorded_by"?: string | null,"remarks"?: string | null,"staff_id": string,"status": string
                  }
                  Update: {
                    "created_at"?: string,"date"?: string,"id"?: string,"recorded_by"?: string | null,"remarks"?: string | null,"staff_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_attendance_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_attendance_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    }
                  ]
                },"student_enrolments": {
                  Row: {
                    "academic_session_id": string,"created_at": string,"end_date": string | null,"id": string,"programme_id": string,"roll_no": string | null,"section": string | null,"start_date": string,"status": Database["public"]['Enums']["enrolment_status"],"student_id": string,"term_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_session_id": string,"created_at"?: string,"end_date"?: string | null,"id"?: string,"programme_id": string,"roll_no"?: string | null,"section"?: string | null,"start_date"?: string,"status"?: Database["public"]['Enums']["enrolment_status"],"student_id": string,"term_id": string,"updated_at"?: string
                  }
                  Update: {
                    "academic_session_id"?: string,"created_at"?: string,"end_date"?: string | null,"id"?: string,"programme_id"?: string,"roll_no"?: string | null,"section"?: string | null,"start_date"?: string,"status"?: Database["public"]['Enums']["enrolment_status"],"student_id"?: string,"term_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "student_enrolments_academic_session_id_fkey"
      columns: ["academic_session_id"]
isOneToOne: false
      referencedRelation: "academic_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_enrolments_programme_id_fkey"
      columns: ["programme_id"]
isOneToOne: false
      referencedRelation: "programmes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_enrolments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_enrolments_term_id_fkey"
      columns: ["term_id"]
isOneToOne: false
      referencedRelation: "programme_terms"
      referencedColumns: ["id"]
    }
                  ]
                },"student_fee_assignments": {
                  Row: {
                    "assigned_by": string | null,"cancelled_reason": string | null,"created_at": string,"due_date": string | null,"enrolment_id": string | null,"fee_structure_id": string,"gross_amount": number,"id": string,"is_cancelled": boolean,"items": NonNullable<Json>,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_by"?: string | null,"cancelled_reason"?: string | null,"created_at"?: string,"due_date"?: string | null,"enrolment_id"?: string | null,"fee_structure_id": string,"gross_amount": number,"id"?: string,"is_cancelled"?: boolean,"items"?: NonNullable<Json>,"student_id": string
                  }
                  Update: {
                    "assigned_by"?: string | null,"cancelled_reason"?: string | null,"created_at"?: string,"due_date"?: string | null,"enrolment_id"?: string | null,"fee_structure_id"?: string,"gross_amount"?: number,"id"?: string,"is_cancelled"?: boolean,"items"?: NonNullable<Json>,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "student_fee_assignments_assigned_by_fkey"
      columns: ["assigned_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_fee_assignments_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: false
      referencedRelation: "student_enrolments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_fee_assignments_fee_structure_id_fkey"
      columns: ["fee_structure_id"]
isOneToOne: false
      referencedRelation: "fee_structures"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_fee_assignments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"student_guardians": {
                  Row: {
                    "address": string | null,"created_at": string,"email": string | null,"id": string,"is_primary": boolean,"name": string,"phone": string | null,"relationship": string,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"created_at"?: string,"email"?: string | null,"id"?: string,"is_primary"?: boolean,"name": string,"phone"?: string | null,"relationship": string,"student_id": string
                  }
                  Update: {
                    "address"?: string | null,"created_at"?: string,"email"?: string | null,"id"?: string,"is_primary"?: boolean,"name"?: string,"phone"?: string | null,"relationship"?: string,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "student_guardians_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"student_status_history": {
                  Row: {
                    "created_at": string,"effective_date": string,"event": string,"from_enrolment_id": string | null,"id": string,"reason": string | null,"recorded_by": string | null,"student_id": string,"to_enrolment_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"effective_date"?: string,"event": string,"from_enrolment_id"?: string | null,"id"?: string,"reason"?: string | null,"recorded_by"?: string | null,"student_id": string,"to_enrolment_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"effective_date"?: string,"event"?: string,"from_enrolment_id"?: string | null,"id"?: string,"reason"?: string | null,"recorded_by"?: string | null,"student_id"?: string,"to_enrolment_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "student_status_history_from_enrolment_id_fkey"
      columns: ["from_enrolment_id"]
isOneToOne: false
      referencedRelation: "student_enrolments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_status_history_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_status_history_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_status_history_to_enrolment_id_fkey"
      columns: ["to_enrolment_id"]
isOneToOne: false
      referencedRelation: "student_enrolments"
      referencedColumns: ["id"]
    }
                  ]
                },"student_subject_enrolments": {
                  Row: {
                    "course_offering_id": string,"created_at": string,"enrolment_id": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_offering_id": string,"created_at"?: string,"enrolment_id": string,"id"?: string
                  }
                  Update: {
                    "course_offering_id"?: string,"created_at"?: string,"enrolment_id"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "student_subject_enrolments_course_offering_id_fkey"
      columns: ["course_offering_id"]
isOneToOne: false
      referencedRelation: "course_offerings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_subject_enrolments_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: false
      referencedRelation: "student_enrolments"
      referencedColumns: ["id"]
    }
                  ]
                },"students": {
                  Row: {
                    "address": string | null,"admission_date": string,"admission_no": string,"archived_at": string | null,"created_at": string,"created_by": string | null,"date_of_birth": string,"email": string | null,"full_name": string,"gender": Database["public"]['Enums']["gender"],"id": string,"phone": string | null,"photo_path": string | null,"profile_id": string | null,"registration_no": string | null,"scholarship_note": string | null,"status": Database["public"]['Enums']["student_status"],"university_roll_no": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"admission_date"?: string,"admission_no": string,"archived_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"date_of_birth": string,"email"?: string | null,"full_name": string,"gender"?: Database["public"]['Enums']["gender"],"id"?: string,"phone"?: string | null,"photo_path"?: string | null,"profile_id"?: string | null,"registration_no"?: string | null,"scholarship_note"?: string | null,"status"?: Database["public"]['Enums']["student_status"],"university_roll_no"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"admission_date"?: string,"admission_no"?: string,"archived_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"date_of_birth"?: string,"email"?: string | null,"full_name"?: string,"gender"?: Database["public"]['Enums']["gender"],"id"?: string,"phone"?: string | null,"photo_path"?: string | null,"profile_id"?: string | null,"registration_no"?: string | null,"scholarship_note"?: string | null,"status"?: Database["public"]['Enums']["student_status"],"university_roll_no"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "students_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "students_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"subjects": {
                  Row: {
                    "code": string,"created_at": string,"credits": number | null,"department_id": string | null,"has_practical": boolean,"id": string,"is_active": boolean,"level": Database["public"]['Enums']["programme_level"],"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"credits"?: number | null,"department_id"?: string | null,"has_practical"?: boolean,"id"?: string,"is_active"?: boolean,"level": Database["public"]['Enums']["programme_level"],"name": string,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"credits"?: number | null,"department_id"?: string | null,"has_practical"?: boolean,"id"?: string,"is_active"?: boolean,"level"?: Database["public"]['Enums']["programme_level"],"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subjects_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    }
                  ]
                },"teacher_assignments": {
                  Row: {
                    "course_offering_id": string,"created_at": string,"id": string,"role": Database["public"]['Enums']["assignment_role"],"staff_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_offering_id": string,"created_at"?: string,"id"?: string,"role"?: Database["public"]['Enums']["assignment_role"],"staff_id": string
                  }
                  Update: {
                    "course_offering_id"?: string,"created_at"?: string,"id"?: string,"role"?: Database["public"]['Enums']["assignment_role"],"staff_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "teacher_assignments_course_offering_id_fkey"
      columns: ["course_offering_id"]
isOneToOne: false
      referencedRelation: "course_offerings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teacher_assignments_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    }
                  ]
                },"timetable_entries": {
                  Row: {
                    "academic_session_id": string,"course_offering_id": string,"created_at": string,"day_of_week": number,"id": string,"period_no": number,"programme_id": string,"room": string | null,"section": string,"staff_id": string | null,"term_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_session_id": string,"course_offering_id": string,"created_at"?: string,"day_of_week": number,"id"?: string,"period_no": number,"programme_id": string,"room"?: string | null,"section"?: string,"staff_id"?: string | null,"term_id": string,"updated_at"?: string
                  }
                  Update: {
                    "academic_session_id"?: string,"course_offering_id"?: string,"created_at"?: string,"day_of_week"?: number,"id"?: string,"period_no"?: number,"programme_id"?: string,"room"?: string | null,"section"?: string,"staff_id"?: string | null,"term_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "timetable_entries_academic_session_id_fkey"
      columns: ["academic_session_id"]
isOneToOne: false
      referencedRelation: "academic_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "timetable_entries_course_offering_id_fkey"
      columns: ["course_offering_id"]
isOneToOne: false
      referencedRelation: "course_offerings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "timetable_entries_period_no_fkey"
      columns: ["period_no"]
isOneToOne: false
      referencedRelation: "timetable_periods"
      referencedColumns: ["period_no"]
    },{
      foreignKeyName: "timetable_entries_programme_id_fkey"
      columns: ["programme_id"]
isOneToOne: false
      referencedRelation: "programmes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "timetable_entries_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "timetable_entries_term_id_fkey"
      columns: ["term_id"]
isOneToOne: false
      referencedRelation: "programme_terms"
      referencedColumns: ["id"]
    }
                  ]
                },"timetable_periods": {
                  Row: {
                    "end_time": string,"label": string | null,"period_no": number,"start_time": string
                  }
                  ComputedFields: never
                  Insert: {
                    "end_time": string,"label"?: string | null,"period_no": number,"start_time": string
                  }
                  Update: {
                    "end_time"?: string,"label"?: string | null,"period_no"?: number,"start_time"?: string
                  }
                  Relationships: [
                    
                  ]
                },"user_roles": {
                  Row: {
                    "granted_at": string,"granted_by": string | null,"role_id": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "granted_at"?: string,"granted_by"?: string | null,"role_id": number,"user_id": string
                  }
                  Update: {
                    "granted_at"?: string,"granted_by"?: string | null,"role_id"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_roles_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_roles_role_id_fkey"
      columns: ["role_id"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_roles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "student_fee_balances": {
                  Row: {
                    "academic_session_id": string,"assignment_id": string,"balance": number | null,"charges": number | null,"concessions": number | null,"created_at": string,"due_date": string | null,"fee_structure_id": string,"fee_structure_name": string,"gross_amount": number,"is_cancelled": boolean,"is_overdue": boolean | null,"paid": number | null,"programme_id": string,"refunded": number | null,"student_id": string,"term_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "fee_structures_academic_session_id_fkey"
      columns: ["academic_session_id"]
isOneToOne: false
      referencedRelation: "academic_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fee_structures_programme_id_fkey"
      columns: ["programme_id"]
isOneToOne: false
      referencedRelation: "programmes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fee_structures_term_id_fkey"
      columns: ["term_id"]
isOneToOne: false
      referencedRelation: "programme_terms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_fee_assignments_fee_structure_id_fkey"
      columns: ["fee_structure_id"]
isOneToOne: false
      referencedRelation: "fee_structures"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_fee_assignments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "add_candidates_from_failures":
{ Args: { "p_source_exam_id": string,"p_target_exam_id": string }; Returns: number
                           },
"admin_update_profile":
{ Args: { "p_full_name": string,"p_phone": string,"p_user_id": string }; Returns: undefined
                           },
"assign_fee_structure":
{ Args: { "p_fee_structure_id": string,"p_optional_head_ids"?: (string)[],"p_student_ids": (string)[] }; Returns: number
                           },
"attendance_summary":
{ Args: { "p_academic_session_id": string,"p_from"?: string,"p_offering_id"?: string,"p_programme_id"?: string,"p_student_id"?: string,"p_term_id"?: string,"p_to"?: string }; Returns: {
              "attended": number,"eligible": number,"excluded": number,"percentage": number,"student_id": string,"total_records": number
            }[]
                           },
"can_edit_attendance":
{ Args: { "p_date": string,"p_offering_id": string,"p_programme_id": string,"p_session_id": string,"p_term_id": string }; Returns: boolean
                           },
"can_enter_marks":
{ Args: { "p_exam_subject_id": string }; Returns: boolean
                           },
"can_read_notice":
{ Args: { "p_notice_id": string }; Returns: boolean
                           },
"can_view_exam":
{ Args: { "p_exam_id": string }; Returns: boolean
                           },
"cancel_fee_assignment":
{ Args: { "p_assignment_id": string,"p_reason": string }; Returns: undefined
                           },
"change_student_status":
{ Args: { "p_effective_date"?: string,"p_event": string,"p_reason": string,"p_student_id": string }; Returns: undefined
                           },
"compute_exam_results":
{ Args: { "p_exam_id": string }; Returns: number
                           },
"convert_admission":
{ Args: { "p_admission_id": string,"p_payment"?: Json,"p_roll_no"?: string }; Returns: string
                           },
"create_admission":
{ Args: { "p_data": Json }; Returns: string
                           },
"create_student":
{ Args: { "p_enrolment": Json,"p_guardian": Json,"p_offering_ids"?: (string)[],"p_student": Json }; Returns: string
                           },
"current_staff_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"current_student_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"decide_concession":
{ Args: { "p_approve": boolean,"p_concession_id": string,"p_remarks"?: string }; Returns: undefined
                           },
"exam_candidate_pairs":
{ Args: { "p_exam_id": string }; Returns: {
              "course_offering_id": string,"enrolment_id": string,"student_id": string
            }[]
                           },
"exam_marks_progress":
{ Args: { "p_exam_id": string }; Returns: {
              "candidates": number,"entered": number,"examination_subject_id": string,"missing": number
            }[]
                           },
"exam_missing_marks":
{ Args: { "p_exam_id": string }; Returns: {
              "examination_subject_id": string,"student_id": string
            }[]
                           },
"fee_assignment_balance":
{ Args: { "p_assignment_id": string }; Returns: number
                           },
"generate_admission_no":
{ Args: { "p_year"?: number }; Returns: string
                           },
"grade_for":
{ Args: { "p_pass": boolean,"p_percent": number,"p_scheme_id": string }; Returns: {
              "grade": string,"grade_point": number
            }[]
                           },
"has_any_permission":
{ Args: { "p_keys": (string)[] }; Returns: boolean
                           },
"has_permission":
{ Args: { "p_key": string }; Returns: boolean
                           },
"has_role":
{ Args: { "p_role": string }; Returns: boolean
                           },
"import_students":
{ Args: { "p_academic_session_id": string,"p_programme_id": string,"p_rows": Json,"p_term_id": string }; Returns: number
                           },
"is_assigned_to_offering":
{ Args: { "p_offering_id": string }; Returns: boolean
                           },
"is_exam_published":
{ Args: { "p_exam_id": string }; Returns: boolean
                           },
"is_student_in_class":
{ Args: { "p_programme_id": string,"p_session_id": string,"p_term_id": string }; Returns: boolean
                           },
"is_teacher_of_class":
{ Args: { "p_programme_id": string,"p_session_id": string,"p_term_id": string }; Returns: boolean
                           },
"is_teacher_of_student":
{ Args: { "p_student_id": string }; Returns: boolean
                           },
"log_audit":
{ Args: { "p_action": string,"p_details"?: Json,"p_entity_id": string,"p_entity_type": string }; Returns: undefined
                           },
"log_audit_as":
{ Args: { "p_action": string,"p_actor": string,"p_details"?: Json,"p_entity_id": string,"p_entity_type": string }; Returns: undefined
                           },
"mark_receipt_printed":
{ Args: { "p_payment_id": string }; Returns: undefined
                           },
"my_access":
{ Args: Record<PropertyKey, never>; Returns: {
              "permissions": (string)[],"roles": (string)[]
            }[]
                           },
"my_attendance_session_ids":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"my_markable_exam_subject_ids":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"my_offering_ids":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"my_student_attendance_session_ids":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"my_taught_student_ids":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"next_receipt_no":
{ Args: { "p_date": string }; Returns: string
                           },
"next_sequence_value":
{ Args: { "p_scope": string }; Returns: number
                           },
"promote_students":
{ Args: { "p_action"?: string,"p_enrolment_ids": (string)[],"p_reason"?: string,"p_target_session_id": string }; Returns: number
                           },
"publish_notice":
{ Args: { "p_notice_id": string,"p_publish"?: boolean }; Returns: undefined
                           },
"record_fee_adjustment":
{ Args: { "p_amount": number,"p_assignment_id": string,"p_kind": Database["public"]['Enums']["adjustment_kind"],"p_reason": string }; Returns: string
                           },
"record_payment":
{ Args: { "p_amount": number,"p_assignment_id": string,"p_method_code": string,"p_payment_date"?: string,"p_reference_no"?: string,"p_remarks"?: string }; Returns: string
                           },
"request_concession":
{ Args: { "p_amount": number,"p_assignment_id": string,"p_kind": string,"p_reason": string }; Returns: string
                           },
"reverse_payment":
{ Args: { "p_payment_id": string,"p_reason": string }; Returns: undefined
                           },
"review_admission":
{ Args: { "p_admission_id": string,"p_remarks": string,"p_status": Database["public"]['Enums']["admission_status"] }; Returns: undefined
                           },
"save_attendance":
{ Args: { "p_academic_session_id": string,"p_date": string,"p_offering_id": string,"p_period": number,"p_programme_id": string,"p_records": Json,"p_term_id": string,"p_topic"?: string }; Returns: string
                           },
"save_marks":
{ Args: { "p_entries": Json,"p_exam_subject_id": string,"p_reason"?: string }; Returns: number
                           },
"send_low_attendance_alerts":
{ Args: { "p_academic_session_id": string,"p_programme_id"?: string,"p_term_id"?: string }; Returns: number
                           },
"set_attendance_lock":
{ Args: { "p_locked": boolean,"p_session_id": string }; Returns: undefined
                           },
"set_profile_active":
{ Args: { "p_active": boolean,"p_user_id": string }; Returns: undefined
                           },
"set_student_subjects":
{ Args: { "p_enrolment_id": string,"p_offering_ids": (string)[] }; Returns: undefined
                           },
"set_user_roles":
{ Args: { "p_role_keys": (string)[],"p_user_id": string }; Returns: undefined
                           },
"staff_directory":
{ Args: Record<PropertyKey, never>; Returns: {
              "department": string,"designation": string,"email": string,"full_name": string,"id": string,"is_teaching": boolean
            }[]
                           },
"student_in_attendance_session":
{ Args: { "p_attendance_session_id": string }; Returns: boolean
                           },
"teaches_attendance_session":
{ Args: { "p_attendance_session_id": string }; Returns: boolean
                           },
"timetable_conflicts":
{ Args: { "p_day": number,"p_exclude_id"?: string,"p_period": number,"p_programme_id": string,"p_room": string,"p_section": string,"p_session_id": string,"p_staff_id": string,"p_term_id": string }; Returns: {
              "description": string,"entry_id": string,"kind": string
            }[]
                           },
"transition_examination":
{ Args: { "p_exam_id": string,"p_reason"?: string,"p_to": Database["public"]['Enums']["exam_status"] }; Returns: undefined
                           },
"user_deletion_check":
{ Args: { "p_user_id": string }; Returns: Json
                           },
"verify_admission_document":
{ Args: { "p_document_id": string,"p_remarks"?: string,"p_verified": boolean }; Returns: undefined
                           },
"verify_result":
{ Args: { "p_code": string }; Returns: {
              "academic_session": string,"admission_no": string,"examination": string,"is_provisional": boolean,"percentage": number,"programme": string,"published_at": string,"result_status": Database["public"]['Enums']["result_status"],"student_name": string,"term": string
            }[]
                           }
          }
          Enums: {
            "adjustment_kind": "reversal"|"refund"|"charge"|"fine"|"waiver","admission_status": "submitted"|"under_review"|"approved"|"waitlisted"|"rejected"|"admitted"|"withdrawn","assignment_role": "teacher"|"examiner","concession_status": "pending"|"approved"|"rejected"|"revoked","enrolment_status": "active"|"promoted"|"repeated"|"withdrawn"|"transferred"|"completed","exam_component": "theory"|"practical"|"internal"|"combined","exam_status": "draft"|"scheduled"|"marks_entry"|"marks_locked"|"results_processed"|"results_approved"|"published","fee_category": "admission"|"semester"|"tuition"|"laboratory"|"hostel"|"examination"|"fine"|"miscellaneous","gender": "female"|"male"|"other"|"undisclosed","mark_status": "present"|"absent"|"exempted"|"malpractice"|"withheld","notice_category": "academic"|"examination"|"admission"|"holiday"|"fee"|"general","notice_status": "draft"|"published"|"archived","payment_status": "completed"|"reversed","programme_level": "higher_secondary"|"undergraduate"|"postgraduate","record_status": "active"|"inactive","result_status": "pass"|"fail"|"compartment"|"absent"|"withheld"|"incomplete","staff_status": "active"|"on_leave"|"resigned"|"retired","student_status": "active"|"withdrawn"|"transferred"|"graduated"|"suspended"|"archived","term_kind": "class"|"semester"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "adjustment_kind": ["reversal", "refund", "charge", "fine", "waiver"],"admission_status": ["submitted", "under_review", "approved", "waitlisted", "rejected", "admitted", "withdrawn"],"assignment_role": ["teacher", "examiner"],"concession_status": ["pending", "approved", "rejected", "revoked"],"enrolment_status": ["active", "promoted", "repeated", "withdrawn", "transferred", "completed"],"exam_component": ["theory", "practical", "internal", "combined"],"exam_status": ["draft", "scheduled", "marks_entry", "marks_locked", "results_processed", "results_approved", "published"],"fee_category": ["admission", "semester", "tuition", "laboratory", "hostel", "examination", "fine", "miscellaneous"],"gender": ["female", "male", "other", "undisclosed"],"mark_status": ["present", "absent", "exempted", "malpractice", "withheld"],"notice_category": ["academic", "examination", "admission", "holiday", "fee", "general"],"notice_status": ["draft", "published", "archived"],"payment_status": ["completed", "reversed"],"programme_level": ["higher_secondary", "undergraduate", "postgraduate"],"record_status": ["active", "inactive"],"result_status": ["pass", "fail", "compartment", "absent", "withheld", "incomplete"],"staff_status": ["active", "on_leave", "resigned", "retired"],"student_status": ["active", "withdrawn", "transferred", "graduated", "suspended", "archived"],"term_kind": ["class", "semester"]
          }
        }
} as const
