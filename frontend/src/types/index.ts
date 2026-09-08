export type AppRole =
  | 'student'
  | 'teacher'
  | 'teacher_cabaas'
  | 'practice_teacher'
  | 'supervisor'
  | 'finance_officer'
  | 'finance_manager'
  | 'attendance_manager'
  | 'outside_activity_committee'
  | 'school_manager'
  | 'parent'

export type AccountStatus = 'active' | 'disabled' | 'pending'
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave' | 'excused'
export type OutsideActivityStatus = 'present' | 'absent' | 'excused'
export type PaymentStatus = 'paid' | 'unpaid' | 'scholarship_nb'
export type LeaveStatus = 'pending' | 'approved' | 'rejected'
export type ResultStatus = 'draft' | 'pending_review' | 'approved' | 'published' | 'rejected'
export type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer'

export interface Profile {
  id: string
  login_id: string
  full_name: string
  role: AppRole
  phone: string | null
  avatar_url: string | null
  status: AccountStatus
  permissions: Record<string, unknown>
  must_change_password: boolean
  followers_count?: number
  following_count?: number
  created_at: string
  updated_at: string
}

export interface Student {
  id: string
  profile_id: string
  student_id: string
  parent_name: string
  parent_phone: string
  phone: string | null
  class_id: string | null
  academic_year_id: string | null
  password_set: boolean
  registration_date: string
  notes: string | null
  created_at: string
  profile?: Profile
  class?: ClassRecord
}

export interface Teacher {
  id: string
  profile_id: string
  teacher_id: string
  specialization: string | null
  hire_date: string | null
  is_practice: boolean
  notes: string | null
  created_at: string
  profile?: Profile
  classes?: ClassRecord[]
}

export interface ClassRecord {
  id: string
  name: string
  schedule_slot: string
  description: string | null
  academic_year_id: string | null
  capacity: number
  is_active: boolean
}

export interface Subject {
  id: string
  name: string
  code: string | null
  description: string | null
  is_active: boolean
}

export interface AcademicYear {
  id: string
  name: string
  start_date: string
  end_date: string
  is_active: boolean
  is_archived: boolean
}

export interface Lesson {
  id: string
  title: string
  description: string | null
  subject_id: string | null
  class_id: string
  teacher_id: string
  lesson_date: string
  is_published: boolean
  created_at: string
  files?: LessonFile[]
  subject?: Subject
  class?: ClassRecord
}

export interface LessonFile {
  id: string
  lesson_id: string
  file_name: string
  file_path: string
  file_type: string
  mime_type: string | null
  file_size: number | null
}

export interface AttendanceRecord {
  id: string
  student_id: string
  class_id: string
  teacher_id: string
  attendance_date: string
  status: AttendanceStatus
  notes: string | null
  student?: Student
}

export interface OutsideActivity {
  id: string
  name: string
  activity_type: string
  activity_date: string
  start_time: string | null
  end_time: string | null
  location: string | null
  description: string | null
  class_id: string
  committee_id: string | null
  created_by: string
  is_cancelled: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  class?: ClassRecord
  creator?: Profile
  attendance?: OutsideActivityAttendance[]
}

export interface OutsideActivityAttendance {
  id: string
  activity_id: string | null
  committee_id: string
  student_id: string
  class_id: string
  activity_date: string
  status: AttendanceStatus
  recorded_by: string
  notes: string | null
  location: string | null
  recorded_at: string
  created_at: string
  updated_at: string | null
  updated_by: string | null
  edit_count: number
  student?: Student
  activity?: OutsideActivity
}

export interface CommitteeMember {
  id: string
  committee_id: string
  profile_id: string
  profile?: Profile
  committee?: {
    id: string
    name: string
    description: string | null
    classes?: { class?: ClassRecord }[]
  }
}

export interface Quiz {
  id: string
  title: string
  description: string | null
  subject_id: string | null
  class_id: string
  teacher_id: string
  time_limit_minutes: number | null
  total_marks: number
  start_at: string | null
  end_at: string | null
  is_published: boolean
  questions?: QuizQuestion[]
  class?: ClassRecord
  subject?: Subject
}

export interface QuizQuestion {
  id: string
  quiz_id: string
  question_text: string
  question_type: QuestionType
  marks: number
  correct_answer: string | null
  sort_order: number
  options?: QuizOption[]
}

export interface QuizOption {
  id: string
  question_id: string
  option_text: string
  is_correct: boolean
  sort_order: number
}

export interface FinanceRecord {
  id: string
  student_id: string
  class_id: string | null
  month: number
  year: number
  status: PaymentStatus
  amount: number | null
  notes: string | null
  student?: Student
}

