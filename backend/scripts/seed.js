import { createHash } from 'node:crypto'
import { connectDb, closeDb, collection } from '../src/db.ts'
import { hashPassword } from '../src/util.ts'
import '../src/config.ts'

const defaultPassword = process.env.SEED_DEFAULT_PASSWORD || process.env.SEED_PASSWORD || ''
if (defaultPassword.length < 12 || Buffer.byteLength(defaultPassword, 'utf8') > 72) {
  throw new Error('Set SEED_DEFAULT_PASSWORD to a unique password of 12–72 bytes in backend/.env')
}

function stableId(key) {
  const hex = createHash('sha256').update(`somali-star-academy:${key}`).digest('hex').slice(0, 32).split('')
  hex[12] = '4'
  hex[16] = ['8', '9', 'a', 'b'][Number.parseInt(hex[16], 16) % 4]
  return `${hex.slice(0,8).join('')}-${hex.slice(8,12).join('')}-${hex.slice(12,16).join('')}-${hex.slice(16,20).join('')}-${hex.slice(20).join('')}`
}

const now = new Date().toISOString()
const today = now.slice(0, 10)
const yearId = stableId('academic-year-2026-2027')
const classId = stableId('class-foundation-a')
const subjects = [
  ['SOM', 'Somali'], ['ENG', 'English'], ['MATH', 'Mathematics'],
  ['SCI', 'Science'], ['ISL', 'Islamic Studies'], ['SOC', 'Social Studies'],
]
const accounts = [
  ['MGR001', process.env.SEED_FULL_NAME || 'School Manager', 'school_manager'],
  ['TCH001', 'Core Teacher', 'teacher'],
  ['CABAAS', 'Teacher Cabaas', 'teacher_cabaas'],
  ['PRACTICE01', 'Practice Teacher', 'practice_teacher'],
  ['SUP001', 'School Supervisor', 'supervisor'],
  ['FIN001', 'Finance Officer', 'finance_officer'],
  ['FINMGR001', 'Finance Manager', 'finance_manager'],
  ['ATT001', 'Attendance Manager', 'attendance_manager'],
  ['COM001', 'Activity Committee', 'outside_activity_committee'],
  ['PAR001', 'Sample Parent', 'parent'],
  ['SOMSTAR100', 'Sample Student', 'student'],
]

async function insertOnce(table, filter, document) {
  const result = await collection(table).updateOne(filter, { $setOnInsert: document }, { upsert: true })
  return result.upsertedCount === 1
}

let inserted = 0
try {
  await connectDb()
  const passwordHash = await hashPassword(defaultPassword)

  inserted += Number(await insertOnce('academic_years', { name: '2026/2027' }, {
    id: yearId, name: '2026/2027', start_date: '2026-09-01', end_date: '2027-06-30',
    is_active: true, is_archived: false,
  }))
  inserted += Number(await insertOnce('classes', { id: classId }, {
    id: classId, name: 'Foundation A', schedule_slot: 'Morning', description: 'Initial seeded class',
    academic_year_id: yearId, capacity: 40, is_active: true,
  }))

  for (const [code, name] of subjects) {
    const subjectId = stableId(`subject-${code}`)
    inserted += Number(await insertOnce('subjects', { code }, { id: subjectId, code, name, is_active: true }))
    inserted += Number(await insertOnce('class_subjects', { class_id: classId, subject_id: subjectId }, {
      id: stableId(`class-subject-${code}`), class_id: classId, subject_id: subjectId,
    }))
  }

  for (const [loginId, fullName, role] of accounts) {
    const profileId = stableId(`profile-${loginId}`)
    inserted += Number(await insertOnce('auth_users', { login_id: loginId }, {
      user_id: profileId, email: `${loginId.toLowerCase()}@somalistar.internal`, login_id: loginId,
      password_hash: passwordHash, status: 'active',
    }))
    inserted += Number(await insertOnce('profiles', { login_id: loginId }, {
      id: profileId, login_id: loginId, full_name: fullName, role, status: 'active', permissions: {},
      must_change_password: true, followers_count: 0, following_count: 0,
    }))

    if (['teacher', 'teacher_cabaas', 'practice_teacher', 'supervisor'].includes(role)) {
      const teacherId = stableId(`teacher-${loginId}`)
      inserted += Number(await insertOnce('teachers', { teacher_id: loginId }, {
        id: teacherId, profile_id: profileId, teacher_id: loginId, specialization: role === 'teacher_cabaas' ? 'Results and Quality' : 'General Education',
        hire_date: today, is_practice: role === 'practice_teacher',
      }))
      inserted += Number(await insertOnce('teacher_classes', { teacher_id: teacherId, class_id: classId }, {
        id: stableId(`teacher-class-${loginId}`), teacher_id: teacherId, class_id: classId, assigned_at: now,
      }))
    }
  }

  const studentProfileId = stableId('profile-SOMSTAR100')
  const studentRecordId = stableId('student-SOMSTAR100')
  inserted += Number(await insertOnce('students', { student_id: 'SOMSTAR100' }, {
    id: studentRecordId, profile_id: studentProfileId, student_id: 'SOMSTAR100', parent_name: 'Sample Parent',
    parent_phone: '+252610000000', class_id: classId, academic_year_id: yearId, password_set: true,
    registration_date: today,
  }))
  inserted += Number(await insertOnce('student_parents', {
    parent_id: stableId('profile-PAR001'), student_id: studentRecordId,
  }, { parent_id: stableId('profile-PAR001'), student_id: studentRecordId, linked_by: stableId('profile-MGR001') }))

  inserted += Number(await insertOnce('app_settings', { key: 'school_profile' }, {
    key: 'school_profile', value: { name: 'Somali Star Academy', website: 'https://somalistaracedemy.elivateict.com' },
  }))
  inserted += Number(await insertOnce('notices', { id: stableId('welcome-notice') }, {
    id: stableId('welcome-notice'), title: 'Welcome to Somali Star Academy',
    body: 'The school management system is ready for use.', is_practice: false, is_late_notice: false,
    published_by: stableId('profile-MGR001'), is_published: true,
  }))

  console.log(`Seed complete: ${inserted} new records. Existing records were preserved.`)
  console.log(`Initial login IDs: ${accounts.map(([id]) => id).join(', ')}`)
  console.log('All seeded users must change the configured initial password after login.')
} finally {
  await closeDb()
}
