import mongoose, { Schema, type Model } from 'mongoose'
import { randomUUID } from 'node:crypto'
import definitions from './definitions.json' with { type: 'json' }

type Definition = { type: string; required?: boolean; unique?: boolean; ref?: string; enum?: string[]; default?: string }
export const ROLES = definitions.profiles.role.enum
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const modelDefinitions: Record<string, Record<string, Definition>> = definitions
const models = new Map<string, Model<any>>()

export const uniqueKeys: Record<string, string[][]> = {
  profiles: [['login_id']], academic_years: [['name']], classes: [['name', 'academic_year_id']],
  subjects: [['name']], students: [['student_id'], ['profile_id']], teachers: [['teacher_id'], ['profile_id']],
  attendance: [['student_id','class_id','attendance_date']], practice_attendance: [['student_id','practice_date']],
  teacher_attendance: [['teacher_id','attendance_date']], lesson_monitoring: [['student_id','class_id','monitoring_date']],
  outside_activity_attendance: [['activity_id','student_id']], finance_records: [['student_id','month','year']],
  chat_post_reactions: [['post_id','user_id']], follows: [['follower_id','following_id']],
  quiz_attempts: [['quiz_id','student_id']], quiz_answers: [['attempt_id','question_id']],
  teacher_classes: [['teacher_id','class_id']], teacher_subjects: [['teacher_id','subject_id','class_id']],
  class_subjects: [['class_id','subject_id']], committee_classes: [['committee_id','class_id']],
  committee_member_classes: [['committee_member_id','class_id']], committee_members: [['committee_id','profile_id']],
  student_parents: [['parent_id','student_id']], chat_participants: [['conversation_id','profile_id']],
  results: [['submission_id','student_id']], app_settings: [['key']], auth_users: [['email'], ['user_id']],
  auth_sessions: [['refresh_hash']],
}

function fieldDefinition(name: string, definition: Definition): any {
  const type = definition.type
  const field: any = { required: definition.required ?? false }
  if (/^(int|integer|bigint|numeric|smallint)/.test(type)) {
    field.type = Number
    field.validate = { validator: (v: number) => v == null || Number.isFinite(v), message: 'Must be a finite number' }
    if (/^(int|integer|bigint|smallint)/.test(type)) field.validate.validator = (v: number) => v == null || Number.isSafeInteger(v)
  } else if (type === 'boolean') field.type = Boolean
  else if (type === 'jsonb' || type === 'json') field.type = Schema.Types.Mixed
  else {
    field.type = String
    if (type === 'text') { field.trim = true; field.maxlength = ['body','content','description','notes'].includes(name) ? 20000 : 1000 }
    if (type === 'uuid') field.match = uuidPattern
    if (type === 'date' || type === 'timestamptz') {
      field.validate = { validator: (v: string) => v == null || (Number.isFinite(Date.parse(v)) && (type !== 'date' || /^\d{4}-\d{2}-\d{2}$/.test(v))), message: 'Invalid date' }
    }
  }
  if (definition.ref) { field.ref = definition.ref; field.index = true }
  if (definition.enum?.length) field.enum = definition.enum
  const d = definition.default
  if (d === 'gen_random_uuid()') field.default = () => randomUUID()
  else if (d === 'now()') field.default = () => new Date().toISOString()
  else if (d === 'CURRENT_DATE') field.default = () => new Date().toISOString().slice(0,10)
  else if (d === 'true' || d === 'false') field.default = d === 'true'
  else if (d && /^-?\d/.test(d)) field.default = Number(d)
  else if (d?.startsWith("'")) {
    const value = d.slice(1,-1)
    field.default = type === 'jsonb' ? () => JSON.parse(value) : value
  }
  if (name === 'id') { field.default = () => randomUUID(); field.unique = true }
  if (['amount','marks','marks_obtained','max_marks','total_marks','file_size','capacity','time_limit_minutes','score','max_score','marks_awarded'].includes(name)) field.min = 0
  if (name === 'month') { field.min=1; field.max=12 }
  if (name === 'year') { field.min=2020; field.max=2100 }
  return field
}

