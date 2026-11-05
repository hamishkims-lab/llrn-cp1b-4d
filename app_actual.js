// ======================= 1단계 (Rev.5): 실적 · 실적기반 공정표 · 데이터 파일 =======================
// Actuals sit on leaf activities by unique ID (uid), so they survive a re-imported or shifted schedule.
// The project data file holds: data date, actuals, change log (변경분), daily snapshots, contract settings and the
// baseline (only an uploaded baseline is stored; re3 is built in). Earlier saves are kept in a history folder.
const PFILE='LLRN_CP1B_실적.json',PFMT='llrn-4d-project';
const pfile=()=>PRJ.sim&&PRJ.sim.on?'LLRN_CP1B_가상현장.json':PFILE;   // virtual-site runs never overwrite the real actuals file
const newPrj=()=>({format:PFMT,ver:1,project:'LLRN CP1B',created:new Date().toISOString(),dataDate:null,actuals:{},log:[],snapshots:[]});
let PRJ=newPrj(),DIRH=null,FINFO=null,DIRTY=0,recalcT=null,actPage=200;
// inside another page (e.g. a Notion embed) the browser blocks file pickers, so saving falls back to download/open
const EMBED=(()=>{try{return window.self!==window.top}catch(e){return true}})();
const FSA='showDirectoryPicker' in window&&!EMBED;
if(EMBED){const a=$('embedAlert');if(a){a.hidden=false;const l=document.getElementById('embedOpen');if(l)l.href=location.href}}
// ---------- IndexedDB: working draft + folder handle (survive a page reload) ----------
function idb(){return new Promise((ok,no)=>{const r=indexedDB.open('llrn4d',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
async function kv(k,v){try{const d=await idb();return await new Promise((ok,no)=>{const tx=d.transaction('kv',v===undefined?'readonly':'readwrite'),s=tx.objectStore('kv');const q=v===undefined?s.get(k):v===null?s.delete(k):s.put(v,k);q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)})}catch(e){return undefined}}
const noCache=(k,v)=>k&&k[0]==='_'?undefined:v;
let draftT=null;function saveDraft(){clearTimeout(draftT);draftT=setTimeout(()=>kv('draft',{prj:JSON.parse(JSON.stringify(PRJ,noCache)),dirty:DIRTY,finfo:FINFO}),400)}
// ---------- helpers ----------
const nowIso=()=>new Date().toISOString();
const siteToday=()=>new Date(Date.now()+8*36e5).toISOString().slice(0,10);   // site time UTC+8, whatever the PC clock zone
const dotS=d=>d?d.slice(2).replace(/-/g,'.'):'';
const hasAct=()=>!!PRJ.dataDate;
function fileMsg(html,kind,buttons){const el=$('fileMsg');if(!html){el.hidden=true;return}el.hidden=false;el.className='fmsg '+(kind||'');
  el.innerHTML=`<span>${html}</span>`+(buttons||[]).map((b,i)=>`<button class="btn" type="button" data-i="${i}">${b[0]}</button>`).join('');
  el.querySelectorAll('button').forEach(x=>x.addEventListener('click',()=>buttons[+x.dataset.i][1]()))}
function fileStatus(){const f=$('fileState');
  const where=DIRH?`폴더 <b>${esc(DIRH.name)}</b> · ${pfile()}`:FSA?'폴더 연결 안 됨 (브라우저에만 임시 저장)':EMBED?'다른 페이지 안에서 열려 있어 [내려받기]로 저장하고 [파일 열기]로 불러옵니다 — 폴더 저장은 새 창에서':'이 브라우저는 폴더 직접 저장을 지원하지 않아 내려받기로 저장합니다';
  const saved=FINFO&&FINFO.opened?` · 불러온 파일 ${esc(FINFO.opened)}`:FINFO&&FINFO.at?` · 마지막 저장 ${new Date(FINFO.at).toLocaleString('ko-KR',{hour12:false})}`:'';
  f.innerHTML=where+saved+(DIRTY?` · <span class="dirty">저장 안 된 변경 ${DIRTY}건</span>`:'');
  $('fSave').disabled=!hasAct();$('fDown').disabled=!hasAct();$('fConnect').textContent=DIRH?'다른 폴더':'폴더 연결'}
function touched(n){DIRTY+=n||1;fileStatus();saveDraft()}
// ---------- project <-> file ----------
function buildFile(){const custom=!!MAP;
  return {...PRJ,format:PFMT,ver:1,savedAt:nowIso(),contract:{start:CON.start||null,months:CON.months||null},
    baseline:{name:(SCHED.meta&&SCHED.meta.name)||'',file:(SCHED.meta&&SCHED.meta.file)||'',custom,sched:custom?BASE:undefined,map:custom?MAP:undefined}}}
function checkFile(o){if(!o||o.format!==PFMT)throw new Error('LLRN 4D 공정관리 데이터 파일이 아닙니다.');if(typeof o.actuals!=='object')throw new Error('실적 항목이 없습니다.');return o}
// a file brings its own baseline and contract settings, so another PC shows the same screen
function loadPrj(o,src){checkFile(o);
  PRJ={...newPrj(),...o,actuals:o.actuals||{},log:o.log||[],snapshots:o.snapshots||[]};delete PRJ.baseline;delete PRJ.contract;delete PRJ.savedAt;
  CON={};if(o.contract){if(o.contract.start)CON.start=o.contract.start;if(o.contract.months)CON.months=o.contract.months}
  try{localStorage.setItem(CKEY,JSON.stringify(CON))}catch(e){}
  if(!PRJ.baselines||!PRJ.baselines.length){const ob=o.baseline||{};
    PRJ.baselines=[{id:'R0',rev:0,name:'Rev.0 최초 계획',source:ob.file||'General Schedule re3',created:o.created||nowIso(),builtin:!(ob.custom&&ob.sched),sched:ob.custom?ob.sched:undefined,map:ob.custom?ob.map:null,start:CON.start||null,status:'승인'}];PRJ.active='R0';PRJ.cmp='R0'}
  activateBaseline(PRJ.active||'R0',true)
  DIRTY=0;$('dataDate').value=PRJ.dataDate||'';fileStatus();saveDraft();
  if(PRJ.dataDate){setMode(MODE==='plan'?'cmp':MODE);setT(MS(PRJ.dataDate))}
  fileMsg(`${esc(src)}을(를) 불러왔습니다 — 기준일 ${PRJ.dataDate?dot(PRJ.dataDate):'없음'}, 실적 ${Object.keys(PRJ.actuals).length.toLocaleString()}건.`,'ok')}
async function writeText(dir,name,text){const fh=await dir.getFileHandle(name,{create:true});const w=await fh.createWritable();await w.write(text);await w.close();return fh}
const stamp=ms=>{const d=new Date(ms+8*36e5).toISOString();return d.slice(0,10).replace(/-/g,'')+'-'+d.slice(11,16).replace(':','')};
async function perm(h){let p=await h.queryPermission({mode:'readwrite'});if(p!=='granted')p=await h.requestPermission({mode:'readwrite'});return p==='granted'}
function takeSnapshot(){if(!PROG)return;const dd=PRJ.dataDate,t=MS(dd)+DAY;const c=ENG.curve(SCHED.tasks,PROG,dd,[t])[0];
  const late=Object.values(PROG.byId).filter(o=>o.state!=='done'&&o.dfin>0).length;
  const cm=cmpData(),pc=ENG.curve(cm.sched.tasks,null,dd,[t],cm.frozen)[0];
  const s={dataDate:dd,at:nowIso(),active:PRJ.active,cmp:cm.id,plan:+pc.plan.toFixed(2),act:+c.act.toFixed(2),finish:PROG.finish,...PROG.count,late};
  PRJ.snapshots=PRJ.snapshots.filter(x=>x.dataDate!==dd).concat([s]).sort((a,b)=>a.dataDate.localeCompare(b.dataDate))}
async function saveProject(force){if(!hasAct()){fileMsg('기준일을 먼저 정해 주세요.','warn');return}
  takeSnapshot();const text=JSON.stringify(buildFile(),noCache);
  if(!DIRH){if(FSA){fileMsg('저장할 폴더를 먼저 연결해 주세요. 다른 PC로 옮길 때는 [내려받기]를 써도 됩니다.','warn',[['폴더 연결',connectFolder],['내려받기',()=>downloadPrj()]]);return}
    downloadPrj(text);return}
  try{if(!await perm(DIRH))throw new Error('폴더 쓰기 권한이 없습니다.');
    const fh=await DIRH.getFileHandle(pfile(),{create:true}),old=await fh.getFile();
    // someone else (or another PC through sync) changed the file after we read it
    if(!force&&old.size&&FINFO&&FINFO.lm&&old.lastModified!==FINFO.lm){
      fileMsg(`폴더의 ${pfile()}이(가) 마지막으로 읽은 뒤 바뀌었습니다 (${new Date(old.lastModified).toLocaleString('ko-KR',{hour12:false})}). 덮어쓰면 그 변경이 사라집니다.`,'warn',
        [['파일 내용 불러오기',()=>readFolderFile(true)],['내 내용으로 덮어쓰기',()=>saveProject(true)]]);return}
    if(old.size){const hd=await DIRH.getDirectoryHandle('history',{create:true});await writeText(hd,pfile().replace('.json',`_${stamp(old.lastModified)}.json`),await old.text())}
    await writeText(DIRH,pfile(),text);const nf=await (await DIRH.getFileHandle(pfile())).getFile();
    FINFO={lm:nf.lastModified,size:nf.size,at:Date.now()};DIRTY=0;fileStatus();saveDraft();
    fileMsg(`저장했습니다 — ${pfile()} (${(nf.size/1024).toFixed(0)} KB). 이전 판은 history 폴더에 보관했습니다.`,'ok')}
  catch(e){fileMsg('저장하지 못했습니다: '+esc(e.message||e),'warn',[['내려받기로 저장',()=>downloadPrj()]])}}
function downloadPrj(text){text=text||JSON.stringify(buildFile(),noCache);const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'application/json'}));
  a.download=pfile().replace('.json',`_${stamp(Date.now())}.json`);document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000);
  DIRTY=0;FINFO={...(FINFO||{}),at:Date.now()};fileStatus();saveDraft();fileMsg('내려받기 폴더에 저장했습니다. 다른 PC에서는 [파일 열기]로 불러옵니다.','ok')}
