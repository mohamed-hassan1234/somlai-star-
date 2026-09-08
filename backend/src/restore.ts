import { collection, BUSINESS_TABLES } from './db.ts'
import { getModel } from './models/index.ts'
import { ApiError } from './errors.ts'

const ALLOWED = new Set<string>(BUSINESS_TABLES)

/** Replace the contents of each listed business table with the snapshot rows (restore).
 *  Bypasses triggers/realtime intentionally (mirrors the replica-database restore). */
export async function restoreFromSnapshot(
  data: Record<string, unknown>,
  tableNames: string[],
): Promise<void> {
  const prepared = new Map<string,Array<Record<string,unknown>>>()
  for (const table of tableNames) {
    if (!ALLOWED.has(table)) throw new ApiError(400,`Unknown backup resource: ${table}`)
    const rows = data[table]
    if (!Array.isArray(rows)) throw new ApiError(400,`Invalid backup rows for ${table}`)
    if (rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new ApiError(400,`Invalid backup row in ${table}`)
    const docs = (rows as Array<Record<string, unknown>>).map(({ _id, ...rest }) => rest)
    for (const doc of docs) await new (getModel(table))(doc).validate()
    prepared.set(table,docs)
  }
  // Preflight every collection before the first mutation. A durable safety file is
  // already written by the controller; in-process failures also restore prior rows.
  const previous = new Map<string,Array<Record<string,unknown>>>()
  for (const table of prepared.keys()) previous.set(table,await collection(table).find({}).toArray())
  const touched:string[]=[]
  try {
    for (const [table,docs] of prepared) {
      touched.push(table)
      await collection(table).deleteMany({})
      if (docs.length) await collection(table).insertMany(docs as never)
    }
  } catch(error) {
    for (const table of touched.reverse()) {
      await collection(table).deleteMany({})
      const rows=previous.get(table)!
      if(rows.length) await collection(table).insertMany(rows as never)
    }
    throw error
  }
}
