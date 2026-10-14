const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium,firefox,webkit}=require('playwright');
const root=path.resolve(__dirname,'..');
const filename='증권자문_Copilot 모의고사05.html';
const html=fs.readFileSync(path.join(root,filename),'utf8');
const raw=JSON.parse(html.match(/const RAW=([\s\S]*?);\nconst SUBJ=/)[1]);
const legacy=JSON.stringify({'0':1,'35':2,'99':3});
const server=http.createServer((req,res)=>{try{const p=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!p.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(p));}catch{res.writeHead(404);res.end();}});
const reports=[];
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 for(const [name,type] of Object.entries({chromium,firefox,webkit}).filter(([name])=>!process.env.MOCK05_BROWSERS||process.env.MOCK05_BROWSERS.split(',').includes(name))){
  const browser=await type.launch({headless:true,...(name==='chromium'&&process.env.MOCK05_CHROMIUM_PATH?{executablePath:process.env.MOCK05_CHROMIUM_PATH}:{})});
  try{
   for(const viewport of [{width:1280,height:900},{width:390,height:844},{width:320,height:640}]){
    const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/index.html');
    await page.evaluate(v=>localStorage.setItem('secAdviceMock05',v),legacy);
    await page.locator(`a[href="${encodeURIComponent(filename)}"]`).click();
    assert.equal(await page.locator('.qcard').count(),100);
    assert.equal(await page.locator('.qcard:visible').count(),100);
    assert.match(await page.locator('#legacyRecords').textContent(),/개정 전 풀이 3\/100/);
    assert.equal(await page.locator('#q0 .explain.show').count(),0);
    await page.locator('#wrongBtn').click();assert.equal(await page.locator('.qcard:visible').count(),0);
    assert.ok(await page.locator('#empty').isVisible());await page.locator('#wrongBtn').click();
    await page.locator('#expBtn').click();assert.equal(await page.locator('.explain.show').count(),100);
    assert.equal(await page.evaluate(()=>score().a),0);await page.locator('#expBtn').click();
    const bad=(raw[0][5]+1)%4;await page.locator(`#q0 .opt[data-j="${bad}"]`).click();
    assert.equal(await page.locator('#q0 .opt:disabled').count(),4);
    assert.equal(await page.locator('#q0 .explain.show').count(),1);
    assert.match(await page.locator('#q0 .result').textContent(),/오답/);
    await page.reload();assert.equal(await page.locator('#q0 .opt.wrong').count(),1);
    await page.locator('#wrongBtn').click();assert.equal(await page.locator('.qcard:visible').count(),1);
    await page.locator('[data-f="2"]').click();assert.equal(await page.locator('.qcard:visible').count(),0);
    await page.locator('#wrongBtn').click();assert.equal(await page.locator('.qcard:visible').count(),30);
    assert.equal(await page.locator('[data-f="2"]').getAttribute('aria-pressed'),'true');
    await page.locator('[data-f="all"]').click();
    await page.locator('#gradeBtn').click();assert.match(await page.locator('#gradeBox').textContent(),/불합격/);
    assert.match(await page.locator('#gradeBox').textContent(),/미풀이 99/);
    await page.locator('#gradeBox [data-go="0"]').click();assert.ok(await page.locator('#q0').isVisible());
    const oldTheme=await page.locator('html').getAttribute('data-theme');await page.locator('#theme').click();await page.reload();assert.notEqual(await page.locator('html').getAttribute('data-theme'),oldTheme);
    // All 100 DOM answer handlers, not direct assignment to saved.
    await page.evaluate(()=>{saved={};Q.forEach((_,i)=>paint(i));document.querySelectorAll('.qcard').forEach((card,i)=>card.querySelector(`[data-j="${Q[i].a}"]`).click());});
    await page.locator('#gradeBtn').click();assert.match(await page.locator('#gradeBox').textContent(),/100점/);assert.match(await page.locator('.verdict').textContent(),/^합격$/);
    await page.reload();assert.equal(await page.evaluate(()=>score().c),100);
    page.once('dialog',d=>d.dismiss());await page.locator('#resetBtn').click();assert.equal(await page.evaluate(()=>score().a),100);
    page.once('dialog',d=>d.accept());await page.locator('#resetBtn').click();assert.equal(await page.evaluate(()=>score().a),0);
    assert.equal(await page.evaluate(()=>localStorage.getItem('secAdviceMock05')),legacy);
    await page.locator('#gradeBtn').click();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} ${viewport.width} horizontal overflow`);
    if(name==='chromium')await page.screenshot({path:path.join(require('node:os').tmpdir(),`mock05-${viewport.width}.png`),fullPage:false});
    await page.evaluate(()=>localStorage.setItem('secAdviceMock05-v2','not json'));await page.reload();assert.equal(await page.evaluate(()=>score().a),0);assert.match(await page.locator('#storageNotice').textContent(),/읽을 수 없습니다/);assert.equal(await page.locator('.qcard').count(),100);
    assert.deepEqual(errors,[]);
    reports.push(`${name} ${viewport.width}×${viewport.height}: PASS`);console.log(reports.at(-1));await context.close();
   }
   // Storage unavailable: live answers still work, visible notice, no uncaught error.
   const context=await browser.newContext();await context.addInitScript(()=>{Storage.prototype.getItem=function(){throw new DOMException('blocked','SecurityError')};Storage.prototype.setItem=function(){throw new DOMException('blocked','SecurityError')};Storage.prototype.removeItem=function(){throw new DOMException('blocked','SecurityError')};});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/'+encodeURIComponent(filename));await page.locator('#q0 .opt').first().click();assert.equal(await page.evaluate(()=>score().a),1);assert.match(await page.locator('#storageNotice').textContent(),/저장.*차단/);assert.deepEqual(errors,[]);await context.close();console.log(`${name} blocked storage: PASS`);reports.push(`${name} blocked storage: PASS`);
  }finally{await browser.close();}
 }
 fs.writeFileSync(path.join(root,'tests/browser-results.txt'),reports.join('\n')+'\n');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());