async function readFolderFile(take){try{const fh=await DIRH.getFileHandle(PFILE),f=await fh.getFile();const o=JSON.parse(await f.text());
    const go=()=>{loadPrj(o,PFILE);FINFO={lm:f.lastModified,size:f.size,at:f.lastModified};fileStatus();saveDraft()};
    if(!take&&DIRTY){fileMsg(`폴더에 ${PFILE}이(가) 있습니다. 지금 화면에 저장 안 된 실적 ${DIRTY}건이 있습니다.`,'warn',[['파일 내용 불러오기',go],['지금 내용 유지 (다음 저장 때 덮어씀)',()=>{FINFO={lm:f.lastModified,size:f.size,at:FINFO&&FINFO.at};fileMsg('')}]]);return}
    go()}
  catch(e){if(e.name==='NotFoundError'){FINFO=null;fileMsg(`폴더 "${esc(DIRH.name)}"에 아직 데이터 파일이 없습니다. [저장]하면 ${PFILE}이(가) 만들어집니다.`,'ok');fileStatus()}
    else fileMsg('파일을 읽지 못했습니다: '+esc(e.message||e),'warn')}}
async function connectFolder(){if(!FSA){fileMsg('이 브라우저는 폴더 직접 저장을 지원하지 않습니다. [내려받기]와 [파일 열기]를 쓰세요.','warn');return}
  try{DIRH=await window.showDirectoryPicker({id:'llrn-data',mode:'readwrite'});await kv('dir',DIRH);fileStatus();await readFolderFile(false)}
  catch(e){if(e.name!=='AbortError')fileMsg('폴더를 연결하지 못했습니다: '+esc(e.message||e),'warn')}}