export interface Notification {
  id: string
  profile_id: string
  title: string
  body: string
  type: string
  link: string | null
  is_read: boolean
  created_at: string
  sender_user_id?: string | null
  reference_id?: string | null
  sender?: Profile
  metadata?: Record<string, unknown>
}

export interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  is_deleted: boolean
  media_type?: 'text' | 'voice' | 'image' | 'video'
  media_url?: string | null
  created_at: string
  sender?: Profile
}

export interface ChatPost {
  id: string
  author_id: string
  body: string
  media_url: string | null
  media_type?: 'text' | 'image' | 'video'
  likes_count: number
  comments_count: number
  is_deleted: boolean
  created_at: string
  updated_at: string
  author?: Profile
  my_reaction?: { id: string; emoji: string } | null
}

export type CallStatus = 'ringing' | 'active' | 'ended' | 'missed' | 'declined'

export interface Call {
  id: string
  caller_id: string
  callee_id: string
  status: CallStatus
  started_at: string
  answered_at: string | null
  ended_at: string | null
  created_at: string
}

export interface ChatPostComment {
  id: string
  post_id: string
  author_id: string
  parent_id: string | null
  body: string
  is_deleted: boolean
  created_at: string
  updated_at: string
  author?: Profile
  replies?: ChatPostComment[]
}

export interface ChatPostReaction {
  id: string
  post_id: string
  user_id: string
  emoji: string
  created_at: string
}

export interface PracticeStudent {
  id: string
  student_name: string
  student_id: string | null
  class_id: string | null
  practice_type: 'somali_speaking' | 'english_speaking'
  language: 'somali' | 'english'
  notes: string | null
  status: 'draft' | 'submitted'
  created_by: string
  updated_by: string | null
  submitted_by: string | null
  submitted_at: string | null
  created_at: string
  updated_at: string
  class?: ClassRecord
  creator?: Profile
}

export interface ActivityLog {
  id: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string | null
  description: string
  metadata: Record<string, unknown>
  created_at: string
  user?: Profile
}

export interface AuthUserContext {
  profile: Profile
  student: Student | null
  teacher: Teacher | null
}

export const ROLE_HOME: Record<AppRole, string> = {
  student: '/student',
  teacher: '/teacher',
  teacher_cabaas: '/cabaas',
  practice_teacher: '/practice-teacher',
  supervisor: '/supervisor',
  finance_officer: '/finance',
  finance_manager: '/finance-manager',
  attendance_manager: '/attendance',
  outside_activity_committee: '/committee',
  school_manager: '/manager',
  parent: '/parent',
}

export const ROLE_LABELS: Record<AppRole, string> = {
  student: 'Student',
  teacher: 'Teacher',
  teacher_cabaas: 'Teacher Cabaas',
  practice_teacher: 'Practice Teacher',
  supervisor: 'Supervisor',
  finance_officer: 'Finance Officer',
  finance_manager: 'Finance Manager',
  attendance_manager: 'Attendance Manager',
  outside_activity_committee: 'Outside Activity Committee',
  school_manager: 'School Manager',
  parent: 'Parent',
}

export interface ParentChild {
  parent_id: string
  student_id: string
  linked_by: string | null
  created_at: string
  student?: Student
}

export type BackupFormat = 'sql' | 'json' | 'zip'
export type BackupType = 'manual' | 'scheduled' | 'pre_restore'
export type BackupStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface DatabaseBackup {
  id: string
  file_name: string
  format: BackupFormat
  backup_type: BackupType
  file_size: number
  checksum: string
  status: BackupStatus
  storage_path: string | null
  created_by: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
  error: string | null
  creator?: Pick<Profile, 'id' | 'full_name' | 'login_id'> | null
}

export interface BackupLog {
  id: string
  actor_id: string | null
  action: string
  file_name: string | null
  status: string
  metadata: Record<string, unknown>
  error: string | null
  ip_address: string | null
  created_at: string
  actor?: Pick<Profile, 'id' | 'full_name' | 'login_id'> | null
}

export type ImportJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

export interface ImportJob {
  id: string
  file_name: string
  module: string
  total_rows: number
  valid_rows: number
  error_rows: number
  duplicate_rows: number
  status: ImportJobStatus
  errors: { row?: number | string; message: string; field?: string }[] | null
  report_path: string | null
  created_by: string | null
  created_at: string
  completed_at: string | null
  updated_at: string
}

export interface ExportableModule {
  key: string
  label: string
  table: string
}

export interface ExportFormat {
  value: 'csv' | 'xlsx' | 'json'
  label: string
}