export function getModel(name: string): Model<any> {
  const cached = models.get(name)
  if (cached) return cached
  let fields: Record<string, any> = {}
  if (name === 'auth_users') fields = {
    _id: { type: String, default: () => randomUUID() }, user_id: { type: String, required: true, match: uuidPattern, ref: 'profiles' },
    email: { type: String, lowercase: true, trim: true, required: true, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    login_id: String, password_hash: { type: String, required: true, select: false }, status: String,
    token_version: { type: Number, default: 0 }, created_at: String, updated_at: String,
  }
  else if (name === 'auth_sessions') fields = {
    _id: { type: String, default: () => randomUUID() }, user_id: { type: String, required: true, ref: 'profiles' },
    refresh_hash: { type: String, required: true }, created_at: String, expires_at: { type: String, required: true },
  }
  else if (name === 'contact_messages') fields = {
    id: { type: String, default: () => randomUUID(), unique: true },
    name: { type: String, trim: true, required: true, minlength: 2, maxlength: 100 },
    email: { type: String, trim: true, lowercase: true, required: true, maxlength: 254, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    subject: { type: String, trim: true, required: true, minlength: 3, maxlength: 200 },
    message: { type: String, trim: true, required: true, minlength: 10, maxlength: 10000 },
    created_at: String, updated_at: String,
  }
  else {
    const definition = modelDefinitions[name]
    if (!definition) throw new Error(`Unknown model: ${name}`)
    for (const [key, value] of Object.entries(definition)) fields[key] = fieldDefinition(key, value)
    // Existing API uses UUIDs as stable business IDs, independent of MongoDB's ObjectId _id.
    fields.id ??= { type: String, default: () => randomUUID(), unique: true }
    fields.created_at ??= String
    fields.updated_at ??= String
  }
  if (name === 'profiles') {
    fields.login_id.maxlength = 32
    fields.role.enum = [...new Set([...ROLES, 'parent'])]
    fields.email = { type: String, lowercase: true, trim: true }
  }
  if (name === 'students') fields.student_id.match = /^SOMSTAR([1-5][0-9]{2}|600)$/
  if (name === 'password_reset_requests') { fields.login_id.maxlength=32; fields.requester_note.maxlength=500 }
  if (name === 'quiz_attempts') fields.submitting = { type: Boolean, default: false }
  for (const keys of uniqueKeys[name] ?? []) if (keys.length===1 && fields[keys[0]!]) delete fields[keys[0]!].index
  const schema = new Schema(fields, {
    collection: name, strict: 'throw', strictQuery: false, versionKey: false,
    // import_jobs.errors is an existing persisted API field, returned as lean data.
    suppressReservedKeysWarning: name === 'import_jobs',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at', currentTime: () => new Date().toISOString() as any },
  })
  for (const keys of uniqueKeys[name] ?? []) schema.index(Object.fromEntries(keys.map(k => [k,1])), { unique: true })
  if (name === 'subjects') schema.index({ code: 1 }, { unique: true, partialFilterExpression: { code: { $type: 'string' } } })
  if (name === 'notifications') schema.index({ profile_id: 1, is_read: 1, created_at: -1 })
  if (name === 'chat_messages') schema.index({ conversation_id: 1, created_at: -1 })
  if (name === 'finance_records') schema.index({ year: 1, month: 1 })
  const model = mongoose.models[name] ?? mongoose.model(name, schema)
  models.set(name, model)
  return model
}

export async function initializeModels(): Promise<void> {
  for (const name of [...Object.keys(modelDefinitions), 'auth_users','auth_sessions','contact_messages']) {
    if (process.env.DEBUG_SETUP) console.log('Initialize model:',name)
    await getModel(name).init()
  }
}

export { modelDefinitions }
