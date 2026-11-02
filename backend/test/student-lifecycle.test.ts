import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

// Own mongod instance so this suite never shares (and never tears down) the one the
// other test files use while they are still running.
process.env.TEST_MONGO_PORT ??= '27030'
const { fixture } = await import('./fixture.ts')

test('student registration, ID reuse and deletion history', async t => {
  const f = await fixture()
  const { api, users, classId, teacherId } = f
  t.after(() => f.close())
  const manager = { role: 'school_manager' }
  const password = 'Student-pass-937!'
  const yearId = randomUUID()
  await f.collection('academic_years').insertOne({
    id: yearId,
    name: 'Test Year',
    start_date: '2025-09-01',
    end_date: '2026-08-31',
    is_active: true,
  })

  const createStudent = async (loginId: string, overrides: Record<string, unknown> = {}) =>
    api('/operations/create-user', {
      ...manager,
      method: 'POST',
      body: {
        loginId,
        password,
        fullName: 'Lifecycle Student',
        role: 'student',
        student: {
          parentName: 'Lifecycle Parent',
          parentPhone: '252611000000',
          classId,
          academicYearId: yearId,
          status: 'active',
          ...overrides,
        },
      },
    })

  await t.test('allocates the lowest free ID and never renumbers existing students', async () => {
    // The fixture already holds SOMSTAR100, so the lowest free ID is the next one.
    const first = await api('/actions/next_student_id', { ...manager, method: 'POST' })
    assert.equal(first.status, 200)
    assert.match(String(first.data), /^SOMSTAR([1-6][0-9]{2}|700)$/)
    assert.notEqual(String(first.data), 'SOMSTAR100')
  })

  await t.test('rejects IDs outside SOMSTAR100-SOMSTAR700 and malformed IDs', async () => {
    for (const bad of ['SOMSTAR701', 'SOMSTAR99', 'SOMSTAR1000', 'ABC100']) {
      const res = await api('/operations/create-user', {
        ...manager,
        method: 'POST',
        body: {
          loginId: bad,
          password,
          fullName: 'Range Student',
          role: 'student',
          student: { parentName: 'P', parentPhone: '252611000000', classId, academicYearId: yearId },
        },
      })
      assert.equal(res.status, 400, `${bad} should be rejected`)
    }
  })

  let allocatedId = ''
  let profileId = ''

  await t.test('creates a student with a student image', async () => {
    const next = await api('/actions/next_student_id', { ...manager, method: 'POST' })
    allocatedId = String(next.data)
    const avatarUrl = 'http://127.0.0.1:5001/api/storage/public/avatars/pending/lifecycle.png'
    const res = await createStudent(allocatedId, { avatarUrl })
    assert.equal(res.status, 200)

    const row = await f.collection('students').findOne({ student_id: allocatedId })
    assert.ok(row, 'students row must exist')
    profileId = String(row!.profile_id)
    const profile = await f.collection('profiles').findOne({ id: profileId })
    assert.equal(profile!.avatar_url, avatarUrl, 'image must be stored on the profile')
    assert.equal(profile!.deleted_at ?? null, null)
    assert.equal(profile!.login_id, allocatedId)
  })

  await t.test('refuses a duplicate SOMSTAR ID', async () => {
    const res = await createStudent(allocatedId)
    assert.equal(res.status, 409)
  })

  await t.test('recovers a forgotten password with a one-time temporary password', async () => {
    const res = await api('/operations/student-password-recovery', {
      ...manager,
      method: 'POST',
      body: { loginId: allocatedId },
    })
    assert.equal(res.status, 200)
    assert.equal(res.data.success, true)
    assert.equal(res.data.mustChangePassword, true)
    assert.ok(res.data.temporaryPassword && res.data.temporaryPassword.length >= 8)
    assert.equal(JSON.stringify(res.data).includes('password_hash'), false, 'hash must never be returned')

    const profile = await f.collection('profiles').findOne({ id: profileId })
    assert.equal(profile!.must_change_password, true)
    const auth = await f.collection('auth_users').findOne({ user_id: profileId })
    assert.notEqual(auth!.password_hash, res.data.temporaryPassword, 'must be stored hashed')
  })

  await t.test('disables and re-enables the account', async () => {
    const off = await api(`/resources/profiles?id=eq.${profileId}`, {
      ...manager,
      method: 'PATCH',
      body: { status: 'disabled' },
    })
    assert.equal(off.status, 204)
    assert.equal((await f.collection('profiles').findOne({ id: profileId }))!.status, 'disabled')

    await api(`/resources/profiles?id=eq.${profileId}`, {
      ...manager,
      method: 'PATCH',
      body: { status: 'active' },
    })
    assert.equal((await f.collection('profiles').findOne({ id: profileId }))!.status, 'active')
  })

  await t.test('edits student details', async () => {
    const res = await api(`/resources/students?id=eq.${(await f.collection('students').findOne({ student_id: allocatedId }))!.id}`, {
      ...manager,
      method: 'PATCH',
      body: { parent_name: 'Updated Parent', parent_phone: '252655555555' },
    })
    assert.equal(res.status, 204)
    const row = await f.collection('students').findOne({ student_id: allocatedId })
    assert.equal(row!.parent_name, 'Updated Parent')
    assert.equal(row!.parent_phone, '252655555555')
  })

  await t.test('deleting keeps history but releases the SOMSTAR ID', async () => {
    const row = (await f.collection('students').findOne({ student_id: allocatedId }))!
    const rowId = String(row.id)
    await f.collection('attendance').insertOne({
      id: randomUUID(),
      student_id: rowId,
      class_id: classId,
      teacher_id: teacherId,
      attendance_date: '2026-01-05',
      status: 'present',
      recorded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    await f.collection('student_parents').insertOne({ parent_id: users.parent.id, student_id: rowId })

    const res = await api('/operations/delete-student', { ...manager, method: 'POST', body: { id: rowId } })
    assert.equal(res.status, 200)
    assert.equal(res.data.success, true)
    assert.equal(res.data.releasedStudentId, allocatedId)

    assert.equal(await f.collection('students').findOne({ id: rowId }), null, 'students row must be removed')
    assert.equal(await f.collection('auth_users').findOne({ user_id: profileId }), null, 'login must be destroyed')
    assert.equal(await f.collection('auth_sessions').countDocuments({ user_id: profileId }), 0)
    assert.equal(await f.collection('student_parents').countDocuments({ student_id: rowId }), 0)

    const archived = await f.collection('profiles').findOne({ id: profileId })
    assert.ok(archived!.deleted_at, 'profile must be archived')
    assert.equal(archived!.status, 'disabled')
    assert.equal(archived!.archived_login_id, allocatedId, 'original ID kept for traceability')
    assert.notEqual(archived!.login_id, allocatedId, 'SOMSTAR login ID must be released')

    assert.equal(
      await f.collection('attendance').countDocuments({ student_id: rowId }),
      1,
      'historical attendance must survive the delete',
    )
  })

  await t.test('the released SOMSTAR ID can be assigned again as a brand new student', async () => {
    const next = await api('/actions/next_student_id', { ...manager, method: 'POST' })
    assert.equal(String(next.data), allocatedId, 'released ID must be reused before higher ones')

    const res = await createStudent(allocatedId, { parentName: 'Reuse Parent', parentPhone: '252644444444' })
    assert.equal(res.status, 200, 'reusing the ID must succeed')

    const newRow = (await f.collection('students').findOne({ student_id: allocatedId }))!
    const oldArchived = (await f.collection('profiles').findOne({ archived_login_id: allocatedId }))!
    assert.notEqual(newRow.id, oldArchived.id, 'a fresh students row must be created')
    assert.notEqual(newRow.profile_id, oldArchived.id, 'must not inherit the archived profile')
    assert.equal(newRow.parent_name, 'Reuse Parent', 'must not inherit old parent details')
    assert.equal(newRow.parent_phone, '252644444444')

    const newProfile = await f.collection('profiles').findOne({ id: newRow.profile_id })
    assert.equal(newProfile!.deleted_at ?? null, null)
    assert.equal(newProfile!.full_name, 'Lifecycle Student')
  })

  await t.test('a non-manager cannot delete a student', async () => {
    const row = (await f.collection('students').findOne({ student_id: allocatedId }))!
    const res = await api('/operations/delete-student', {
      role: 'teacher',
      method: 'POST',
      body: { id: String(row.id) },
    })
    assert.equal(res.status, 403)
  })
})