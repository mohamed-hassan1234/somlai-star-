import { chromium, expect } from '@playwright/test'
import { spawn } from 'node:child_process'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fixture } from '../test/fixture.ts'

const f=await fixture()
const root=resolve(import.meta.dirname,'../..')
const frontend=resolve(root,'frontend')
const output=resolve(root,'docs/testing')
await mkdir(output,{recursive:true})
const vite=spawn(process.execPath,[resolve(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5173','--strictPort'],{cwd:frontend,env:{...process.env,VITE_API_URL:f.base},windowsHide:true,stdio:'pipe'})
let serverLog=''
vite.stdout.on('data',b=>{serverLog+=b.toString()})
vite.stderr.on('data',b=>{serverLog+=b.toString()})
const url='http://localhost:5173'
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined
const results:any[]=[]
try {
  for (let i=0;i<100;i++) {
    if (vite.exitCode!==null) throw new Error('Vite failed: '+serverLog)
    try { if ((await fetch(url)).ok) break } catch {}
    await new Promise(r=>setTimeout(r,200))
  }
  if (!(await fetch(url)).ok) throw new Error('Vite did not start')
  browser=await chromium.launch({channel:'msedge',headless:true})
  const routeText=await readFile(resolve(frontend,'src/routes/index.tsx'),'utf8')
  const roleMap:Record<string,string>={'/manager':'school_manager','/teacher':'teacher','/student':'student','/parent':'parent','/cabaas':'teacher_cabaas','/practice-teacher':'practice_teacher','/supervisor':'supervisor','/finance':'finance_officer','/finance-manager':'finance_manager','/committee':'outside_activity_committee','/attendance':'attendance_manager'}
  const routes:Array<{path:string;role?:string}>=[]
  let parent=''
  for (const line of routeText.split('\n')) {
    const match=/<Route path="([^"]+)"/.exec(line)
    if (!match || match[1]==='*') continue
    const path=match[1]!
    if (path.startsWith('/')) { parent=roleMap[path]?path:''; routes.push({path,role:roleMap[path]}) }
    else routes.push({path:parent+'/'+path,role:roleMap[parent]})
  }
  const lesson=await f.getModel('lessons').create({title:'Browser lesson',class_id:f.classId,teacher_id:f.teacherId,is_published:true})
  // Staff roles backed by a teacher profile require a teacher record on their dashboards.
  for (const role of ['teacher_cabaas','supervisor','practice_teacher']) await f.collection('teachers').insertOne({profile_id:f.users[role].id,teacher_id:role.toUpperCase(),is_practice:role==='practice_teacher'})
  for (const role of [undefined,...Object.values(roleMap)]) {
    const context=await browser.newContext({viewport:{width:1440,height:900}})
    if (role) await context.addInitScript(session=>{localStorage.setItem('somalistar-auth',JSON.stringify(session))},f.users[role].session)
    const page=await context.newPage()
    const errors:string[]=[]
    page.on('pageerror',e=>errors.push(e.message))
    page.on('console',message=>{if(message.type()==='error' && !message.text().startsWith('Failed to load resource')) errors.push(message.text())})
    page.on('response',r=>{if(r.url().startsWith(f.base) && r.status()>=400) errors.push(r.status()+' '+new URL(r.url()).pathname)})
    for (const route of routes.filter(r=>r.role===role)) {
      const path=route.path.replace(':id',lesson.id)
      errors.length=0
      try {
        await page.goto(url+path,{waitUntil:'domcontentloaded',timeout:60000})
        await page.waitForTimeout(1200)
        await expect(page.locator('body')).not.toHaveText('')
        const text=await page.locator('body').innerText()
        if (/Something went wrong|Cannot read properties/.test(text)) errors.push('Rendered error boundary')
        if (role && new URL(page.url()).pathname==='/login') errors.push('Unexpected login redirect')
        results.push({path,role:role??'public',status:errors.length?'FAIL':'PASS',errors:[...errors],buttons:await page.getByRole('button').count()})
      } catch(e) {results.push({path,role,status:'FAIL',errors:[String(e),...errors]})}
      console.log(results.at(-1).status,path,errors.join('; '))
    }
    await context.close()
  }
  const context=await browser.newContext()
  const page=await context.newPage()
  await page.goto(url+'/manager/students')
  await expect(page).toHaveURL(/\/login/)
  results.push({path:'unauthenticated manager guard',status:'PASS'})
  await page.goto(url+'/contact')
  await page.getByLabel('Your Name').fill('Browser Tester')
  await page.getByLabel('Email',{exact:true}).fill('browser@example.com')
  await page.getByLabel('Subject').fill('Admissions question')
  await page.locator('textarea').fill('Please send admissions information for this term.')
  await page.getByRole('button',{name:'Send Message'}).click()
  await expect(page.getByText('Thank you! Your message has been received.')).toBeVisible()
  if (await f.collection('contact_messages').countDocuments({email:'browser@example.com'})!==1) throw new Error('Contact did not persist')
  results.push({path:'contact form database persistence',status:'PASS'})
  for (const width of [390,768,1440]) {
    await page.setViewportSize({width,height:900})
    await page.screenshot({path:resolve(output,`contact-${width}.png`),fullPage:true})
    const overflow=await page.evaluate(()=>(globalThis as any).document.documentElement.scrollWidth>(globalThis as any).innerWidth)
    results.push({path:`contact responsive ${width}`,status:overflow?'FAIL':'PASS'})
  }
  await context.close()
} catch(error) {
  console.error(error)
  results.push({path:'browser interaction suite',status:'FAIL',errors:[String(error)]})
} finally {
  await browser?.close()
  vite.kill()
  await f.close()
  await writeFile(resolve(output,'browser-results.json'),JSON.stringify(results,null,2))
  await writeFile(resolve(output,'vite.log'),serverLog)
  const failed=results.filter(r=>r.status==='FAIL')
  console.log(`Browser checks: ${results.length-failed.length} passed, ${failed.length} failed`)
  if(failed.length) process.exitCode=1
}
