import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { fixture } from './fixture.ts'

test('MongoDB-backed application workflows and security',async t=>{
  const f=await fixture()
  const {api,users,classId,otherClassId,teacherId,studentId}=f
  t.after(()=>f.close())
  const manager={role:'school_manager'}
  const create=async(table:string,body:unknown,role='school_manager')=>api('/resources/'+table+'?select=*',{role,method:'POST',body,headers:{Prefer:'return=representation'}})
  const patch=async(table:string,id:string,body:unknown,role='school_manager')=>api('/resources/'+table+'?id=eq.'+id,{role,method:'PATCH',body,headers:{Prefer:'return=representation'}})
  await t.test('health, CORS, malformed JSON and unauthenticated access',async()=>{
    assert.equal((await api('/health')).status,200)
    assert.equal((await api('/resources/profiles')).status,401)
    assert.equal((await api('/resources/profiles',{token:'invalid'})).status,401)
    assert.equal((await api('/health',{headers:{Origin:'https://untrusted.example'}})).status,403)
    const malformed=await fetch(f.base+'/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'})
    assert.equal(malformed.status,400)
  })
  await t.test('login rejects invalid credentials and sets correct expiry',async()=>{
    assert.equal((await api('/auth/token',{method:'POST',body:{email:'unknown',password:'wrong'}})).status,400)
    assert.equal((await api('/auth/token',{method:'POST',body:{email:users.student.login,password:'wrong'}})).status,400)
    const expiry=users.student.session.expires_at
    assert.ok(expiry>Date.now()/1000 && expiry<Date.now()/1000+3700)
    assert.equal((await api('/auth/me',{role:'student'})).data.id,users.student.id)
  })
  await t.test('manager creates users; duplicates and invalid roles rejected',async()=>{
    const body={loginId:'SOMSTAR101',fullName:'Second Student',role:'student',password:'Valid-password-123!',student:{parentName:'Parent',parentPhone:'252610000001',classId:otherClassId}}
    const result=await api('/operations/create-user',{...manager,method:'POST',body})
    assert.equal(result.status,200,JSON.stringify(result.data))
    assert.equal((await api('/operations/create-user',{...manager,method:'POST',body})).status,409)
    assert.equal((await api('/operations/create-user',{...manager,method:'POST',body:{...body,loginId:'EVIL',role:'admin'}})).status,400)
    assert.equal((await api('/operations/create-user',{role:'student',method:'POST',body})).status,403)
  })
  await t.test('CRUD validates fields and persists across reconnect',async()=>{
    const created=await create('subjects',{name:'Science',code:'SCI'})
    assert.equal(created.status,201,JSON.stringify(created.data))
    const id=created.data[0].id
    assert.equal((await create('subjects',{name:'Science'})).status,409)
    assert.equal((await create('subjects',{})).status,400)
    assert.equal((await patch('subjects',id,{description:'Updated'})).status,200)
    await f.closeDb(); await f.connectDb()
    assert.equal((await api('/resources/subjects?id=eq.'+id,manager)).data[0].description,'Updated')
    assert.equal((await api('/resources/subjects?id=eq.'+id,{...manager,method:'DELETE'})).status,204)
    assert.equal(await f.collection('subjects').countDocuments({id}),0)
  })
  await t.test('profile escalation and unassigned student access denied',async()=>{
    assert.equal((await patch('profiles',users.student.id,{role:'school_manager'},'student')).status,403)
    assert.equal((await patch('profiles',users.student.id,{permissions:{school_wide_social:true}},'student')).status,403)
    assert.equal((await patch('students',studentId,{class_id:otherClassId},'student')).status,403)
    const rows=(await api('/resources/students',{role:'teacher'})).data
    assert.equal(rows.length,1)
    assert.equal(rows[0].id,studentId)
    assert.equal((await patch('teachers',teacherId,{specialization:'English'})).status,200)
    assert.equal((await api('/resources/auth_users',manager)).status,404)
    assert.equal((await create('subjects',{$where:'malicious'})).status,400)
  })
  await t.test('parent child scope and finance write separation',async()=>{
    assert.equal((await api('/resources/students',{role:'parent'})).data.length,1)
    const row=await create('finance_records',{student_id:studentId,class_id:classId,month:9,year:2026,amount:20,status:'paid'},'finance_officer')
    assert.equal(row.status,201,JSON.stringify(row.data))
    assert.equal((await patch('finance_records',row.data[0].id,{amount:30},'finance_manager')).status,403)
    assert.equal((await api('/resources/finance_records',{role:'parent'})).data.length,1)
    assert.equal((await create('finance_records',{student_id:studentId,month:13,year:2026})).status,400)
  })
  await t.test('compound filters, OR, negation and pagination',async()=>{
    const rows=await api('/resources/classes?capacity=gte.30&capacity=lte.50&or=(name.eq.Test%20Class,name.eq.Other%20Class)',manager)
    assert.equal(rows.data.length,2)
    assert.equal((await api('/resources/classes?name=not.eq.Test%20Class',manager)).data.length,1)
    assert.equal((await api('/resources/classes?limit=-1',manager)).status,400)
  })
  await t.test('attendance ownership, upsert and notifications',async()=>{
    const body={student_id:studentId,class_id:classId,teacher_id:teacherId,monitoring_date:'2026-09-07',status:'present',recorded_by:users.teacher.id}
    const result=await create('lesson_monitoring',body,'teacher')
    assert.equal(result.status,201,JSON.stringify(result.data))
    const updated=await api('/resources/lesson_monitoring?on_conflict=student_id,class_id,monitoring_date&select=*',{role:'teacher',method:'POST',body:{...body,status:'absent'},headers:{Prefer:'return=representation,resolution=merge-duplicates'}})
    assert.equal(updated.status,201,JSON.stringify(updated.data))
    assert.equal(await f.collection('lesson_monitoring').countDocuments({student_id:studentId}),1)
    assert.ok(await f.collection('notifications').countDocuments({profile_id:users.parent.id})>0)
  })
  await t.test('contact and password reset persist without fake success',async()=>{
    assert.equal((await api('/contact',{method:'POST',body:{name:'Test User',email:'test@example.com',subject:'Admissions',message:'Please tell me about the school.'}})).status,201)
    assert.equal(await f.collection('contact_messages').countDocuments({}),1)
    assert.equal((await api('/contact',{method:'POST',body:{name:'x'}})).status,400)
    const reset=await api('/resources/password_reset_requests',{method:'POST',body:{login_id:'SOMSTAR100',requester_note:'Please reset'}})
    assert.equal(reset.status,201,JSON.stringify(reset.data))
  })
  await t.test('quiz answer keys hidden, grading controlled by server',async()=>{
    const quiz=await create('quizzes',{title:'Quiz',class_id:classId,teacher_id:teacherId,is_published:true})
    assert.equal(quiz.status,201,JSON.stringify(quiz.data))
    const quizId=quiz.data[0].id
    const question=await create('quiz_questions',{quiz_id:quizId,question_text:'Two plus two?',question_type:'short_answer',correct_answer:'4',marks:2})
    const questionId=question.data[0].id
    const visible=await api('/resources/quiz_questions?quiz_id=eq.'+quizId,{role:'student'})
    assert.equal(visible.data[0].correct_answer,undefined)
    const attempt=await create('quiz_attempts',{quiz_id:quizId,student_id:studentId},'student')
    assert.equal(attempt.status,201,JSON.stringify(attempt.data))
    const attemptId=attempt.data[0].id
    assert.equal((await patch('quiz_attempts',attemptId,{score:999},'student')).status,403)
    const submitted=await api('/quizzes/attempts/'+attemptId+'/submit',{role:'student',method:'POST',body:{answers:[{questionId,answerText:'4'}]}})
    assert.equal(submitted.status,200,JSON.stringify(submitted.data)); assert.equal(submitted.data.data.score,2)
    assert.equal((await api('/quizzes/attempts/'+attemptId+'/submit',{role:'student',method:'POST',body:{answers:[]}})).status,409)
  })
  await t.test('private storage and anonymous signing denied',async()=>{
    assert.equal((await api('/storage/public/database-backups/secret.json')).status,403)
    assert.equal((await api('/storage/sign/lesson-files/a/b/file.pdf',{method:'POST',body:{expiresIn:60}})).status,401)
    assert.equal((await api('/storage/sign/database-backups/secret.json',{role:'student',method:'POST',body:{expiresIn:60}})).status,403)
  })
  await t.test('refresh rotates and logout revokes access tokens',async()=>{
    const refresh=users.student.session.refresh_token
    const rotated=await api('/auth/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:refresh}})
    assert.equal(rotated.status,200)
    assert.equal((await api('/auth/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:refresh}})).status,400)
    assert.equal((await api('/auth/logout',{role:'student',method:'POST'})).status,204)
    assert.equal((await api('/auth/me',{role:'student'})).status,401)
  })
})
