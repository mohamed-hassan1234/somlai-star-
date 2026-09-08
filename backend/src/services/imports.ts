import { createAccount } from './accounts.ts'
import { collection } from '../db.ts'
import { getModel } from '../models/index.ts'
import { runQuery } from '../engine.ts'
import { runRpc } from '../rpc.ts'
import type { RequestContext } from '../security.ts'
import { ApiError } from '../errors.ts'

export async function importRows(rows:Record<string,any>[],module:string,mode:string,ctx:RequestContext,fileName:string) {
  if (!ctx.isManager()) throw new ApiError(403,'Only School Manager can import data')
  if (!['students','teachers','finance','generic'].includes(module) || !['skip','update'].includes(mode)) throw new ApiError(400,'Invalid import module or mode')
  if (rows.length>5000) throw new ApiError(400,'Import at most 5000 rows at a time')
  let successful=0,skippedDuplicates=0
  const errors:Array<{row:number;message:string}>=[]
  for (const [index,row] of rows.entries()) {
    try {
      if (!row || typeof row!=='object' || Array.isArray(row)) throw new ApiError(400,'Row must be an object')
      const pick=(key:string,label:string)=>row[key]??row[label]
      if (module==='students'||module==='teachers') {
        const student=module==='students'
        const key=student?'student_id':'teacher_id'
        const login=String(pick(key,student?'Student ID':'Teacher ID')??'').toUpperCase().trim()
        const existing=await collection(module).findOne({[key]:login})
        if (existing && mode==='skip') {skippedDuplicates++;continue}
        const fields:Record<string,unknown>={}
        const keys=student?['parent_name','parent_phone','phone','class_id','academic_year_id','notes']:['specialization','notes','is_practice']
        for (const field of keys) {
          const label=field.split('_').map(w=>w[0]!.toUpperCase()+w.slice(1)).join(' ')
          if (pick(field,label)!==undefined) fields[field]=pick(field,label)
        }
        if (existing) {
          await runQuery({table:module,method:'PATCH',filters:[{column:'id',op:'eq',value:existing.id}],body:fields},ctx)
          if (pick('full_name','Full Name')) await runQuery({table:'profiles',method:'PATCH',filters:[{column:'id',op:'eq',value:existing.profile_id}],body:{full_name:pick('full_name','Full Name')}},ctx)
        } else {
          await createAccount({loginId:login,password:pick('password','Password'),fullName:pick('full_name','Full Name'),phone:pick('phone','Phone'),role:student?'student':'teacher',student:{parentName:fields.parent_name,parentPhone:fields.parent_phone,classId:fields.class_id,academicYearId:fields.academic_year_id},teacher:{specialization:fields.specialization,isPractice:fields.is_practice}},ctx)
        }
      } else if (module==='finance') {
        const existing=await collection('finance_records').findOne({student_id:row.student_id,month:Number(row.month),year:Number(row.year)})
        if (existing && mode==='skip') {skippedDuplicates++;continue}
        await runRpc('upsert_finance_record',{p_student_id:row.student_id,p_class_id:row.class_id,p_month:Number(row.month),p_year:Number(row.year),p_status:row.status,p_amount:row.amount==null?null:Number(row.amount),p_notes:row.notes,p_recorded_by:ctx.userId},ctx)
      } else {
        const table=String(row.table??'')
        if (!['subjects','classes','academic_years','exam_schedules','notices'].includes(table)) throw new ApiError(400,'Generic rows need an allowed table and data object')
        const data=row.data
        const existing=data?.id?await collection(table).findOne({id:data.id}):null
        if (existing && mode==='skip') {skippedDuplicates++;continue}
        await runQuery({table,method:existing?'PATCH':'POST',filters:existing?[{column:'id',op:'eq',value:data.id}]:[],body:data},ctx)
      }
      successful++
    } catch(error) {errors.push({row:index+2,message:error instanceof Error?error.message:'Import failed'})}
  }
  await getModel('import_jobs').create({file_name:fileName,module,total_rows:rows.length,valid_rows:successful,error_rows:errors.length,duplicate_rows:skippedDuplicates,status:errors.length?'failed':'completed',errors,created_by:ctx.userId,completed_at:new Date().toISOString()})
  await collection('backup_logs').insertOne({actor_id:ctx.userId,action:'DATA_IMPORTED',file_name:fileName,status:errors.length?'failed':'success',metadata:{successful,failed:errors.length,skippedDuplicates}})
  return {success:errors.length===0,rowsProcessed:rows.length,successful,failed:errors.length,skippedDuplicates,errors}
}
