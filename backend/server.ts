import { createServer } from 'node:http'
import { createApp } from './src/app.ts'
import { connectDb,closeDb } from './src/db.ts'
import { config } from './src/config.ts'
import { attachRealtime } from './src/realtime.ts'
import { runScheduledBackupIfDue,runCheckTeacherAbsence } from './src/backup.ts'

await connectDb()
const server=createServer(createApp())
const wss=attachRealtime(server)
server.listen(config.port,config.host,() => console.log(`Academy API listening on ${config.host}:${config.port}/api`))
const job=setInterval(() => void runScheduledBackupIfDue().catch(e => console.error('Backup job failed',e.name)),30000)
const absence=setInterval(() => {
  const now=new Date()
  if (now.getHours()===18 && now.getMinutes()===0) void runCheckTeacherAbsence().catch(e => console.error('Absence job failed',e.name))
},60000)
let stopping=false
async function stop() {
  if (stopping) return
  stopping=true
  clearInterval(job); clearInterval(absence)
  for (const socket of wss.clients) socket.terminate()
  wss.close()
  await new Promise<void>((resolve,reject) => server.close(e => e ? reject(e) : resolve()))
  await closeDb()
}
process.on('SIGINT',() => void stop())
process.on('SIGTERM',() => void stop())
