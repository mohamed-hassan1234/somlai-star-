import { randomUUID } from 'node:crypto'
import { ensureTestMongo } from './mongo.ts'
process.env.JWT_SECRET ??= 'isolated-test-secret-with-more-than-32-characters'
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27028/academy_test_'+randomUUID().replaceAll('-','')
process.env.PUBLIC_BASE_URL ??= 'http://127.0.0.1:5001/api'
process.env.CLIENT_URL ??= 'http://localhost:5173'
process.env.STORAGE_ROOT ??= '.test-uploads'

export async function fixture() {
  const stopMongo=await ensureTestMongo()
  const {connectDb,closeDb,collection}=await import('../src/db.ts')
  const {createApp}=await import('../src/app.ts')
  const {attachRealtime}=await import('../src/realtime.ts')
  const {createServer}=await import('node:http')
  const {hashPassword}=await import('../src/util.ts')
  const {getModel}=await import('../src/models/index.ts')
  try { await connectDb() } catch (error) { await closeDb(); await stopMongo(); throw error }
  const password='Test-password-937!'
  const users: Record<string,any>={}
  for (const role of ['school_manager','teacher','student','parent','finance_officer','finance_manager','teacher_cabaas','supervisor','attendance_manager','outside_activity_committee','practice_teacher']) {
    const id=randomUUID()
    const login=role==='student'?'SOMSTAR100':role==='school_manager'?'MGR001':role.toUpperCase()
    await collection('profiles').insertOne({id,login_id:login,full_name:role+' Test',role,status:'active',permissions:{},must_change_password:false})
    await collection('auth_users').insertOne({user_id:id,email:login.toLowerCase()+'@somalistar.internal',password_hash:await hashPassword(password),login_id:login,status:'active'})
    users[role]={id,login,password}
  }
  const classId=randomUUID(),otherClassId=randomUUID(),teacherId=randomUUID(),studentId=randomUUID()
  await collection('classes').insertOne({id:classId,name:'Test Class',schedule_slot:'Morning'})
  await collection('classes').insertOne({id:otherClassId,name:'Other Class',schedule_slot:'Evening'})
  await collection('teachers').insertOne({id:teacherId,profile_id:users.teacher.id,teacher_id:'TCH001'})
  await collection('students').insertOne({id:studentId,profile_id:users.student.id,student_id:'SOMSTAR100',parent_name:'Test Parent',parent_phone:'252611000000',class_id:classId})
  await collection('teacher_classes').insertOne({teacher_id:teacherId,class_id:classId})
  await collection('student_parents').insertOne({parent_id:users.parent.id,student_id:studentId})
  const server=createServer(createApp())
  const wss=attachRealtime(server)
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
  const address=server.address() as {port:number}
  const base=`http://127.0.0.1:${address.port}/api`
  async function api(path:string,options: {role?:string; token?:string; method?:string; body?:unknown; headers?:Record<string,string>}={}) {
    const headers:Record<string,string>={...options.headers}
    if (options.role) headers.Authorization='Bearer '+users[options.role].token
    if (options.token) headers.Authorization='Bearer '+options.token
    const isForm=options.body instanceof FormData
    if (options.body!==undefined && !isForm) headers['Content-Type']='application/json'
    const response=await fetch(base+path,{method:options.method??'GET',headers,body:options.body===undefined?undefined:isForm?options.body as FormData:JSON.stringify(options.body)})
    const text=await response.text()
    let data:any=null
    try {data=JSON.parse(text)} catch {data=text}
    return {status:response.status,data,headers:response.headers}
  }
  for (const [role,user] of Object.entries(users)) {
    const login=await api('/auth/token',{method:'POST',body:{email:user.login,password}})
    if (login.status!==200) throw new Error('Fixture login failed: '+JSON.stringify(login.data))
    user.token=login.data.access_token
    user.session=login.data
  }
  return {api,users,base,collection,getModel,classId,otherClassId,teacherId,studentId,closeDb,connectDb,
    async close() {
      for (const socket of wss.clients) socket.terminate()
      wss.close()
      await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()))
      const mongoose=(await import('mongoose')).default
      if (!mongoose.connection.name.startsWith('academy_test_')) throw new Error('Refusing to drop non-test database')
      await mongoose.connection.dropDatabase()
      await closeDb()
      await stopMongo()
    },
  }
}
