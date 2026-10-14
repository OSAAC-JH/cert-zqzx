const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const file=path.join(__dirname,'../증권자문_Copilot 모의고사05.html');
const html=fs.readFileSync(file,'utf8');
const raw=JSON.parse(html.match(/const RAW=([\s\S]*?);\nconst SUBJ=/)[1]);
const reviews=require('./mock05-review.json');
const before=require('./mock05-before.json');
const expected={1:{'경기분석':6,'기본적 분석':5,'기술적 분석':4,'유가증권시장':8,'코스닥시장':3,'채권시장':7,'기타 증권시장':2},2:{'금융상품분석·투자전략':13,'투자권유 및 고객관리':5,'직무윤리·투자자분쟁예방':12},3:{'자본시장 관련 법규':20,'한국금융투자협회 규정':4,'회사법':6,'증권세제':5}};
const unique=rows=>new Set(rows.map(r=>JSON.stringify([r[0],r[1],r[4],r[5]]))).size;
test('baseline reproduces 20 unique combinations and 80 dangling case references',()=>{assert.equal(before.length,100);assert.equal(unique(before),20);assert.equal(before.filter(r=>/다음 사례 \d/.test(r[3])).length,80)});
test('100 materially tagged questions, 100 distinct combinations and option sets',()=>{
 assert.equal(raw.length,100);assert.equal(unique(raw),100);
 assert.equal(new Set(raw.map(r=>JSON.stringify(r[4]))).size,100);
 assert.equal(new Set(raw.map(r=>r[3])).size,100);
 assert.equal(new Set(raw.map(r=>r[2])).size,100);
 assert.ok(raw.every(r=>!/다음 사례 \d/.test(r[3])));
});
test('official subject and subtopic allocation',()=>{
 for(const [s,chapters] of Object.entries(expected))for(const [ch,n] of Object.entries(chapters))assert.equal(raw.filter(r=>r[0]===+s&&r[1]===ch).length,n,`${s} ${ch}`);
 assert.deepEqual([1,2,3].map(s=>raw.filter(r=>r[0]===s).length),[35,30,35]);
});
test('valid answer indices, unique options, explanations and reviewed answer text',()=>{
 raw.forEach((r,i)=>{
  assert.equal(r.length,7);assert.equal(r[4].length,4);assert.equal(new Set(r[4]).size,4);
  assert.ok(Number.isInteger(r[5])&&r[5]>=0&&r[5]<4);
  assert.ok(r[6].trim().length>0,`explanation Q${i+1}`);
  assert.equal(reviews[i].id,i+1);assert.equal(r[4].filter(o=>o===reviews[i].correct).length,1);
  assert.equal(r[4][r[5]],reviews[i].correct);
  for(const match of r[3].matchAll(/\[\[BOX:(.*?)\]\]/g))assert.ok(match[1].length>=20);
  assert.equal((r[3].match(/\[\[/g)||[]).length,(r[3].match(/\]\]/g)||[]).length);
 });
});
// Independent arithmetic oracles: input values and operations, not the HTML's answer index.
const calculations={
 3:[(1430/1300-1)*100,10,'10%'],4:[5-3,2,'2%'],5:[20/(1-.8),100,'100억원'],
 7:[15*(1-.4),9,'9%'],8:[600/(.08-.02),10000,'10,000원'],
 9:[30000/2000,15,'PER 15배·PBR 3배'],10:[80+20-15,85,'85억원'],11:[90-1000*.1,-10,'-10억원'],
 13:[100-100/(1+3/1),75,'75'],15:[(110-80)/(120-80)*100,75,'75'],
 19:[(10000*10+10100*90)/100,10090,'10,090원'],20:[(12000*4+7000)/5,11000,'11,000원'],
 21:[50000/5,10000,'50주·10,000원'],27:[100/1.05,95.238095238,'95.24만원'],
 28:[-4*.005*100,-2,'-2%'],30:[99+1.5,100.5,'100.5만원'],
 34:[(10200-10000)/10000*100,2,'+2%'],36:[100*1.1**2,121,'121만원'],
 39:[(105-5)*1e8/1e9*1000,10000,'10,000원'],40:[1000000/20000,50,'50주'],
 42:[.6*8+.4*2,5.6,'5.6%'],44:[3+1.2*(9-3),10.2,'10.2%'],45:[(11-3)/20,.4,'0.4'],
 46:[80-(80+40)*.6,8,'주식 8 매도·채권 8 매수'],48:[(1.1*.95-1)*100,4.5,'4.5%'],
 90:[600*2/3,400,'출석 의결권 2/3에 미달하므로 불성립'],
 91:[1000/4,250,'총수 1/4에 미달해 불성립'],95:[100/1250*100,8,'8%'],
 96:[100*(1-.14-.014),84.6,'84만6,000원'],97:[1200-900-20,280,'280만원']
};
for(const [id,[actual,want,text]] of Object.entries(calculations))test(`Q${id} independent calculation`,()=>{assert.ok(Math.abs(actual-want)<1e-6);assert.equal(raw[id-1][4][raw[id-1][5]],text)});
const q=raw.map(r=>({s:r[0],a:r[5]}));
const scoreSource=html.match(/function score\(answers=saved\)\{[\s\S]*?\n\}/)[0];
const cleanSource=html.match(/function cleanAnswers\(value\)\{[\s\S]*?\n\}/)[0];
const context=vm.createContext({Q:q,SUBS:[1,2,3],saved:{},idxOf:s=>q.map((_,i)=>i).filter(i=>q[i].s===s)});
vm.runInContext(scoreSource+'\n'+cleanSource,context);
function answers(counts){const a={};[1,2,3].forEach((s,k)=>q.map((x,i)=>({x,i})).filter(t=>t.x.s===s).slice(0,counts[k]).forEach(t=>a[t.i]=t.x.a));return a;}
for(const [counts,pass] of [[[35,30,35],true],[[25,15,30],true],[[24,15,30],false],[[17,30,35],false],[[35,14,35],false],[[35,30,17],false],[[18,15,18],false],[[0,0,0],false]])test(`grade ${counts.join('/')} ${pass?'pass':'fail'}`,()=>{
 const a=answers(counts),r=context.score(a);assert.equal(r.pass,pass);assert.equal(r.c,counts.reduce((a,b)=>a+b,0));assert.equal(r.unanswered,100-r.c);
 assert.deepEqual(Array.from(r.subjects,t=>t.need),[18,15,18]);
});
test('malformed saved values are excluded without rewriting legacy storage',()=>{
 assert.equal(JSON.stringify(context.cleanAnswers({'0':1,'01':2,'-1':0,'100':0,'1':'2','2':4,'3':null})),JSON.stringify({'0':1}));
 assert.equal(JSON.stringify(context.cleanAnswers([])),'{}');
 assert.ok(!html.includes('setItem(OLD_KEY'));assert.ok(!html.includes('removeItem(OLD_KEY'));
});
test('homepage href remains existing filename',()=>{
 const index=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.ok([...index.matchAll(/href="([^"]+)"/g)].some(m=>decodeURIComponent(m[1])===path.basename(file)));
});
