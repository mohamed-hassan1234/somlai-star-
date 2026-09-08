import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { MongoClient } from 'mongodb'
import { ensureTestMongo } from './mongo.ts'

function runSeed(uri:string) {
  const cli=resolve(import.meta.dirname,'../../node_modules/tsx/dist/cli.mjs')
  return new Promise<{code:number|null;output:string}>((done,reject)=>{
    const child=spawn(process.execPath,[cli,'scripts/seed.js'],{
      cwd:resolve(import.meta.dirname,'..'),windowsHide:true,
      env:{...process.env,MONGODB_URI:uri,JWT_SECRET:'seed-test-secret-with-more-than-32-characters',SEED_DEFAULT_PASSWORD:'Initial-password-937!'},
      stdio:['ignore','pipe','pipe'],
    })
    let output=''
    child.stdout.on('data',chunk=>{output+=chunk})
    child.stderr.on('data',chunk=>{output+=chunk})
    child.on('error',reject)
    child.on('exit',code=>done({code,output}))
  })
}

test('complete seed is valid and idempotent',async()=>{
  const stopMongo=await ensureTestMongo()
  const dbName='academy_seed_test_'+randomUUID().replaceAll('-','')
  const uri=`mongodb://127.0.0.1:27028/${dbName}`
  const client=new MongoClient(uri)
  try {
    const first=await runSeed(uri)
    assert.equal(first.code,0,first.output)
    const second=await runSeed(uri)
    assert.equal(second.code,0,second.output)
    assert.match(second.output,/0 new records/)
    await client.connect()
    const db=client.db(dbName)
    assert.equal(await db.collection('profiles').countDocuments(),11)
    assert.equal(await db.collection('subjects').countDocuments(),6)
    assert.equal(await db.collection('classes').countDocuments(),1)
    assert.equal(await db.collection('student_parents').countDocuments(),1)
  } finally {
    try { await client.connect(); await client.db(dbName).dropDatabase() } catch { /* cleanup best effort */ }
    await client.close()
    await stopMongo()
  }
})
