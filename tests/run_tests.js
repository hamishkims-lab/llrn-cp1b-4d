// LLRN CP1B 4D — 핵심 계산 자동 시험. 사용: node tests/run_tests.js
// GitHub에 올릴 때마다(Actions) 자동으로 돌고, 하나라도 틀리면 빌드가 실패로 표시됩니다.
const path=require('path'),R=p=>path.join(__dirname,'..',p);
require(R('importer.js'));const IMP=globalThis.LLRNImport;
const E=require(R('engine.js')),SIM=require(R('sim_core.js'));
const S0=require(R('data/SCHED0.json')),CFG=require(R('data/CFG.json')),ST=require(R('data/ST.json'));
const SAMPLE=require(R('samples/LLRN_CP1B_실적_예시_20271231.json'));
let fails=0;const ok=(name,cond,info)=>{console.log(`${cond?'PASS':'FAIL'}  ${name}${info?'  — '+info:''}`);if(!cond)fails++};
const leafOf=S=>S.tasks.filter(t=>!t.summary&&t.start&&t.finish&&String(t.name||'').trim());

// 1. 착공일 이동 (Rev.4): 2027-03-01, activity 전부 이동, 36개월 유지
const sh=E.shiftSchedule(S0,'2027-03-01',CFG.commence),S=sh.sched,L0=leafOf(S0),L=leafOf(S);
ok('착공일 이동: 모든 activity 이동',L.every((t,i)=>t.start!==L0[i].start),`${L.length}개, +${sh.delta}작업일`);
const fin=L.reduce((a,t)=>t.finish>a?t.finish:a,'').slice(0,10);
ok('착공일 이동: 계획 준공 = 착공 + 36개월',fin===E.addMonths('2027-03-01',36),fin);

// 2. 관계 계산 재현 (re3)
const cp=E.cpm(S.tasks,S.cal);
ok('CPM: re3 일정 재현 2,045/2,047 이상',cp.reproduced>=2045,`${cp.reproduced}/${cp.total}`);

// 3. 실적기반 공정표 (Rev.5)
const p0=E.progress(S.tasks,S.cal,{},'2026-12-31');
ok('실적 없음 → CPM과 같음',leafOf(S).every(t=>p0.byId[t.id].ef===cp.byId[t.id].ef)&&p0.finish===cp.finish,p0.finish);
const C=E.makeCal(S.cal,'2020-01-01','2035-01-01'),DD='2027-06-30',A={};
for(const t of L){const s=t.start.slice(0,10),f=t.finish.slice(0,10);if(s>DD)continue;
  if(f<=DD)A[t.uid]={as:s,af:f,pct:100};else{const done=C.idx('2027-07-01')-C.idx(s);A[t.uid]={as:s,af:null,pct:100*done/Math.max(1,+t.dur)}}}
const p1=E.progress(S.tasks,S.cal,A,DD);
ok('계획대로 입력 → 예상 완료 = 계획',L.every(t=>p1.byId[t.id].ef===cp.byId[t.id].ef),p1.finish);
const crit=L.filter(t=>A[t.uid]&&!A[t.uid].af&&p1.byId[t.id].crit),A2=JSON.parse(JSON.stringify(A));
for(const t of crit)A2[t.uid].pct=Math.max(0,A2[t.uid].pct-100*15/(+t.dur));
const p2=E.progress(S.tasks,S.cal,A2,DD);
ok('주공정 15작업일 지연 → 준공 15작업일 지연',C.idx(p2.finish)-C.idx(p1.finish)===15,`${p1.finish} → ${p2.finish}`);

// 4. 기준선 (Rev.5a): 실적으로 만든 Rev.1
const S1=E.shiftSchedule(S0,SAMPLE.contract.start,CFG.commence).sched,dd=SAMPLE.dataDate;
const rb=E.rebaseline(S1.tasks,S1.cal,SAMPLE.actuals,dd),c1=E.cpm(rb.tasks,S1.cal,dd);
ok('Rev.1 주공정 계산 재현 100%',c1.reproduced===c1.total,`${c1.reproduced}/${c1.total}, 준공 ${c1.finish}`);
const pr1=E.progress(rb.tasks,S1.cal,SAMPLE.actuals,dd);
ok('Rev.1 대비 지연 0',Object.values(pr1.byId).every(o=>o.dfin<=0),`예상 준공 ${pr1.finish}`);
const R3=E.compute(S1.tasks,CFG,ST,Date.UTC(2026,9,6));
ok('3D 구조물 연결: 빠진 항목 없음',R3.warn.length===0,R3.warn.slice(0,3).join(', '));

// 5. 가상 현장 회신 해석 (Rev.6): 31일, 복합 시나리오
const cat=SIM.catalog(S1.tasks,IMP.context(S1.tasks)),sim={seed:'ci',scenario:'all',truth:{},dayNo:0},AA=JSON.parse(JSON.stringify(SAMPLE.actuals));
for(const[u,a]of Object.entries(AA))sim.truth[u]={as:a.as,af:a.af,pct:a.af?100:+a.pct||0};
const st={num:{ok:0,n:0},free:{ok:0,n:0}};let D=dd,dateOk=true;const CC=E.makeCal(S1.cal,'2020-01-01','2036-12-31');
for(let k=0;k<31;k++){D=new Date(Date.parse(D)+864e5).toISOString().slice(0,10);
  const r=SIM.runDay({D,ENG:E,tasks:S1.tasks,cal:S1.cal,C:CC,actuals:AA,cat,sim});
  for(const m of r.msgs.filter(m=>m.kind==='reply')){if(SIM.reportDate(m.at)!==D)dateOk=false;
    const parsed=SIM.parseReply(m.text,sim.plans[m.chat][SIM.reportDate(m.at)],cat),sc=SIM.score(parsed,m.meta.truth);
    const b=/num/.test(SIM.CREW.find(c=>c.id===m.chat).style)?st.num:st.free;b.ok+=sc.ok;b.n+=sc.n;
    for(const p of parsed)if(p.uid&&p.conf>=0.8){const a=AA[p.uid]=AA[p.uid]||{as:D,af:null,pct:0};if(p.kind==='done'){a.af=D;a.pct=100}else if(p.kind==='pct')a.pct=p.pct}}
  for(const d of r.direct){const a=AA[d.uid]=AA[d.uid]||{as:d.as,af:null,pct:0};if(d.done){a.af=d.date;a.pct=100}else a.pct=d.pct}}
ok('회신 해석: 번호형 100%',st.num.ok===st.num.n,`${st.num.ok}/${st.num.n}`);
ok('회신 해석: 자유 문장 90% 이상',st.free.ok/st.free.n>=0.9,`${(100*st.free.ok/st.free.n).toFixed(1)}% (${st.free.ok}/${st.free.n})`);
ok('07:00 전 회신 = 전날 실적',dateOk);
const fx=[['P61 파일캡 완료, P62 코핑 50%',['done','pct']],['교각 62 coping 50 프로',['pct']]];
const plan=Object.values(cat).filter(c=>c.crew==='c2'&&c.loc&&/^P6[12]$/.test(c.loc.ko)).map(c=>({no:0,uid:c.uid}));
for(const[t,kinds]of fx){const r=SIM.parseReply(t,plan,cat);ok(`문장 해석: "${t}"`,r.length===kinds.length&&r.every((p,i)=>p.uid&&p.kind===kinds[i]),r.map(p=>p.uid&&cat[p.uid].label).join(' / '))}

console.log(fails?`\n${fails}개 실패`:'\n모두 통과');process.exit(fails?1:0);