async function reconnect(){const h=await kv('dir');if(!h)return connectFolder();try{if(!await perm(h))throw new Error('권한이 거부되었습니다.');DIRH=h;fileStatus();await readFolderFile(false)}catch(e){fileMsg('폴더를 다시 연결하지 못했습니다: '+esc(e.message||e),'warn',[['폴더 선택',connectFolder]])}}
$('fConnect').addEventListener('click',connectFolder);$('fSave').addEventListener('click',()=>saveProject(false));$('fDown').addEventListener('click',()=>downloadPrj());
$('fOpen').addEventListener('click',()=>$('fOpenIn').click());
$('fOpenIn').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{loadPrj(JSON.parse(await f.text()),f.name);DIRTY=0;FINFO={opened:f.name};fileStatus()}catch(err){fileMsg('열지 못했습니다: '+esc(err.message||err),'warn')}});
// ---------- actual-based schedule ----------
function recalcActual(){if(!hasAct()){PROG=null;RESF=null;VF=null}
  else{PROG=ENG.progress(SCHED.tasks,SCHED.cal,PRJ.actuals,PRJ.dataDate);RESF=PROG?ENG.compute(PROG.tasks,CFGA,ST,D0):null;VF=RESF?viewData(RESF):null}
  if(!VF&&MODE!=='plan')MODE='plan';
  ensureR0();syncR0();const cm=cmpData();
  useView();if(window._setTab)_setTab(MODE==='plan'?RES:RESF,cm.R);if(window._setMode)_setMode(MODE);
  document.querySelectorAll('[data-mode]').forEach(b=>{b.disabled=b.dataset.mode!=='plan'&&!VF;b.setAttribute('aria-pressed',String(b.dataset.mode===MODE))});
  document.querySelectorAll('.lg-cmp').forEach(x=>x.hidden=MODE!=='cmp');
  renderProg();renderActTable();renderBaselines();if(typeof renderSim==='function'&&window.LLRNSim)renderSim()}
function scheduleRecalc(){clearTimeout(recalcT);recalcT=setTimeout(()=>{recalcActual();drawTicks();setT(cur);drawGantt()},250)}
function setMode(m){if(m!=='plan'&&!VF)return;MODE=m;recalcActual();drawTicks();setT(cur);drawGantt();
  $('schedDesc').textContent=m==='plan'?'계획 공정을 위성지도 위 3D 모델로 재생합니다.':m==='act'?`기준일 ${dot(PRJ.dataDate)}까지는 실적, 이후는 실적기반 예상 공정으로 재생합니다.`:`실적·예상 공정을 계획과 비교합니다. 파랑 = 계획보다 ${TOL}일 넘게 앞섬, 빨강 = ${TOL}일 넘게 늦음, 연빨강 반투명 = 계획상 있어야 하는데 아직 없음.`}
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
// ---------- progress summary + S-curve ----------
function renderProg(){const box=$('progBody');
  if(!PROG){$('progSub').textContent='';box.innerHTML=`<div class="empty">실적 입력에서 <b>기준일</b>을 정하면 실적 공정률, 예상 준공일, S-curve가 표시됩니다.</div>`;$('sec-prog').classList.add('off');return}
  $('sec-prog').classList.remove('off');
  const dd=PRJ.dataDate,cm=cmpData(),c=ENG.curve(SCHED.tasks,PROG,dd,[MS(dd)+DAY])[0],pc=ENG.curve(cm.sched.tasks,null,dd,[MS(dd)+DAY],cm.frozen)[0],gap=c.act-pc.plan;c.plan=pc.plan;
  const months=+CON.months||CFG.contract.months,end=ENG.addMonths(iso(COMM),months),fl=Math.round((MS(end)-MS(PROG.finish))/DAY),slip=Math.round((MS(PROG.finish)-MS(cm.finish))/DAY);
  const late=Object.values(PROG.byId).filter(o=>o.state!=='done'&&cmpDelta(o)>0),lateCrit=late.filter(o=>o.crit).length;
  const cn=cm.b.name,curSlip=cm.same?null:Math.round((MS(PROG.finish)-MS(TL.finish))/DAY);
  $('progSub').textContent=`현재 기준선 ${blName()} · 비교 ${cn} · 기준일 ${dot(dd)} · 실적 ${Object.keys(PRJ.actuals).length.toLocaleString()}건 · ${PROG.count.done.toLocaleString()} 완료 · ${PROG.count.run.toLocaleString()} 진행 중`;
  const st=(l,v,s,cls)=>`<div class="c"><span class="l">${l}</span><span class="v ${cls||''}">${v}</span><span class="s" title="${esc(s)}">${s}</span></div>`;
  box.innerHTML=`<div class="pstrip">`+
    st('실적 공정률',`${c.act.toFixed(1)}%`,'작업기간 가중 · 기준일 마감')+
    st('계획 공정률',`${c.plan.toFixed(1)}%`,`${cn} · 같은 날`)+
    st('차이',`${gap>=0?'+':''}${gap.toFixed(1)}%p`,gap<0?'계획보다 늦음':'계획 이상',gap<-0.05?'neg':'pos')+
    st('예상 준공일',dot(PROG.finish),(slip>0?`${cn}보다 ${slip}일 늦음`:slip<0?`${cn}보다 ${-slip}일 빠름`:`${cn} 준공과 같음`)+(curSlip!=null?` · 현재 기준선 대비 ${curSlip>0?'+':''}${curSlip}일`:''),slip>0?'neg':'')+
    st('계약 준공 대비',fl<0?`${fl}일`:fl===0?'0일':`+${fl}일`,fl<0?`계약 준공 ${dot(end)}보다 ${-fl}일 초과`:`계약 준공 ${dot(end)}`,fl<0?'neg':'pos')+
    st('지연 activity',`${late.length.toLocaleString()}개`,`예상 완료가 ${cn}보다 늦은 미완료 · 주공정 ${lateCrit}개`,late.length?'neg':'')+
  `</div><div id="scurve" class="scurve"></div>`;
  drawSCurve()}
