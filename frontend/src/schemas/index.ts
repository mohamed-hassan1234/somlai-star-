import { z } from 'zod'

export const loginSchema = z.object({
  loginId: z
    .string()
    .min(3, 'Enter your User ID')
    .max(32)
    .transform((v) => v.trim().toUpperCase()),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().optional(),
})

export const createStudentSchema = z
  .object({
    studentId: z.string().regex(/^SOMSTAR([1-5][0-9]{2}|600)$/, 'Invalid Student ID format'),
    fullName: z.string().min(2, 'Full name is required').max(120),
    parentName: z.string().min(2, 'Parent/Guardian name is required').max(120),
    parentPhone: z.string().min(7, 'Valid phone required').max(20),
    classId: z.string().uuid('Select a class'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
    academicYearId: z.string().uuid('Select academic year'),
    status: z.enum(['active', 'disabled', 'pending']),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export const createTeacherSchema = z
  .object({
    teacherId: z.string().min(3).max(20),
    fullName: z.string().min(2).max(120),
    phone: z.string().optional(),
    specialization: z.string().optional(),
    role: z.enum(['teacher', 'teacher_cabaas', 'practice_teacher']),
    password: z.string().min(8),
    confirmPassword: z.string(),
    classIds: z.array(z.string().uuid()).min(1, 'Assign at least one class'),
    status: z.enum(['active', 'disabled', 'pending']),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export const lessonSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(5000).optional(),
  subjectId: z.string().uuid().optional().or(z.literal('')),
  classId: z.string().uuid('Select a class'),
  lessonDate: z.string().min(1),
  isPublished: z.boolean(),
})

export const attendanceStatusSchema = z.enum(['present', 'absent', 'late', 'leave'])

export const quizSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().optional(),
  subjectId: z.string().uuid().optional().or(z.literal('')),
  classId: z.string().uuid(),
  timeLimitMinutes: z.coerce.number().int().positive().optional().nullable(),
  startAt: z.string().optional().nullable(),
  endAt: z.string().optional().nullable(),
  isPublished: z.boolean(),
})

export const financeRecordSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid().optional().nullable(),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
  status: z.enum(['paid', 'unpaid', 'scholarship_nb']),
  amount: z.coerce.number().optional().nullable(),
  notes: z.string().optional(),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(6),
    newPassword: z.string().min(8),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export const leaveRequestSchema = z
  .object({
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    reason: z.string().min(5).max(1000),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: 'End date must be after start date',
    path: ['endDate'],
  })

export const createCommitteeMemberSchema = z
  .object({
    memberId: z.string().min(3, 'User ID is required').max(20),
    fullName: z.string().min(2, 'Full name is required').max(120),
    phone: z.string().optional(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
    classIds: z.array(z.string().uuid()).min(1, 'Assign at least one class'),
    status: z.enum(['active', 'disabled', 'pending']),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export const outsideActivitySchema = z.object({
  name: z.string().min(2, 'Activity name is required').max(200),
  activityType: z.string().min(1, 'Select an activity type'),
  activityDate: z.string().min(1, 'Date is required'),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  location: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  classId: z.string().uuid('Select a class'),
})

export const outsideActivityTypeSchema = z.enum([
  'educational_trip',
  'educational_activity',
  'sports',
  'competition',
  'visit',
  'outdoor_learning',
  'other',
])

export const OUTSIDE_ACTIVITY_TYPES: { value: string; label: string }[] = [
  { value: 'educational_trip', label: 'Educational Trip' },
  { value: 'educational_activity', label: 'Educational Activity' },
  { value: 'sports', label: 'Sports Activity' },
  { value: 'competition', label: 'Competition' },
  { value: 'visit', label: 'Visit' },
  { value: 'outdoor_learning', label: 'Outdoor Learning' },
  { value: 'other', label: 'Other' },
]

export const exportSettingsSchema = z.object({
  format: z.enum(['csv', 'xlsx', 'json']),
  modules: z.array(z.string()).min(1, 'Select at least one module to export'),
  from: z.string().optional(),
  to: z.string().optional(),
})

export const automaticBackupSchema = z.object({
  enabled: z.boolean(),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time (HH:MM 24h)'),
  retention: z.coerce.number().int().min(1).max(365),
})

export type ExportSettingsInput = z.infer<typeof exportSettingsSchema>
export type AutomaticBackupInput = z.infer<typeof automaticBackupSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type CreateStudentInput = z.infer<typeof createStudentSchema>
export type CreateTeacherInput = z.infer<typeof createTeacherSchema>
export type CreateCommitteeMemberInput = z.infer<typeof createCommitteeMemberSchema>
export type OutsideActivityInput = z.infer<typeof outsideActivitySchema>
export type LessonInput = z.infer<typeof lessonSchema>
