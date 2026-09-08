import { collection } from '../db.ts'
import { getModel, ROLES } from '../models/index.ts'
import { hashPassword, uuid } from '../util.ts'
import { ApiError } from '../errors.ts'
import type { RequestContext } from '../security.ts'

export async function createAccount(body:Record<string,any>,ctx:RequestContext) {
  if (!ctx.isManager()) throw new ApiError(403,'Only School Manager can create users')
  const loginId=typeof body.loginId==='string'?body.loginId.trim().toUpperCase():''
  const password=typeof body.password==='string'?body.password:''
  const fullName=typeof body.fullName==='string'?body.fullName.trim():''
  const role=String(body.role ?? '')
  if (!/^[A-Z0-9_-]{1,32}$/.test(loginId) || !fullName || !ROLES.includes(role)) throw new ApiError(400,'Invalid login ID, name or role')
  if (password.length<8 || Buffer.byteLength(password,'utf8')>72) throw new ApiError(400,'Password must be at least 8 characters and at most 72 bytes')
  const email=loginId.toLowerCase()+'@somalistar.internal'
  if (await collection('auth_users').findOne({email}) || await collection('profiles').findOne({login_id:loginId})) throw new ApiError(409,'Login ID already in use')
  const userId=uuid(),teacherId=uuid()
  const student=body.student ?? {},teacher=body.teacher ?? {}
  const profile={id:userId,login_id:loginId,full_name:fullName,role,phone:body.phone??null,status:student.status??teacher.status??'active',permissions:body.permissions??{},created_by:ctx.userId}
  await new (getModel('profiles'))(profile).validate()
  const classIds=[...new Set<string>(Array.isArray(teacher.classIds)?teacher.classIds.map(String):[])]
  for (const classId of [...classIds,...(student.classId?[student.classId]:[])]) if (!await collection('classes').findOne({id:classId})) throw new ApiError(400,'Class not found')
  if (student.academicYearId && !await collection('academic_years').findOne({id:student.academicYearId})) throw new ApiError(400,'Academic year not found')
  let studentRow:Record<string,unknown>|undefined, teacherRow:Record<string,unknown>|undefined
  if (role==='student') {
    studentRow={profile_id:userId,student_id:loginId,parent_name:student.parentName,parent_phone:student.parentPhone,class_id:student.classId??null,academic_year_id:student.academicYearId??null}
    await new (getModel('students'))(studentRow).validate()
  }
  if (['teacher','teacher_cabaas','practice_teacher','supervisor'].includes(role)) {
    teacherRow={id:teacherId,profile_id:userId,teacher_id:loginId,specialization:teacher.specialization??null,is_practice:role==='practice_teacher'||teacher.isPractice===true}
    await new (getModel('teachers'))(teacherRow).validate()
  }
  try {
    await collection('auth_users').insertOne({user_id:userId,email,login_id:loginId,password_hash:await hashPassword(password),status:'active'})
    await collection('profiles').insertOne(profile)
    if (studentRow) await collection('students').insertOne(studentRow)
    if (teacherRow) {
      await collection('teachers').insertOne(teacherRow)
      for (const class_id of classIds) await collection('teacher_classes').insertOne({teacher_id:teacherId,class_id,assigned_by:ctx.userId})
    }
    await collection('audit_logs').insertOne({actor_id:ctx.userId,action:role+'_created',entity:'profiles',entity_id:userId,metadata:{loginId,role,fullName}})
  } catch(error) {
    // Compensate on standalone MongoDB as well as replica sets; never leave a partial login.
    await collection('teacher_classes').deleteMany({teacher_id:teacherId})
    await collection('teachers').deleteMany({profile_id:userId})
    await collection('students').deleteMany({profile_id:userId})
    await collection('profiles').deleteMany({id:userId})
    await collection('auth_users').deleteMany({user_id:userId})
    throw error
  }
  return {success:true,userId,loginId,message:'User created successfully'}
}
