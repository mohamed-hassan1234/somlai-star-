import { readFile } from 'node:fs/promises'
import { connectDb,closeDb,collection,BUSINESS_TABLES } from '../src/db.ts'
import { getModel } from '../src/models/index.ts'

const file=process.argv[2]
if (!file) throw new Error('Usage: npm run import -- path/to/export.json (additive; never deletes existing records)')
const parsed=JSON.parse(await readFile(file,'utf8'))
const data=parsed.tables??parsed.data??parsed
const batches:Array<{table:string;rows:Record<string,any>[]}>=[]
for (const [table,rows] of Object.entries(data)) {
  if (!BUSINESS_TABLES.includes(table)) continue
  if (!Array.isArray(rows)) throw new Error(`Expected rows for ${table}`)
  const docs=rows.map(({_id,...row}:any)=>row)
  for (const doc of docs) await new (getModel(table))(doc).validate()
  batches.push({table,rows:docs})
}
if (!batches.length) throw new Error('No recognized application records in export')
try {
  await connectDb()
  let imported=0,skipped=0
  for (const batch of batches) for (const row of batch.rows) {
    const key=batch.table==='app_settings'?{key:row.key}:batch.table==='student_parents'?{parent_id:row.parent_id,student_id:row.student_id}:{id:row.id}
    if (await collection(batch.table).findOne(key)) {skipped++;continue}
    await collection(batch.table).insertOne(row); imported++
  }
  console.log(`Imported ${imported}; skipped ${skipped} existing records. Existing records were not overwritten.`)
  console.log('Passwords and stored files are separate. Imported profiles need their original credential hashes or a manager password reset before login.')
} finally { await closeDb() }
