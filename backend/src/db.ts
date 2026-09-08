import mongoose from 'mongoose'
import type { Db, Collection, Document } from 'mongodb'
import { config } from './config.ts'
import { initializeModels } from './models/index.ts'
import { modelRepository } from './models/repository.ts'

export async function connectDb(): Promise<void> {
  await mongoose.connect(config.mongodbUri, { maxPoolSize: 20, serverSelectionTimeoutMS: 5000 })
  await initializeModels()
}
export async function closeDb(): Promise<void> { await mongoose.disconnect() }
export function collection<T extends Document = Document>(name: string): Collection<T> { return modelRepository<T>(name) }
export const TABLES = Object.freeze({
  contact_messages: 'contact_messages',
  profiles: 'profiles',
  academic_years: 'academic_years',
  classes: 'classes',
  subjects: 'subjects',
  students: 'students',
  teachers: 'teachers',
  teacher_classes: 'teacher_classes',
  teacher_subjects: 'teacher_subjects',
  class_subjects: 'class_subjects',
  lessons: 'lessons',
  lesson_files: 'lesson_files',
  attendance: 'attendance',
  teacher_attendance: 'teacher_attendance',
  teacher_leave: 'teacher_leave',
  practice_attendance: 'practice_attendance',
  quizzes: 'quizzes',
  quiz_questions: 'quiz_questions',
  quiz_options: 'quiz_options',
  quiz_attempts: 'quiz_attempts',
  quiz_answers: 'quiz_answers',
  result_submissions: 'result_submissions',
  results: 'results',
  result_approvals: 'result_approvals',
  exam_schedules: 'exam_schedules',
  notices: 'notices',
  finance_records: 'finance_records',
  outside_activity_committees: 'outside_activity_committees',
  committee_members: 'committee_members',
  committee_classes: 'committee_classes',
  committee_member_classes: 'committee_member_classes',
  outside_activity_attendance: 'outside_activity_attendance',
  follows: 'follows',
  chat_conversations: 'chat_conversations',
  chat_participants: 'chat_participants',
  chat_messages: 'chat_messages',
  ai_conversations: 'ai_conversations',
  ai_messages: 'ai_messages',
  notifications: 'notifications',
  audit_logs: 'audit_logs',
  password_reset_requests: 'password_reset_requests',
  student_parents: 'student_parents',
  student_behavior: 'student_behavior',
  chat_posts: 'chat_posts',
  chat_post_comments: 'chat_post_comments',
  chat_post_reactions: 'chat_post_reactions',
  calls: 'calls',
  outside_activities: 'outside_activities',
  practice_students: 'practice_students',
  activity_logs: 'activity_logs',
  lesson_monitoring: 'lesson_monitoring',
  app_settings: 'app_settings',
  backups: 'backups',
  backup_logs: 'backup_logs',
  import_jobs: 'import_jobs',
} as const)

export type TableName = (typeof TABLES)[keyof typeof TABLES]

/** All collections that exist as real tables (business data that the backup/export covers). */
export const BUSINESS_TABLES: readonly string[] = Object.values(TABLES) as readonly string[]

/** Tables excluded from backup/restore (system or derived). */
export const NON_BACKUP_TABLES = new Set<string>(['app_settings', 'backups', 'backup_logs', 'import_jobs'])