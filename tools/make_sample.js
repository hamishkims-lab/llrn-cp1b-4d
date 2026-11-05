// 시험용 예시 실적 파일 만들기: 착공 2027-03-01, 기준일 2027-12-31.
// 기준일까지 계획대로 채운 뒤 세 가지 상황을 넣는다 — (1) 주공정(본선 하부공)의 최근 20작업일 분량이 아직 끝나지 않음, (2) Sucat Slip Road 성토 작업이 15작업일 늦게 끝남,
// (3) 일부 Bored pile이 10작업일 일찍 끝남. 사용: node tools/make_sample.js <출력 경로>
require('../importer.js');const IMP=globalThis.LLRNImport;const E=require('../engine.js');
const S0=require('../data/SCHED0.json'),CFG=require('../data/CFG.json');
const START='2027-03-01',DD='2027-12-31';
const S=E.shiftSchedule(S0,START,CFG.commence).sched,ctx=IMP.context(S.tasks),C=E.makeCal(S.cal,'2026-01-01','2033-01-01');
const nd=d=>new Date(E.tms(d)+864e5).toISOString().slice(0,10);
const A={},log=[];const at='2028-01-02T09:00:00.000Z';
const L=S.tasks.filter(t=>!t.summary&&t.start&&t.finish&&String(t.name||'').trim());
for(const t of L){const s=t.start.slice(0,10),f=t.finish.slice(0,10);if(s>DD)continue;
  if(f<=DD)A[t.uid]={as:s,af:f,pct:100};else{const done=C.idx(nd(DD))-C.idx(s);A[t.uid]={as:s,af:null,pct:Math.min(99,Math.round(100*done/Math.max(1,+t.dur||1)))}}}
const path=t=>(ctx.path[t.id]||[]).join(' > ');
let n1=0,n2=0,n3=0;
const cp=E.cpm(S.tasks,S.cal);
for(const t of [...L].sort((x,y)=>y.start.localeCompare(x.start))){const a=A[t.uid];if(!a)continue;const p=path(t);
  // (1) critical path (main-road substructure): the last 20 working days of planned work are not done yet
  if(cp.byId[t.id].crit&&C.idx(t.finish.slice(0,10))>C.idx(DD)-20){
    if(a.af){a.af=null;a.pct=Math.max(10,Math.round(100*(1-20/Math.max(1,+t.dur))))}else delete A[t.uid];n1++}
  // (2) Sucat Slip Road earthwork finished 15 working days late
  else if(/Sucat Slip Road/.test(p)&&a.af){const f=C.date(C.idx(a.af)+15);if(f<=DD)a.af=f;else{a.af=null;a.pct=90}n2++}
  // (3) some bored piles finished 10 working days early (every third one)
  else if(/bored pile/i.test(t.name+' '+p)&&a.af&&t.id%3===0){a.af=C.date(Math.max(C.idx(a.as),C.idx(a.af)-10));n3++}}
for(const[u,a]of Object.entries(A)){a.by='예시';a.at=at;log.push({at,dd:DD,uid:+u,f:'sample',from:null,to:JSON.stringify(a)})}
const P=E.progress(S.tasks,S.cal,A,DD);
const c=E.curve(S.tasks,P,DD,[E.tms(DD)+864e5])[0];
const prj={format:'llrn-4d-project',ver:1,project:'LLRN CP1B',created:at,dataDate:DD,actuals:A,log,
  snapshots:[{dataDate:DD,at,plan:+c.plan.toFixed(2),act:+c.act.toFixed(2),finish:P.finish,...P.count,late:Object.values(P.byId).filter(o=>o.state!=='done'&&o.dfin>0).length}],
  contract:{start:START,months:null},baseline:{name:S0.meta.name,file:S0.meta.file,custom:false},note:'시험용 예시 실적 (tools/make_sample.js)'};
require('fs').writeFileSync(process.argv[2]||'sample.json',JSON.stringify(prj));
console.log({actuals:Object.keys(A).length,critBehind:n1,sucatLate:n2,pilesEarly:n3,count:P.count,plan:c.plan.toFixed(1),act:c.act.toFixed(1),forecast:P.finish});
