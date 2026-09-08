import { spawn, type ChildProcess } from 'node:child_process'
import { createConnection } from 'node:net'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { resolve, sep } from 'node:path'

export async function ensureTestMongo(port=27028) {
  const available=await new Promise<boolean>(resolve=>{
    const socket=createConnection({host:'127.0.0.1',port})
    socket.on('connect',()=>{socket.destroy();resolve(true)})
    socket.on('error',()=>resolve(false))
  })
  if (available) return async()=>{}
  const binary=process.env.MONGOD_BINARY || (process.platform==='win32'?'C:/Program Files/MongoDB/Server/8.0/bin/mongod.exe':'mongod')
  const base=resolve(import.meta.dirname,`../.test-data-${port}`)
  await mkdir(base,{recursive:true})
  const dir=await mkdtemp(resolve(base,'run-'))
  const child=spawn(binary,['--dbpath',dir,'--port',String(port),'--bind_ip','127.0.0.1','--logpath',resolve(dir,'mongod.log')],{windowsHide:true,stdio:'ignore'})
  let spawnError:Error|undefined
  child.on('error',e=>{spawnError=e})
  for(let i=0;i<100;i++) {
    if(spawnError) throw spawnError
    if(child.exitCode!==null) throw new Error('Test MongoDB exited before startup; inspect '+resolve(dir,'mongod.log'))
    const ready=await new Promise<boolean>(resolve=>{const socket=createConnection({host:'127.0.0.1',port});socket.on('connect',()=>{socket.destroy();resolve(true)});socket.on('error',()=>resolve(false))})
    if(ready) break
    await new Promise(r=>setTimeout(r,100))
  }
  return async()=>{
    child.kill()
    await new Promise<void>(r=>child.exitCode!==null?r():child.once('exit',()=>r()))
    const target=resolve(dir)
    if(!target.startsWith(base+sep)) throw new Error('Refusing to delete a path outside test data')
    await rm(target,{recursive:true,force:true,maxRetries:3,retryDelay:200})
  }
}