let SCV=null;
function drawSCurve(){const el=document.getElementById('scurve');if(!el||!PROG)return;const W=Math.max(320,el.clientWidth||900),H=260,L=44,R=16,T=16,B=28;
  const months=+CON.months||CFG.contract.months,end=MS(ENG.addMonths(iso(COMM),months));
  const a=Math.min(t0,COMM),b=Math.max(t1,end)+DAY,dd=MS(PRJ.dataDate)+DAY;
  const n=160,pts=[];for(let i=0;i<=n;i++)pts.push(a+(b-a)*i/n);pts.push(dd);pts.sort((x,y)=>x-y);
  const cm=cmpData(),cv=ENG.curve(SCHED.tasks,PROG,PRJ.dataDate,pts),cvB=ENG.curve(cm.sched.tasks,null,PRJ.dataDate,pts,cm.frozen);
  cv.forEach((p,i)=>{p.cur=p.plan;p.plan=cvB[i].plan});if(cm.same)cv.forEach(p=>p.cur=null);
  if(!cm.same&&SCHED.frozen){const cf=ENG.curve(SCHED.tasks,null,PRJ.dataDate,pts,SCHED.frozen.dataDate);cv.forEach((p,i)=>p.cur=cf[i].plan)}
  SCV={cv,a,b,L,R,T,B,W,H};
  const X=t=>L+(W-L-R)*(t-a)/(b-a),Y=v=>T+(H-T-B)*(1-v/100);
  const cPlan=css('--chart-plan'),cAct=css('--color-action-primary'),grid=css('--color-divider-default'),ink=css('--color-text-muted');
  let s=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="S-curve: 계획 대비 실적·예상 공정률">`;
  for(const v of [0,25,50,75,100])s+=`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${grid}"/><text x="${L-6}" y="${Y(v)+4}" text-anchor="end" fill="${ink}">${v}%</text>`;
  for(let y=new Date(a).getUTCFullYear()+1;y<=new Date(b).getUTCFullYear();y++){const x=X(Date.UTC(y,0,1));s+=`<line x1="${x}" x2="${x}" y1="${T}" y2="${H-B}" stroke="${grid}"/><text x="${x+4}" y="${H-8}" fill="${ink}">${y}</text>`}
  const P=cv.map(p=>({t:p.t,v:p.plan})),A=cv.map(p=>({t:p.t,v:p.act}));
  const pp=arr=>arr.map((p,i)=>`${i?'L':'M'}${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join('');
  s+=`<path d="${pp(P)}" fill="none" stroke="${cPlan}" stroke-width="2"/>`;const cCur=css('--chart-cur');
  if(!cm.same)s+=`<path d="${pp(cv.map(p=>({t:p.t,v:p.cur})))}" fill="none" stroke="${cCur}" stroke-width="2"/>`;
  s+=`<path d="${pp(A.filter(p=>p.t<=dd))}" fill="none" stroke="${cAct}" stroke-width="2.5"/>`;
  s+=`<path d="${pp(A.filter(p=>p.t>=dd))}" fill="none" stroke="${cAct}" stroke-width="2" stroke-dasharray="6 4"/>`;
  const xd=X(dd);s+=`<line x1="${xd}" x2="${xd}" y1="${T}" y2="${H-B}" stroke="${css('--color-text-secondary')}" stroke-dasharray="3 3"/><text x="${xd+4}" y="${T+10}" fill="${css('--color-text-secondary')}" font-weight="600">기준일</text>`;
  const xe=X(end);s+=`<line x1="${xe}" x2="${xe}" y1="${T}" y2="${H-B}" stroke="${css('--color-status-danger')}" stroke-dasharray="2 3"/><text class="halo" x="${xe-4}" y="${H-B-6}" text-anchor="end" fill="${css('--color-status-danger')}" font-weight="600">계약 준공 ${dotS(iso(end))}</text>`;
  // direct labels at the data date
  const at=cv.find(p=>p.t===dd)||cv[0];s+=`<circle cx="${xd}" cy="${Y(at.act)}" r="4.5" fill="${cAct}" stroke="${css('--color-bg-surface')}" stroke-width="2"/><circle cx="${xd}" cy="${Y(at.plan)}" r="4" fill="${cPlan}" stroke="${css('--color-bg-surface')}" stroke-width="2"/>`;
  const up=at.act>=at.plan,ya=Y(at.act),yp=Y(at.plan),mid=(ya+yp)/2,sp=Math.max(9,Math.abs(ya-yp)/2);
  s+=`<text class="halo" x="${xd-10}" y="${up?mid-sp-2:mid+sp+12}" text-anchor="end" fill="${css('--color-text-primary')}" font-weight="600">실적 ${at.act.toFixed(1)}%</text><text class="halo" x="${xd-10}" y="${up?mid+sp+12:mid-sp-2}" text-anchor="end" fill="${css('--color-text-secondary')}">${esc(cm.b.name.split(' ')[0])} ${at.plan.toFixed(1)}%</text>`;
  s+=`<g id="scHover"></g><rect x="${L}" y="${T}" width="${W-L-R}" height="${H-T-B}" fill="transparent" id="scHit"/></svg>`;
  s+=`<div class="sclegend"><span><i style="background:${cPlan}"></i>${esc(cm.b.name)}${cm.same?'':' (비교)'}</span>${cm.same?'':`<span><i style="background:${cCur}"></i>${esc(blName())} (현재)</span>`}<span><i style="background:${cAct}"></i>실적 (기준일까지)</span><span><i class="dash" style="border-color:${cAct}"></i>실적기반 예상</span></div><div class="sctip" id="scTip" hidden></div>`;
  el.innerHTML=s;
  const hit=document.getElementById('scHit'),tip=document.getElementById('scTip'),g=document.getElementById('scHover');
  hit.addEventListener('mousemove',e=>{const r=hit.getBoundingClientRect();const t=a+(b-a)*(e.clientX-r.left)/r.width;const q=cv.reduce((m,p)=>Math.abs(p.t-t)<Math.abs(m.t-t)?p:m,cv[0]);const x=X(q.t);
    g.innerHTML=`<line x1="${x}" x2="${x}" y1="${T}" y2="${H-B}" stroke="${css('--color-border-strong')}"/><circle cx="${x}" cy="${Y(q.plan)}" r="4" fill="${cPlan}"/><circle cx="${x}" cy="${Y(q.act)}" r="4" fill="${cAct}"/>`;
    tip.hidden=false;tip.innerHTML=`<b>${dot(iso(q.t-DAY))}</b><span>${esc(cm.b.name)} ${q.plan.toFixed(1)}%</span>${q.cur!=null?`<span>${esc(blName())} ${q.cur.toFixed(1)}%</span>`:''}<span>${q.t<=dd?'실적':'예상'} ${q.act.toFixed(1)}%</span>`;
    tip.style.left=Math.min(W-150,x+12)+'px';tip.style.top=(Math.min(Y(q.act),Y(q.plan))-6)+'px'});
  hit.addEventListener('mouseleave',()=>{g.innerHTML='';tip.hidden=true});
  hit.addEventListener('click',e=>{const r=hit.getBoundingClientRect();setT(a+(b-a)*(e.clientX-r.left)/r.width)})}
// ---------- actual input table ----------
let CTX=null,GRP=[];
function ctxOf(){if(!CTX||CTX.s!==SCHED){const c=IMP.context(SCHED.tasks);CTX={s:SCHED,path:c.path};
    const g=new Set();for(const t of SCHED.tasks)if(!t.summary&&t.start){const p=CTX.path[t.id]||[];if(p.length>1)g.add(p[1])}GRP=[...g];
    $('actGrp').innerHTML='<option value="">전체 공종</option>'+GRP.map(x=>`<option>${esc(String(x).trim())}</option>`).join('')}return CTX}
function actRows(){const dd=PRJ.dataDate,f=$('actFilter').value,q=$('actQ').value.trim().toLowerCase(),gp=$('actGrp').value;const C=ctxOf();
  return SCHED.tasks.filter(t=>!t.summary&&t.start&&t.finish&&String(t.name||'').trim()).filter(t=>{
    const a=PRJ.actuals[t.uid],o=PROG&&PROG.byId[t.id],p=C.path[t.id]||[];
    if(gp&&String(p[1]||'').trim()!==gp)return false;
    if(q&&!(String(t.name).toLowerCase().includes(q)||p.some(x=>String(x).toLowerCase().includes(q))||String(t.uid)===q))return false;
    if(f==='due')return dd&&t.start.slice(0,10)<=dd&&!(a&&a.af);
    if(f==='run')return a&&a.as&&!a.af;
    if(f==='late')return o&&o.state!=='done'&&cmpDelta(o)>0;
    if(f==='entered')return !!a;
    if(f==='week'){const w=iso(MS(dd)+7*DAY);return t.start.slice(0,10)<=w&&t.finish.slice(0,10)>dd&&!(a&&a.af)}
    return true}).sort((x,y)=>x.start.localeCompare(y.start)||x.id-y.id)}
function renderActTable(){if(!$('actRows'))return;const dd=PRJ.dataDate;const C=ctxOf();
  $('actNeed').hidden=!!dd;$('actMain').hidden=!dd;if(!dd)return;
  const rows=actRows(),show=rows.slice(0,actPage);
  $('actCount').textContent=`${rows.length.toLocaleString()}개 activity${rows.length>show.length?` 중 ${show.length.toLocaleString()}개 표시`:''}`;
  $('actMore').hidden=rows.length<=show.length;
  $('actRows').innerHTML=show.map(t=>{const a=PRJ.actuals[t.uid]||{},o=PROG&&PROG.byId[t.id],p=C.path[t.id]||[];
    const st=!o?['none','–']:o.state==='done'?['done','완료']:o.state==='run'?(o.dfin>0?['bad','진행 · 지연']:['run','진행 중']):(t.start.slice(0,10)<=dd?['warn','착수 지연']:['none','미착수']);
    const df=o?cmpDelta(o):0,dv=df?`<span class="${df>0?'neg':'pos'}" title="${esc(cmpData().b.name)} 대비">${df>0?'+':''}${df}일</span>`:'';
    return `<tr data-uid="${t.uid}"><td><div class="an">${esc(String(t.name).trim())}${o&&o.crit&&o.state!=='done'?' <span class="cp" title="실적기반 공정표의 주공정">주공정</span>':''}</div><div class="grp">${esc(String(p[p.length-1]||'').trim())} · ${t.uid}</div></td>
      <td class="d">${dotS(t.start.slice(0,10))} ~ ${dotS(t.finish.slice(0,10))}<div class="grp">${(+t.dur||0).toLocaleString()}일</div></td>
      <td><input class="input din" type="date" data-f="as" value="${a.as||''}" max="${dd}" aria-label="실제 착수일"></td>
      <td><input class="input pin" type="number" data-f="pct" min="0" max="100" step="1" value="${a.as?(a.af?100:(+a.pct||0)):''}" aria-label="진척률(%)" ${a.af?'disabled':''}></td>
      <td><input class="input din" type="date" data-f="af" value="${a.af||''}" max="${dd}" ${a.as?`min="${a.as}"`:''} aria-label="실제 완료일"></td>
      <td class="d">${o?dotS(o.ef):''} ${dv}</td><td><span class="pill ${st[0]}">${st[1]}</span></td>
      <td><button class="icon-btn sm" data-plan title="기준일까지 계획대로 채우기" aria-label="기준일까지 계획대로 채우기">${ICON_FILL}</button></td></tr>`}).join('')||`<tr><td colspan="8"><div class="empty">조건에 맞는 activity가 없습니다.</div></td></tr>`;
  $('actRows').querySelectorAll('tr[data-uid]').forEach(tr=>{const u=tr.dataset.uid;
    tr.querySelectorAll('input').forEach(i=>i.addEventListener('change',()=>setActual(u,i.dataset.f,i.value)));
    tr.querySelector('[data-plan]').addEventListener('click',()=>{fillPlanned([SCHED.tasks.find(t=>String(t.uid)===u)]);})})}
const ICON_FILL=`<svg class="ic sm" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12l4 4L19 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
function logChange(u,f,from,to){PRJ.log.push({at:nowIso(),dd:PRJ.dataDate,uid:+u||u,f,from:from??null,to:to??null});if(PRJ.log.length>20000)PRJ.log=PRJ.log.slice(-20000)}
function setActual(u,f,v){const dd=PRJ.dataDate,t=SCHED.tasks.find(x=>String(x.uid)===String(u));if(!t)return;const old={...(PRJ.actuals[u]||{})};const a={...old};let note='';
  if(f==='as'){if(!v){delete PRJ.actuals[u];logChange(u,'clear',JSON.stringify(old),null);touched();scheduleRecalc();return}
    if(v>dd){fileMsg(`실제 착수일은 기준일(${dot(dd)}) 이후일 수 없습니다.`,'warn');renderActTable();return}a.as=v;if(a.af&&a.af<v){a.af=null;a.pct=0;note='완료일이 착수일보다 빨라 지웠습니다.'}if(a.pct==null)a.pct=0}
  if(f==='af'){if(!v){a.af=null;if(+a.pct>=100)a.pct=99}else{if(v>dd){fileMsg(`실제 완료일은 기준일(${dot(dd)}) 이후일 수 없습니다.`,'warn');renderActTable();return}
      if(!a.as){a.as=t.start.slice(0,10)<=v?t.start.slice(0,10):v;note=`착수일이 없어 ${dot(a.as)}로 넣었습니다. 다르면 고쳐 주세요.`}
      if(v<a.as){fileMsg('실제 완료일이 착수일보다 빠릅니다.','warn');renderActTable();return}a.af=v;a.pct=100}}
  if(f==='pct'){let p=Math.round(+v);if(!isFinite(p)||v===''){p=0}p=Math.max(0,Math.min(100,p));
    if(!a.as){a.as=t.start.slice(0,10)<=dd?t.start.slice(0,10):dd;note=`착수일이 없어 ${dot(a.as)}로 넣었습니다.`}
    a.pct=p;if(p>=100&&!a.af){a.af=dd;note=`100%라서 완료일을 기준일(${dot(dd)})로 넣었습니다. 실제 완료일이 다르면 고쳐 주세요.`}}
  a.by='공무';a.at=nowIso();PRJ.actuals[u]=a;for(const k of ['as','af','pct'])if(old[k]!==a[k])logChange(u,k,old[k],a[k]);
  if(note)fileMsg(note,'ok');touched();scheduleRecalc()}
// test helper: fill the shown activities as planned up to the data date (planned start, linear % to the data date)
function fillPlanned(ts){const dd=PRJ.dataDate,Cc=ENG.makeCal(SCHED.cal,'2020-01-01','2035-01-01');let n=0;
  for(const t of ts){if(!t)continue;const s=t.start.slice(0,10),f=t.finish.slice(0,10);if(s>dd)continue;const u=String(t.uid);const old=PRJ.actuals[u];
    let a;if(f<=dd)a={as:s,af:f,pct:100};else{const done=Cc.idx(iso(MS(dd)+DAY))-Cc.idx(s),d=Math.max(1,+t.dur||1);a={as:s,af:null,pct:Math.min(99,Math.round(100*done/d))}}
    a.by='공무 (계획대로)';a.at=nowIso();PRJ.actuals[u]=a;logChange(u,'plan',old?JSON.stringify(old):null,JSON.stringify(a));n++}
  if(n){touched(n);scheduleRecalc();fileMsg(`${n.toLocaleString()}개 activity를 기준일까지 계획대로 채웠습니다.`,'ok')}else fileMsg('기준일까지 착수 예정인 activity가 없습니다.','warn')}
$('actFillAll').addEventListener('click',()=>fillPlanned(actRows()));
['actFilter','actGrp'].forEach(i=>$(i).addEventListener('change',()=>{actPage=200;renderActTable()}));
let qT=null;$('actQ').addEventListener('input',()=>{clearTimeout(qT);qT=setTimeout(()=>{actPage=200;renderActTable()},250)});
$('actMore').addEventListener('click',()=>{actPage+=200;renderActTable()});
$('dataDate').addEventListener('change',e=>{const v=e.target.value;if(!v)return;const old=PRJ.dataDate;
  const after=Object.entries(PRJ.actuals).filter(([,a])=>a.as>v||a.af&&a.af>v).length;
  if(after){fileMsg(`기준일 ${dot(v)} 이후 날짜로 들어간 실적이 ${after}건 있습니다. 기준일을 그 날짜 이후로 정해 주세요.`,'warn');e.target.value=old||'';return}
  PRJ.dataDate=v;logChange('-','dataDate',old,v);touched();
  if(!old){recalcActual();setMode('cmp');setT(MS(v))}else scheduleRecalc()});
$('ddToday').addEventListener('click',()=>{const e=$('dataDate');e.value=siteToday();e.dispatchEvent(new Event('change'))});
// ---------- start-up: restore the working draft and offer the folder again ----------
async function restoreDraft(){const d=await kv('draft'),h=await kv('dir');
  if(d&&d.prj&&d.prj.format===PFMT){PRJ={...newPrj(),...d.prj};DIRTY=d.dirty||0;FINFO=d.finfo||null;$('dataDate').value=PRJ.dataDate||'';
    if(PRJ.active&&PRJ.active!=='R0'&&BL(PRJ.active))activateBaseline(PRJ.active,true);else recalcActual();if(PRJ.dataDate){MODE='cmp';recalcActual();drawTicks();setT(MS(PRJ.dataDate));drawGantt()}}
  fileStatus();
  if(h&&FSA)fileMsg(`지난번 데이터 폴더 "${esc(h.name)}"를 다시 연결할까요? (브라우저 보안상 한 번 눌러야 합니다)`,'',[['다시 연결',reconnect]])}
// ---------- baselines: Rev.0 (contract programme) … Rev.n (revised programmes) ----------
// current (active) baseline = the plan the actual-based schedule runs on and the gantt / CP show
// comparison baseline = what delays, S-curve plan line and 3D colours are measured against (e.g. Rev.0 for EOT)
const BL=id=>(PRJ.baselines||[]).find(b=>b.id===id);
const activeBL=()=>BL(PRJ.active)||(PRJ.baselines||[])[0];
const blName=()=>{const b=activeBL();return b?b.name:'Rev.0'};
function ensureR0(){if(PRJ.baselines&&PRJ.baselines.length)return;
  PRJ.baselines=[{id:'R0',rev:0,name:'Rev.0 최초 계획',source:(SCHED.meta&&SCHED.meta.file)||'General Schedule re3',created:nowIso(),builtin:!MAP,sched:MAP?BASE:undefined,map:MAP||null,start:CON.start||null,status:'승인'}];
  PRJ.active='R0';PRJ.cmp='R0'}
// Rev.0 follows the commencement date / uploaded file while it is the current baseline
function syncR0(){const b=BL('R0');if(!b||PRJ.active!=='R0')return;const key=(MAP?'u':'b')+'|'+(CON.start||'')+'|'+(MAP?(BASE.meta&&BASE.meta.file)+BASE.tasks.length:'');
  if(b._k===key)return;b.builtin=!MAP;b.sched=MAP?BASE:undefined;b.map=MAP||null;b.start=CON.start||null;b._k=key;b._c=null}
function activateBaseline(id,quiet){const b=BL(id);if(!b)return;PRJ.active=id;
  if(b.abs)applySchedule(b.sched,b.map||null,{abs:true});
  else{CON.start=b.start||undefined;try{localStorage.setItem(CKEY,JSON.stringify(CON))}catch(e){}
    if(b.builtin){try{localStorage.removeItem(SKEY)}catch(e){}applySchedule(SCHED0,null)}else{try{localStorage.setItem(SKEY,JSON.stringify({sched:b.sched,map:b.map}))}catch(e){}applySchedule(b.sched,b.map)}}
  if(!quiet){touched();fileMsg(`현재 기준선을 ${esc(b.name)}(으)로 바꿨습니다. 실적기반 공정표는 이 기준선의 논리로 다시 계산했습니다.`,'ok')}
  drawTicks();setT(cur);drawGantt()}
// "re3로 되돌리기" / replacing the file only make sense on Rev.0
function blToR0(){if(!PRJ.active||PRJ.active==='R0')return true;
  fileMsg(`지금 현재 기준선이 ${esc(blName())}입니다. 공정표 파일 교체는 Rev.0에서만 할 수 있습니다. 수정 공정표는 [새 기준선으로 추가]로 올려 주세요.`,'warn');closeImp();return false}
function blCompute(b){if(b._c)return b._c;let sched,cfg=b.map?IMP.remapCfg(CFG,b.map):CFG;
  if(b.abs)sched=b.sched;else sched=ENG.shiftSchedule(b.builtin?SCHED0:b.sched,b.start||undefined,cfg.commence).sched;
  const R=ENG.compute(sched.tasks,cfg,ST,D0),fin={};for(const t of sched.tasks)if(!t.summary&&t.finish)fin[String(t.uid)]=t.finish.slice(0,10);
  b._c={id:b.id,b,sched,R,fin,finish:R.finish,frozen:b.abs&&sched.frozen?sched.frozen.dataDate:null};return b._c}
function cmpData(){const a=activeBL();let id=PRJ.cmp&&BL(PRJ.cmp)?PRJ.cmp:a.id;
  if(id===a.id){const fin={};for(const t of SCHED.tasks)if(!t.summary&&t.finish)fin[String(t.uid)]=t.finish.slice(0,10);
    if(!a._cur||a._cur.s!==SCHED)a._cur={s:SCHED,c:{id,b:a,sched:SCHED,R:RES,fin,finish:TL.finish,frozen:SCHED.frozen?SCHED.frozen.dataDate:null,same:true}};return a._cur.c}
  return {...blCompute(BL(id)),same:false}}
let WCAL=null;const wcal=()=>{if(!WCAL||WCAL.s!==SCHED)WCAL={s:SCHED,c:ENG.makeCal(SCHED.cal,'2020-01-01','2036-12-31')};return WCAL.c};
const nxt=d=>iso(MS(d)+DAY);
// forecast finish of an activity vs the comparison baseline, in working days (+ = late); same uid in both
function cmpDelta(o){const f=cmpData().fin[o.uid];if(!f)return 0;const C=wcal();return C.idx(nxt(o.ef))-C.idx(nxt(f))}
function setCmp(id){if(!BL(id))return;PRJ.cmp=id;touched();recalcActual();drawTicks();setT(cur);drawGantt()}
function renderBaselines(){const box=$('blRows');if(!box)return;ensureR0();
  const rows=PRJ.baselines.map(b=>{const c=b.id===PRJ.active?{finish:TL.finish}:blCompute(b);
    return `<tr data-id="${b.id}"><td class="d"><b>Rev.${b.rev}</b></td><td><input class="input bln" value="${esc(b.name)}" aria-label="기준선 이름"></td>
      <td><div>${esc(b.source||'')}</div><div class="grp">${b.dataDate?`기준일 ${dot(b.dataDate)}까지 실적으로 고정`:'최초 계획'}</div></td>
      <td class="d">${dotS(String(b.created||'').slice(0,10))}</td><td class="d">${dot(c.finish)}</td>
      <td><select class="select bls" aria-label="상태">${['작성 중','제출','승인'].map(x=>`<option ${b.status===x?'selected':''}>${x}</option>`).join('')}</select></td>
      <td style="text-align:center"><input type="radio" name="blAct" ${b.id===PRJ.active?'checked':''} aria-label="현재 기준선으로"></td>
      <td style="text-align:center"><input type="radio" name="blCmp" ${b.id===(PRJ.cmp||PRJ.active)?'checked':''} aria-label="비교 기준선으로"></td>
      <td>${b.rev>0&&b.id!==PRJ.active?`<button class="icon-btn sm" data-del title="이 기준선 지우기" aria-label="이 기준선 지우기">✕</button>`:''}</td></tr>`}).join('');
  box.innerHTML=rows;
  box.querySelectorAll('tr[data-id]').forEach(tr=>{const b=BL(tr.dataset.id);
    tr.querySelector('.bln').addEventListener('change',e=>{b.name=e.target.value.trim()||`Rev.${b.rev}`;touched();renderProg()});
    tr.querySelector('.bls').addEventListener('change',e=>{b.status=e.target.value;if(e.target.value==='승인')b.approved=nowIso();touched()});
    tr.querySelector('[name=blAct]').addEventListener('change',()=>activateBaseline(b.id));
    tr.querySelector('[name=blCmp]').addEventListener('change',()=>setCmp(b.id));
    const d=tr.querySelector('[data-del]');if(d)d.addEventListener('click',()=>fileMsg(`${esc(b.name)}을(를) 지울까요? 데이터 파일의 이전 판(history)에는 남아 있습니다.`,'warn',[['지우기',()=>{PRJ.baselines=PRJ.baselines.filter(x=>x!==b);if(PRJ.cmp===b.id)PRJ.cmp='R0';touched();recalcActual();fileMsg('지웠습니다.','ok')}],['취소',()=>fileMsg('')]]))});
  $('blNew').disabled=!PROG;$('blUp').disabled=!PRJ.dataDate}
function nextRev(){return Math.max(...PRJ.baselines.map(b=>b.rev))+1}
// Rev.n from the app: past = actuals (frozen into the baseline), from the data date on = the actual-based schedule
function newRevFromActual(){if(!PROG){fileMsg('기준일과 실적이 있어야 새 기준선을 만들 수 있습니다.','warn');return}
  const rb=ENG.rebaseline(SCHED.tasks,SCHED.cal,PRJ.actuals,PRJ.dataDate),n=nextRev();
  const b={id:'R'+n,rev:n,name:`Rev.${n} 수정 계획 (${dotS(PRJ.dataDate)})`,source:`앱에서 생성 · ${blName()} + 실적`,created:nowIso(),dataDate:PRJ.dataDate,abs:true,status:'작성 중',from:PRJ.active,
    sched:{meta:{...SCHED.meta,rev:n},cal:SCHED.cal,tasks:rb.tasks,frozen:{dataDate:PRJ.dataDate}},map:MAP||null};
  const prev=PRJ.active;PRJ.baselines.push(b);if(!PRJ.cmp)PRJ.cmp=prev;activateBaseline(b.id,true);touched();
  fileMsg(`${esc(b.name)}을(를) 만들었습니다 — ${dot(PRJ.dataDate)}까지 끝난 작업 ${rb.count.done.toLocaleString()}개는 계획 = 실적, 진행 중 ${rb.count.run.toLocaleString()}개는 실제 착수일 + 남은 기간. 계획 준공 ${dot(rb.finish)}. 비교 기준선은 ${esc(BL(PRJ.cmp).name)}입니다.`,'ok')}
// Rev.n from an uploaded revised programme: activities with actuals take their actual dates, then the file is rescheduled from the data date
function addRevisionFromUpload(sc,map){if(!PRJ.dataDate)throw new Error('기준일이 없습니다. 실적 입력에서 기준일을 먼저 정해 주세요.');
  const uids=new Set(sc.tasks.filter(t=>!t.summary).map(t=>String(t.uid))),A={};for(const[u,a]of Object.entries(PRJ.actuals))if(uids.has(u))A[u]=a;
  const rb=ENG.rebaseline(sc.tasks,sc.cal,A,PRJ.dataDate);if(!rb)throw new Error('공정표에서 activity를 찾지 못했습니다.');
  let moved=0;const F={};for(const t of sc.tasks)F[t.id]=t;for(const t of rb.tasks){const o=F[t.id];if(!t.summary&&o&&o.start&&!t.act&&(o.start.slice(0,10)!==t.start.slice(0,10)||o.finish.slice(0,10)!==t.finish.slice(0,10)))moved++}
  const n=nextRev(),prev=PRJ.active;
  const b={id:'R'+n,rev:n,name:`Rev.${n} 수정 공정표 (${dotS(PRJ.dataDate)})`,source:`업로드 · ${(sc.meta&&sc.meta.file)||''}`,created:nowIso(),dataDate:PRJ.dataDate,abs:true,status:'작성 중',from:prev,
    sched:{meta:{...sc.meta,rev:n},cal:sc.cal,tasks:rb.tasks,frozen:{dataDate:PRJ.dataDate}},map};
  PRJ.baselines.push(b);if(!PRJ.cmp)PRJ.cmp=prev;activateBaseline(b.id,true);touched();
  fileMsg(`${esc(b.name)}을(를) 추가했습니다 — 실적 ${Object.keys(A).length.toLocaleString()}건을 실제 날짜로 맞췄고, 기준일 이후 일정은 관계대로 다시 계산했습니다`+
    (moved?` (파일 날짜와 달라진 미착수 activity ${moved.toLocaleString()}개: 실적 지연·관계 때문에 밀림)`:'')+`. 계획 준공 ${dot(rb.finish)}.`,moved?'warn':'ok')}
// ---------- import dialog: how to apply + actual carry-over ----------
function impModeInit(mode){const m=$('impMode'),hasA=!!PRJ.dataDate&&Object.keys(PRJ.actuals).length>0;
  m.querySelector('[value=add]').disabled=!PRJ.dataDate;m.querySelector('[value=replace]').disabled=PRJ.active&&PRJ.active!=='R0';
  m.value=mode||(hasA||PRJ.active!=='R0'?'add':'replace');if(m.selectedOptions[0].disabled)m.value=PRJ.dataDate?'add':'replace';
  $('impModeWrap').hidden=!PRJ.dataDate&&(!PRJ.active||PRJ.active==='R0');if(PRJ.active&&PRJ.active!=='R0')$('impReset').hidden=true}
let IMPA=null;
function renderImpActs(){const box=$('impActs');const A=PRJ.actuals,keys=Object.keys(A);if(!IMPD||!keys.length){box.hidden=true;IMPA=null;return}
  const sc=IMPD.sc,leaves=sc.tasks.filter(t=>!t.summary&&t.start&&String(t.name||'').trim()),inNew=new Set(leaves.map(t=>String(t.uid)));
  const old={};for(const t of SCHED.tasks)old[String(t.uid)]=t;const oc=IMP.context(SCHED.tasks),nc=IMP.context(sc.tasks);
  const taken=new Set(keys.filter(u=>inNew.has(u)));const orph=keys.filter(u=>!inNew.has(u));
  const par=(c,t)=>{const p=c.path[t.id]||[];return String(p[p.length-1]||'')};
  IMPA={map:{}};
  const sugg=u=>{const t=old[u];if(!t)return[];const nm=String(t.name||''),pp=par(oc,t);
    return leaves.filter(x=>!taken.has(String(x.uid))).map(x=>({x,s:0.7*IMP.dice(nm,String(x.name))+0.3*IMP.dice(pp,par(nc,x))})).sort((a,b)=>b.s-a.s).slice(0,8)};
  let h=`<div class="maphead"><h3>실적 이관</h3><span>실적 ${keys.length.toLocaleString()}건 중 <b>${(keys.length-orph.length).toLocaleString()}건</b>은 같은 activity ID로 그대로 이어집니다.${orph.length?` <b class="neg">${orph.length}건</b>은 새 공정표에 같은 ID가 없습니다 — 이어 붙일 activity를 고르세요. 비워 두면 이 공정표에서는 빠집니다(데이터 파일에는 남음).`:''}</span></div>`;
  if(orph.length){h+=`<div class="tbl-wrap" style="max-height:260px;margin-bottom:16px"><table class="tbl"><thead><tr><th>지금 공정표의 activity (실적)</th><th>새 공정표 activity</th></tr></thead><tbody>`+
    orph.map(u=>{const t=old[u],a=A[u],ss=sugg(u),best=ss[0]&&ss[0].s>=0.6?ss[0].x:null;if(best){IMPA.map[u]=String(best.uid);taken.add(String(best.uid))}
      return `<tr><td><div class="an">${esc(t?String(t.name).trim():'(지금 공정표에도 없음)')}</div><div class="grp">${esc(t?par(oc,t):'')} · ID ${u} · ${a.af?`완료 ${dotS(a.af)}`:`착수 ${dotS(a.as)} · ${a.pct||0}%`}</div></td>
        <td><select class="select" data-u="${u}" style="width:100%"><option value="">— 연결 안 함 —</option>${ss.map(c=>`<option value="${c.x.uid}" ${best&&c.x===best?'selected':''}>${esc(String(c.x.name).trim())} — ${esc(par(nc,c.x))} (ID ${c.x.uid}, ${Math.round(c.s*100)}%)</option>`).join('')}</select></td></tr>`}).join('')+`</tbody></table></div>`}
  box.innerHTML=h;box.hidden=false;
  box.querySelectorAll('select[data-u]').forEach(sel=>sel.addEventListener('change',()=>{if(sel.value)IMPA.map[sel.dataset.u]=sel.value;else delete IMPA.map[sel.dataset.u]}))}
function impCarryActuals(){if(!IMPA)return;let n=0;for(const[o,nu]of Object.entries(IMPA.map)){if(!PRJ.actuals[o]||PRJ.actuals[nu])continue;PRJ.actuals[nu]={...PRJ.actuals[o],movedFrom:+o};delete PRJ.actuals[o];logChange(nu,'carry',o,nu);n++}
  if(n)touched(n)}
$('blNew').addEventListener('click',newRevFromActual);$('blUp').addEventListener('click',()=>openImp('add'));
window.__act={setActual,fillPlanned,loadPrj,setMode,saveProject,newRevFromActual,activateBaseline,setCmp,get prj(){return PRJ},get prog(){return PROG}};
