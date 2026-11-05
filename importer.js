
/* LLRN CP1B schedule importer: MS Project XML (.xml) and Primavera P6 (.xer) -> normalized schedule
   + automatic matching of uploaded activities to the reference activities that drive the 3D model. */
(function(root){
const pad=n=>String(n).padStart(2,'0');
function decode(buf,prefer){
  const u8=new Uint8Array(buf);
  if(u8[0]===0xFF&&u8[1]===0xFE)return new TextDecoder('utf-16le').decode(u8);
  if(u8[0]===0xFE&&u8[1]===0xFF)return new TextDecoder('utf-16be').decode(u8);
  if(prefer){try{return new TextDecoder(prefer,{fatal:true}).decode(u8)}catch(e){}}
  try{return new TextDecoder('utf-8',{fatal:true}).decode(u8)}catch(e){return new TextDecoder('euc-kr').decode(u8)}}
/* ---------------- MS Project XML (MSPDI) ---------------- */
function parseMSPXML(text,file){
  const doc=new DOMParser().parseFromString(text,'application/xml');
  if(doc.getElementsByTagName('parsererror').length)throw new Error('XML 형식을 읽을 수 없습니다.');
  const P=doc.documentElement;if(P.localName!=='Project')throw new Error('MS Project XML 파일이 아닙니다 (Project 요소 없음).');
  const kids=(el,n)=>el?[...el.children].filter(c=>c.localName===n):[];
  const ch=(el,n)=>kids(el,n)[0]||null, tx=(el,n)=>{const c=ch(el,n);return c?c.textContent.trim():null};
  const mpd=+tx(P,'MinutesPerDay')||480;
  const dt=s=>s?s.slice(0,16):null;
  const hrs=s=>{if(!s)return 0;const m=s.match(/PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?/);return m?(+(m[1]||0))+(+(m[2]||0))/60+(+(m[3]||0))/3600:0};
  // calendars (with base-calendar inheritance)
  const CAL={};
  for(const c of kids(ch(P,'Calendars'),'Calendar')){
    const wk=Array(7).fill(null),ex=[];
    for(const w of kids(ch(c,'WeekDays'),'WeekDay')){const t=+tx(w,'DayType'),on=tx(w,'DayWorking')==='1';
      if(t>=1&&t<=7)wk[t-1]=on;else if(t===0){const tp=ch(w,'TimePeriod');if(tp)ex.push({from:tx(tp,'FromDate').slice(0,10),to:tx(tp,'ToDate').slice(0,10),working:on})}}
    for(const e of kids(ch(c,'Exceptions'),'Exception')){const tp=ch(e,'TimePeriod');if(!tp)continue;
      ex.push({from:tx(tp,'FromDate').slice(0,10),to:tx(tp,'ToDate').slice(0,10),working:tx(e,'DayWorking')==='1',name:tx(e,'Name')||''})}
    CAL[tx(c,'UID')]={name:tx(c,'Name')||'',base:tx(c,'BaseCalendarUID'),wk,ex}}
  const resolve=uid=>{const c=CAL[uid];if(!c)return null;const b=c.base&&c.base!=='-1'?resolve(c.base):null;
    return{name:c.name,work:c.wk.map((v,i)=>v!=null?v:(b?b.work[i]:(i>0&&i<6))),exceptions:[...(b?b.exceptions:[]),...c.ex]}};
  const cal=resolve(tx(P,'CalendarUID'))||{name:'(기본)',work:[false,true,true,true,true,true,false],exceptions:[]};
  cal.hpd=mpd/60;
  const TY={'0':'FF','1':'FS','2':'SF','3':'SS'};
  const tasks=[];let nRel=0,taskCals=new Set();
  for(const t of kids(ch(P,'Tasks'),'Task')){
    if(tx(t,'IsNull')==='1')continue;const name=tx(t,'Name');
    const cu=tx(t,'CalendarUID');if(cu&&cu!=='-1'&&cu!==tx(P,'CalendarUID'))taskCals.add(cu);
    const preds=kids(t,'PredecessorLink').map(l=>{nRel++;const lf=+(tx(l,'LagFormat')||7);const lag=+(tx(l,'LinkLag')||0)/10;
      return[tx(l,'PredecessorUID'),TY[tx(l,'Type')]||'FS',(lf===19||lf===20)?0:lag/mpd]});   // percent lags ignored
    const ts=tx(t,'TotalSlack');
    tasks.push({id:+tx(t,'ID'),uid:tx(t,'UID'),lvl:+(tx(t,'OutlineLevel')||0),wbs:tx(t,'WBS'),name,summary:tx(t,'Summary')==='1',
      start:dt(tx(t,'Start')),finish:dt(tx(t,'Finish')),dur:hrs(tx(t,'Duration'))*60/mpd,milestone:tx(t,'Milestone')==='1',preds,
      crit:tx(t,'Critical')==null?null:tx(t,'Critical')==='1',tf:ts==null?null:+ts/10/mpd,
      bs:dt(tx(t,'BaselineStart')||((ch(t,'Baseline')&&tx(ch(t,'Baseline'),'Start'))||null)),as:dt(tx(t,'ActualStart')),af:dt(tx(t,'ActualFinish')),pct:+(tx(t,'PercentComplete')||0)})}
  tasks.sort((a,b)=>a.id-b.id);
  return finish({format:'MS Project XML',file,name:tx(P,'Title')||tx(P,'Name')||file,status:dt(tx(P,'StatusDate')),nRel,taskCals:taskCals.size},cal,tasks);
}
/* ---------------- Primavera P6 XER ---------------- */
function parseXER(text,file){
  if(!/^ERMHDR/m.test(text)&&!/^%T/m.test(text))throw new Error('XER 파일 형식이 아닙니다.');
  const TB={};let cur=null,f=null;
  for(const line of text.split(/\r?\n/)){
    if(line.startsWith('%T\t')){cur=line.slice(3).trim();TB[cur]=[];f=null}
    else if(line.startsWith('%F\t'))f=line.slice(3).split('\t');
    else if(line.startsWith('%R\t')&&cur&&f){const v=line.slice(3).split('\t');const o={};f.forEach((k,i)=>o[k]=v[i]??'');TB[cur].push(o)}}
  const need=['PROJECT','TASK'];for(const n of need)if(!TB[n])throw new Error(`XER에 ${n} 표가 없습니다.`);
  const proj=TB.PROJECT.map(p=>({p,n:TB.TASK.filter(t=>t.proj_id===p.proj_id).length})).sort((a,b)=>b.n-a.n)[0].p;
  const pid=proj.proj_id;
  const dt=s=>s?s.replace(' ','T').slice(0,16):null;
  // calendar
  const cals=(TB.CALENDAR||[]);const cRow=cals.find(c=>c.clndr_id===proj.clndr_id)||cals.find(c=>c.default_flag==='Y')||cals[0];
  const parseCal=c=>{if(!c)return{name:'(기본)',work:[false,true,true,true,true,true,false],exceptions:[],hpd:8};
    const d=c.clndr_data||'';const work=[];const dw=d.indexOf('DaysOfWeek'),exi=d.indexOf('Exceptions');const sec=d.slice(dw,exi>0?exi:undefined);
    for(let k=1;k<=7;k++){const i=sec.indexOf(`(0||${k}()(`);work.push(i>=0?sec[i+`(0||${k}()(`.length]==='(':(k>1&&k<7))}
    const exceptions=[];if(exi>0){const es=d.slice(exi);for(const m of es.matchAll(/\(d\|(\d+)\)\((\(?)/g)){const day=new Date(Date.UTC(1899,11,30)+(+m[1])*864e5).toISOString().slice(0,10);exceptions.push({from:day,to:day,working:m[2]==='('})}}
    return{name:c.clndr_name||'',work,exceptions,hpd:+c.day_hr_cnt||8}};
  const cal=parseCal(cRow);const hpdOf={};for(const c of cals)hpdOf[c.clndr_id]=+c.day_hr_cnt||8;
  // WBS tree -> outline
  const W=(TB.PROJWBS||[]).filter(w=>w.proj_id===pid);const kidsW={};let rootW=null;
  for(const w of W){if(w.proj_node_flag==='Y')rootW=w;(kidsW[w.parent_wbs_id]=kidsW[w.parent_wbs_id]||[]).push(w)}
  const TK=TB.TASK.filter(t=>t.proj_id===pid);const tByW={};for(const t of TK)(tByW[t.wbs_id]=tByW[t.wbs_id]||[]).push(t);
  const TY={PR_FS:'FS',PR_SS:'SS',PR_FF:'FF',PR_SF:'SF'};const preds={};let nRel=0;
  for(const r of TB.TASKPRED||[]){if(r.proj_id&&r.proj_id!==pid)continue;nRel++;(preds[r.task_id]=preds[r.task_id]||[]).push([r.pred_task_id,TY[r.pred_type]||'FS',(+r.lag_hr_cnt||0)/cal.hpd])}
  const out=[];let id=0;const taskCals=new Set();
  const emitTask=(t,lvl)=>{const h=hpdOf[t.clndr_id]||cal.hpd;if(t.clndr_id&&cRow&&t.clndr_id!==cRow.clndr_id)taskCals.add(t.clndr_id);
    const ms=/Mile/.test(t.task_type),tf=t.total_float_hr_cnt===''?null:+t.total_float_hr_cnt/h;
    out.push({id:++id,uid:t.task_id,lvl,wbs:t.task_code,name:t.task_name,summary:false,
      start:dt(t.act_start_date||t.early_start_date||t.target_start_date||t.restart_date),finish:dt(t.act_end_date||t.early_end_date||t.target_end_date||t.reend_date),
      dur:(+t.target_drtn_hr_cnt||0)/h,milestone:ms,preds:preds[t.task_id]||[],crit:tf==null?null:tf<=0,tf,
      as:dt(t.act_start_date),af:dt(t.act_end_date),bs:null})};
  const walk=(w,lvl)=>{const me={id:++id,uid:'W'+w.wbs_id,lvl,wbs:w.wbs_short_name,name:w.wbs_name||w.wbs_short_name,summary:true,preds:[],dur:0};out.push(me);
    const ts=(tByW[w.wbs_id]||[]).slice().sort((a,b)=>(dt(a.early_start_date||a.target_start_date)||'').localeCompare(dt(b.early_start_date||b.target_start_date)||'')||a.task_code.localeCompare(b.task_code));
    for(const t of ts)emitTask(t,lvl+1);
    for(const c of (kidsW[w.wbs_id]||[]).slice().sort((a,b)=>(+a.seq_num||0)-(+b.seq_num||0)||String(a.wbs_short_name).localeCompare(b.wbs_short_name)))walk(c,lvl+1)};
  if(rootW)walk(rootW,0);else{out.push({id:++id,uid:'P'+pid,lvl:0,name:proj.proj_short_name,summary:true,preds:[],dur:0});for(const t of TK)emitTask(t,1)}
  // roll up summary dates
  for(let i=out.length-1;i>=0;i--){const s=out[i];if(!s.summary)continue;let a=null,b=null;
    for(let j=i+1;j<out.length&&out[j].lvl>s.lvl;j++){const t=out[j];if(t.start&&(!a||t.start<a))a=t.start;if(t.finish&&(!b||t.finish>b))b=t.finish}s.start=a;s.finish=b}
  const tasks=out.filter(t=>!t.summary||t.start);
  return finish({format:'Primavera P6 XER',file,name:proj.proj_short_name||file,status:dt(proj.last_recalc_date),nRel,taskCals:taskCals.size},cal,tasks);
}
function finish(meta,cal,tasks){
  const leaves=tasks.filter(t=>!t.summary&&t.start&&t.finish&&t.name&&String(t.name).trim());
  if(!leaves.length)throw new Error('일정이 있는 activity가 없습니다.');
  meta.tasks=leaves.length;meta.start=leaves.reduce((a,t)=>t.start<a?t.start:a,'9999').slice(0,10);meta.finish=leaves.reduce((a,t)=>t.finish>a?t.finish:a,'0000').slice(0,10);
  meta.fileCrit=leaves.filter(t=>t.crit).length;
  return{meta,cal,tasks}}
async function readFile(file){
  const buf=await file.arrayBuffer();const n=file.name.toLowerCase();
  if(n.endsWith('.xer'))return parseXER(decode(buf),file.name);
  if(n.endsWith('.xml')){let t=decode(buf);const m=t.slice(0,200).match(/encoding="([^"]+)"/i);if(m&&!/utf-?8/i.test(m[1]))t=decode(buf,m[1]);return parseMSPXML(t,file.name)}
  if(n.endsWith('.mpp'))throw new Error('MS Project 원본(.mpp)은 브라우저에서 직접 읽을 수 없습니다. MS Project에서 [파일 → 다른 이름으로 저장 → XML 형식(*.xml)]으로 저장한 뒤 올려 주세요.');
  throw new Error('지원 형식: MS Project XML(.xml), Primavera P6(.xer)');
}
/* ---------------- automatic matching ---------------- */
const norm=s=>String(s||'').toLowerCase().normalize('NFKC').replace(/[\s\-_.,()\[\]\/&·:;'"~+]+/g,'');
function bigr(s){const m=new Map();if(s.length<2){m.set(s,1);return m}for(let i=0;i<s.length-1;i++){const g=s.slice(i,i+2);m.set(g,(m.get(g)||0)+1)}return m}
function dice(a,b){a=norm(a);b=norm(b);if(!a||!b)return 0;if(a===b)return 1;const A=bigr(a),B=bigr(b);let x=0,na=0,nb=0;for(const v of A.values())na+=v;for(const v of B.values())nb+=v;for(const[g,v]of A)x+=Math.min(v,B.get(g)||0);return 2*x/(na+nb)}
function context(tasks){const stack=[],path={},sib={},kids={};
  for(const t of tasks){stack[t.lvl]=t;stack.length=t.lvl+1;const anc=stack.slice(1,t.lvl).filter(Boolean);path[t.id]=anc.map(a=>String(a.name||'').trim());
    const p=anc.length?anc[anc.length-1].id:0;(kids[p]=kids[p]||[]);if(!t.summary)kids[p].push(t.id);sib[t.id]=[p,kids[p].length-1]}
  return{path,sib}}
function autoMatch(refs,refTasks,tasks){
  const rc=context(refTasks),uc=context(tasks);
  const prep=s=>{const n=norm(s);const m=bigr(n);let c=0;for(const v of m.values())c+=v;return{n,m,c}};
  const dm=(a,b)=>{if(!a.n||!b.n)return 0;if(a.n===b.n)return 1;let x=0;for(const[g,v]of a.m)x+=Math.min(v,b.m.get(g)||0);return 2*x/(a.c+b.c)};
  const cache=new Map();const P=s=>{s=String(s||'');let v=cache.get(s);if(!v){v=prep(s);cache.set(s,v)}return v};
  // candidates: every named activity with dates (summaries too: a reference can be a summary such as "PIER 12")
  const cand=tasks.filter(t=>t.lvl>0&&t.start&&t.finish&&t.name&&String(t.name).trim()).map(t=>{const p=uc.path[t.id]||[];
    return{t,nm:P(t.name),p1:P(p[p.length-1]),p2:P(p[p.length-2]),sib:uc.sib[t.id]?uc.sib[t.id][1]:-1}});
  const fast=new Map();for(const c of cand)fast.set(String(c.t.uid)+'|'+c.nm.n+'|'+c.p1.n,c);
  const map={},score={},used=new Set(),rest=[];
  for(const r of refs){const rp=r.path,k=String(r.uid)+'|'+P(r.name).n+'|'+P(rp[rp.length-1]).n,c=fast.get(k);
    if(c&&!used.has(c.t.id)){map[r.ref]=c.t.id;score[r.ref]=1;used.add(c.t.id)}else rest.push(r)}
  const pairs=[];
  for(const r of rest){const rp=r.path,rn=P(r.name),rpar=P(rp[rp.length-1]),rpar2=P(rp[rp.length-2]),rsib=rc.sib[r.ref]?rc.sib[r.ref][1]:-1;
    for(const c of cand){if(used.has(c.t.id))continue;const ns=dm(rn,c.nm);if(ns<0.35)continue;
      const ps=Math.max(dm(rpar,c.p1),dm(rpar,c.p2)),ps2=dm(rpar2,c.p2);
      let s=0.5*ns+0.3*ps+0.05*ps2+(rn.n===c.nm.n?0.05:0)+(r.wbs&&r.wbs===c.t.wbs?0.05:0)+(c.sib===rsib?0.05:0);
      if(String(r.uid)===String(c.t.uid)&&ns>0.7)s+=0.1;
      if(s>=0.55)pairs.push([Math.min(1,s),r.ref,c.t.id])}}
  pairs.sort((a,b)=>b[0]-a[0]);
  for(const[s,r,c]of pairs){if(r in map||used.has(c))continue;map[r]=c;score[r]=s;used.add(c)}
  for(const r of refs)if(!(r.ref in map)){map[r.ref]=null;score[r.ref]=0}
  return{map,score}}
function remapCfg(cfg,map){const m=id=>id==null?null:(id in map?map[id]:null);const c=JSON.parse(JSON.stringify(cfg));
  for(const B of c.bridges){B.pile=B.pile.map(([i,w])=>[m(i),w]);B.pier=m(B.pier);if(B.girder!=null)B.girder=m(B.girder);B.deck=m(B.deck)}
  c.voided.task=m(c.voided.task);c.pave.task=m(c.pave.task);c.trestle.segs.forEach(s=>{if('task' in s)s.task=m(s.task)});c.trestle.dismantle=m(c.trestle.dismantle);
  for(const z of Object.values(c.zones))for(const k of Object.keys(z))z[k]=z[k].map(m);c.commence=m(c.commence);
  if(c.trestle.ranges)c.trestle.ranges.forEach(r=>r.task=m(r.task));
  if(c.direct)for(const g of [c.direct.sup,c.direct.span])for(const d of Object.values(g))for(const k of Object.keys(d))d[k]=d[k].map(m);
  return c}
root.LLRNImport={readFile,parseMSPXML,parseXER,autoMatch,remapCfg,dice,context};
})(typeof window!=='undefined'?window:globalThis);

