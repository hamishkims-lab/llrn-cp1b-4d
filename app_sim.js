// ======================= 2단계 (Rev.6): 가상 현장 · 메신저 시뮬레이터 =======================
// Messages use the same shape the Telegram bot will write to the inbox file in stage 4:
//   {id, at:'YYYY-MM-DDTHH:MM:SS+08:00', chat:'grp'|crewId, from:'bot'|crewId, kind:'plan'|'reply'|'ack'|'notice', text}
// Every reply goes through the review queue (검토함); only confirmed items change the actuals.
const SIM=window.LLRNSim;
let CAT=null,simChat='grp',simBusy=false;
const catalog=()=>{if(!CAT||CAT.s!==SCHED)CAT={s:SCHED,c:SIM.catalog(SCHED.tasks,IMP.context(SCHED.tasks))};return CAT.c};
const crewById=id=>SIM.CREW.find(c=>c.id===id);
const crewName=id=>{const c=crewById(id);return c?`${c.name} ${c.role}`:id==='bot'?'공무 (앱)':id==='gm'?'공무':id};
const simOn=()=>!!(PRJ.sim&&PRJ.sim.on);
const dayLab=d=>`${dot(d)} (${['일','월','화','수','목','금','토'][new Date(d).getUTCDay()]})`;
function addMsg(m){PRJ.msgs=PRJ.msgs||[];m.id=m.id||'m'+(PRJ.msgs.length+1)+'-'+Math.floor(Math.random()*1e4);PRJ.msgs.push(m);return m}
// ---------- start / reset ----------
function startSim(){if(!PRJ.dataDate){fileMsg('실적 입력에서 기준일을 먼저 정해 주세요. 가상 현장은 기준일 다음 날부터 시작합니다.','warn');return}
  const truth={};for(const[u,a]of Object.entries(PRJ.actuals))truth[u]={as:a.as,af:a.af||null,pct:a.af?100:+a.pct||0};
  PRJ.sim={on:true,seed:'s'+Date.now().toString(36),scenario:$('simScen').value,date:iso(MS(PRJ.dataDate)+DAY),start:iso(MS(PRJ.dataDate)+DAY),dayNo:0,truth,plans:{},stats:{num:{ok:0,n:0},free:{ok:0,n:0}},auto:$('simAuto').checked};
  PRJ.msgs=[];PRJ.review=[];
  addMsg({chat:'grp',from:'bot',at:`${PRJ.sim.date}T06:50:00+08:00`,kind:'notice',text:`가상 현장을 시작합니다 — 시나리오: ${SIM.SCEN[PRJ.sim.scenario]}. 작업반 ${SIM.CREW.length}곳 (${SIM.CREW.map(c=>c.name).join(', ')}). 매일 07:00 계획, 17:00 실적 회신, 21:00 마감.`});
  touched();renderSim();fileMsg(`가상 현장을 시작했습니다. 저장하면 실제 실적 파일과 다른 이름(LLRN_CP1B_가상현장.json)으로 저장됩니다.`,'ok')}
function endSim(){if(!PRJ.sim)return;PRJ.sim.on=false;touched();renderSim();fileMsg('가상 현장을 멈췄습니다. 입력된 실적은 그대로 남습니다. 실제 실적으로 돌아가려면 [파일 열기]나 [폴더 연결]로 실제 파일을 불러오세요.','ok')}
// ---------- one or more virtual days ----------
async function runDays(n){if(!simOn()||simBusy)return;simBusy=true;const S=PRJ.sim,C=wcal(),cat=catalog();S.auto=$('simAuto').checked;S.scenario=$('simScen').value;
  const t0=performance.now();let done=0;
  try{for(let k=0;k<n;k++){const D=S.date;$('simState').textContent=`${dayLab(D)} 진행 중… (${k+1}/${n})`;
      const r=SIM.runDay({D,ENG,tasks:SCHED.tasks,cal:SCHED.cal,C,actuals:PRJ.actuals,cat,sim:S});
      for(const m of r.msgs){addMsg(m);if(m.kind==='reply')takeReply(m)}
      for(const d of r.direct){const a=PRJ.actuals[d.uid]=PRJ.actuals[d.uid]||{as:d.as,af:null,pct:0};if(d.done){a.af=d.date;a.pct=100}else a.pct=d.pct;a.by='공무';a.at=nowIso();logChange(d.uid,'sim-gm',null,JSON.stringify(a))}
      if(!r.holiday){if(S.auto)confirmMany(PRJ.review.filter(x=>x.state==='pending'&&x.date===D&&x.uid&&x.conf>=0.8),true);
        const pend=PRJ.review.filter(x=>x.state==='pending'&&x.date===D).length,got=r.msgs.filter(m=>m.kind==='reply').length,need=r.msgs.filter(m=>m.kind==='plan').length;
        addMsg({chat:'grp',from:'bot',at:`${D}T21:05:00+08:00`,kind:'notice',text:`[${dayLab(D)} 마감] 회신 ${got}/${need}곳 · 검토 대기 ${pend}건. 기준일을 ${dot(D)}로 옮겼습니다.`})}
      PRJ.dataDate=D;S.date=iso(MS(D)+DAY);done++;
      if(k%10===9)await new Promise(r=>setTimeout(r,0))}}
  finally{simBusy=false}
  $('dataDate').value=PRJ.dataDate;touched(done);recalcActual();drawTicks();setT(MS(PRJ.dataDate));drawGantt();renderSim();
  fileMsg(`가상 ${done}일을 진행했습니다 (${((performance.now()-t0)/1000).toFixed(1)}초). 기준일 ${dot(PRJ.dataDate)}, 예상 준공 ${PROG?dot(PROG.finish):'–'}.`,'ok')}
// a reply (virtual, typed by hand or read from the inbox file) -> review items
function planFor(crew,date){const P=(PRJ.sim&&PRJ.sim.plans&&PRJ.sim.plans[crew])||{};if(P[date])return P[date];const ds=Object.keys(P).filter(d=>d<=date).sort();return ds.length?P[ds[ds.length-1]]:[]}
function takeReply(m){const rd=SIM.reportDate(m.at),plan=planFor(m.from,rd),cat=catalog();
  const parsed=plan.length?SIM.parseReply(m.text,plan,cat):[{seg:m.text,uid:null,kind:null,conf:0.1}];
  if(m.meta&&m.meta.truth&&PRJ.sim){const sc=SIM.score(parsed,m.meta.truth),st=/num/.test((crewById(m.from)||{}).style||'')?PRJ.sim.stats.num:PRJ.sim.stats.free;st.ok+=sc.ok;st.n+=sc.n}
  // not in today's plan (e.g. typed by hand): search all of that crew's open activities, and leave it for review
  for(const p of parsed){if(p.uid||!p.kind)continue;const ext=Object.values(cat).filter(c=>c.crew===m.from&&!(PRJ.actuals[c.uid]&&PRJ.actuals[c.uid].af)).map(c=>({no:0,uid:c.uid}));
    const q=ext.length?SIM.parseReply(p.seg,ext,cat)[0]:null;if(q&&q.uid){p.uid=q.uid;p.conf=Math.min(q.conf,0.75);p.how='문장·전체 검색'}else if(q&&q.cands)p.cands=q.cands}
  PRJ.review=PRJ.review||[];
  parsed.forEach((p,i)=>PRJ.review.push({id:m.id+'-'+i,msg:m.id,crew:m.from,date:rd,at:m.at,seg:p.seg,uid:p.uid,kind:p.kind,pct:p.pct,why:p.why,conf:p.conf,how:p.how||'',cands:p.cands||null,state:'pending'}))}
// confirmed review item -> actual record (site date of the report)
function applyItem(x){const u=String(x.uid),dd=x.date;if(!PRJ.dataDate||PRJ.dataDate<dd)PRJ.dataDate=dd;
  const old=PRJ.actuals[u]?{...PRJ.actuals[u]}:null;let a=PRJ.actuals[u]?{...PRJ.actuals[u]}:null;const who=crewName(x.crew);
  if(x.kind==='stop'){if(a){(a.stops=a.stops||[]).push({date:dd,why:x.why||'other'});PRJ.actuals[u]=a}logChange(u,'stop',null,`${dd} ${x.why||''}`);return}
  if(!a)a={as:dd,af:null,pct:0};if(!a.as)a.as=dd;
  if(x.kind==='done'){a.af=a.af&&a.af<dd?a.af:dd;a.pct=100}else{a.pct=Math.max(0,Math.min(99,+x.pct||0));if(a.af&&+x.pct<100){a.af=null}}
  a.by=who;a.at=nowIso();a.src=x.msg;PRJ.actuals[u]=a;for(const k of ['as','af','pct'])if(!old||old[k]!==a[k])logChange(u,k,old?old[k]:null,a[k])}
function confirmMany(list,quiet){if(!list.length)return 0;const byCrew={};
  for(const x of list){if(!x.uid||!x.kind)continue;applyItem(x);x.state='ok';x.okAt=nowIso();(byCrew[x.crew+'|'+x.date]=byCrew[x.crew+'|'+x.date]||[]).push(x)}
  const cat=catalog();
  for(const[k,xs]of Object.entries(byCrew)){const[crew,date]=k.split('|');
    addMsg({chat:crew,from:'bot',at:`${date}T21:00:00+08:00`,kind:'ack',text:`반영했습니다 ✓ (${dot(date)})\n`+xs.map(x=>`· ${cat[x.uid]?cat[x.uid].label:x.uid} — ${x.kind==='done'?'완료':x.kind==='stop'?'중지 ('+({rain:'우천',equip:'장비 고장',material:'자재'}[x.why]||'기타')+')':x.pct+'%'}`).join('\n')})}
  if(!quiet){touched(list.length);scheduleRecalc();renderSim()}return list.length}
// ---------- screen ----------
function renderSim(){const on=simOn(),S=PRJ.sim;$('simStart').textContent=on?'다시 시작':'가상 현장 시작';$('simStop').hidden=!on;
  ['simDay','simWeek','simMonth'].forEach(i=>$(i).disabled=!on||simBusy);$('simBanner').hidden=!on;
  $('simState').textContent=on?`다음 가상 날짜 ${dayLab(S.date)} · 시작 ${dot(S.start)} · ${S.dayNo}일 진행`:'기준일 다음 날부터 가상 작업반 5곳이 계획을 받고 실적을 회신합니다.';
  if(S&&S.scenario)$('simScen').value=S.scenario;
  const st=S&&S.stats,pc=(o)=>o&&o.n?`${(100*o.ok/o.n).toFixed(1)}% (${o.ok}/${o.n})`:'–';
  const R=PRJ.review||[],nP=R.filter(x=>x.state==='pending').length,nO=R.filter(x=>x.state==='ok').length,nI=R.filter(x=>x.state==='ignored').length;
  $('simStats').innerHTML=`해석 정확도 (가상 정답과 비교) — 번호형 <b>${pc(st&&st.num)}</b> · 자유 문장 <b>${pc(st&&st.free)}</b> · 반영 ${nO.toLocaleString()} · 무시 ${nI} · 검토 대기 <b class="${nP?'neg':''}">${nP}</b>`;
  // chat list
  const M=PRJ.msgs||[],last=id=>{for(let i=M.length-1;i>=0;i--)if(M[i].chat===id)return M[i];return null};
  const chats=[{id:'grp',name:'현장 공지 (단체방)',sub:'전체'},...SIM.CREW.map(c=>({id:c.id,name:`${c.name} ${c.role}`,sub:c.team}))];
  $('simChats').innerHTML=chats.map(c=>{const l=last(c.id),pend=R.filter(x=>x.state==='pending'&&x.crew===c.id).length;
    return `<button type="button" class="chat ${simChat===c.id?'on':''}" data-c="${c.id}"><span class="cn">${esc(c.name)}${pend?` <i class="cnt">${pend}</i>`:''}</span><span class="cs">${esc(c.sub)}${l?' · '+l.at.slice(5,10).replace('-','.')+' '+l.at.slice(11,16):''}</span></button>`}).join('');
  $('simChats').querySelectorAll('.chat').forEach(b=>b.addEventListener('click',()=>{simChat=b.dataset.c;renderSim()}));
  const cm=crewById(simChat);$('simWho').textContent=cm?`${cm.name} ${cm.role} 이름으로 보내기`:'단체방에는 보낼 수 없습니다 (작업반을 고르세요)';$('simSend').disabled=!cm||!on;$('simText').disabled=!cm||!on;
  const ms=M.filter(m=>m.chat===simChat).slice(-150);
  $('simMsgs').innerHTML=ms.length?ms.map(m=>`<div class="msg ${m.from==='bot'?'me':''} ${m.kind}"><div class="mh">${esc(crewName(m.from))} · ${m.at.slice(5,10).replace('-','.')} ${m.at.slice(11,16)}${m.from!=='bot'&&SIM.reportDate(m.at)!==m.at.slice(0,10)?` <span class="tag">→ ${dotS(SIM.reportDate(m.at))} 실적</span>`:''}</div><div class="mb">${esc(m.text).replace(/\n/g,'<br>')}</div></div>`).join(''):'<div class="empty">메시지가 없습니다.</div>';
  const box=$('simMsgs');box.scrollTop=box.scrollHeight;
  renderReview()}
function renderReview(){const R=(PRJ.review||[]).filter(x=>x.state==='pending'),cat=catalog();$('revCount').textContent=`${R.length}건`;$('revAll').disabled=!R.some(x=>x.uid&&x.conf>=0.8);
  $('revList').innerHTML=R.slice(0,60).map(x=>{const plan=planFor(x.crew,x.date);const opts=[...new Set([...(x.cands||[]),...plan.map(p=>p.uid),...(x.uid?[x.uid]:[])])];
    return `<div class="rev" data-id="${x.id}"><div class="rh"><b>${esc(crewName(x.crew))}</b> · ${dotS(x.date)} 실적 <span class="pill ${x.conf>=0.8?'done':x.conf>=0.6?'warn':'bad'}">${x.how||''} ${Math.round(x.conf*100)}%</span></div>
      <div class="rq">“${esc(x.seg)}”</div>
      <select class="select ru" aria-label="activity"><option value="">— activity 선택 —</option>${opts.map(u=>`<option value="${u}" ${u===x.uid?'selected':''}>${esc(cat[u]?cat[u].label:u)}</option>`).join('')}</select>
      <div class="rv"><select class="select rk" aria-label="구분"><option value="pct" ${x.kind==='pct'?'selected':''}>진척</option><option value="done" ${x.kind==='done'?'selected':''}>완료</option><option value="stop" ${x.kind==='stop'?'selected':''}>중지</option></select>
        <input class="input rp" type="number" min="0" max="100" value="${x.pct??''}" aria-label="진척률" ${x.kind!=='pct'?'hidden':''}><span class="grow"></span>
        <button class="btn" type="button" data-ig>무시</button><button class="btn primary" type="button" data-ok>반영</button></div></div>`}).join('')||'<div class="empty">검토할 회신이 없습니다.</div>';
  $('revList').querySelectorAll('.rev').forEach(el=>{const x=PRJ.review.find(r=>r.id===el.dataset.id);const k=el.querySelector('.rk'),p=el.querySelector('.rp');
    k.addEventListener('change',()=>{p.hidden=k.value!=='pct'});
    el.querySelector('[data-ok]').addEventListener('click',()=>{const u=el.querySelector('.ru').value;if(!u){fileMsg('activity를 골라 주세요.','warn');return}
      x.uid=u;x.kind=k.value;x.pct=k.value==='pct'?Math.round(+p.value||0):k.value==='done'?100:null;x.conf=Math.max(x.conf,0.99);confirmMany([x])});
    el.querySelector('[data-ig]').addEventListener('click',()=>{x.state='ignored';touched();renderSim()})})}
$('revAll').addEventListener('click',()=>{const n=confirmMany((PRJ.review||[]).filter(x=>x.state==='pending'&&x.uid&&x.conf>=0.8));fileMsg(`${n}건을 반영했습니다.`,'ok')});
$('simStart').addEventListener('click',startSim);$('simStop').addEventListener('click',endSim);
$('simDay').addEventListener('click',()=>runDays(1));$('simWeek').addEventListener('click',()=>runDays(7));$('simMonth').addEventListener('click',()=>runDays(30));
$('simScen').innerHTML=Object.entries(SIM.SCEN).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');$('simScen').value='all';
// type a reply as the selected crew (tests the free-text reading by hand)
$('simSend').addEventListener('click',()=>{const t=$('simText').value.trim();if(!t||!simOn())return;const S=PRJ.sim,d=iso(MS(S.date)-DAY);
  const m=addMsg({chat:simChat,from:simChat,at:`${d}T18:30:00+08:00`,kind:'reply',text:t,meta:{manual:true}});takeReply(m);$('simText').value='';touched();renderSim();simChat=m.chat});
$('simText').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey))$('simSend').click()});
// stage 4 hand-off: the bot appends JSON lines to data\inbox\*.jsonl; the app reads them through the same review queue
async function readInbox(){if(!DIRH){fileMsg('먼저 [폴더 연결]로 data 폴더를 연결해 주세요. 수신함 파일은 data\\inbox\\*.jsonl 입니다.','warn');return}
  try{if(!await perm(DIRH))throw new Error('폴더 권한이 없습니다.');const ib=await DIRH.getDirectoryHandle('inbox',{create:true});const seen=new Set((PRJ.msgs||[]).map(m=>m.id));let n=0,bad=0;
    for await(const [name,h] of ib.entries()){if(h.kind!=='file'||!/\.jsonl$/i.test(name))continue;const text=await (await h.getFile()).text();
      for(const line of text.split(/\r?\n/)){if(!line.trim())continue;let o;try{o=JSON.parse(line)}catch(e){bad++;continue}
        const from=typeof o.from==='object'?o.from:{id:o.from};const crew=SIM.CREW.find(c=>c.id===from.id||c.tg&&String(c.tg)===String(from.id)||c.name===from.name);
        const id='ib-'+(o.id||n);if(seen.has(id)||!crew||!o.text||!o.at){if(!crew)bad++;continue}
        const m=addMsg({id,chat:crew.id,from:crew.id,at:o.at,kind:'reply',text:o.text,meta:{inbox:name}});takeReply(m);seen.add(id);n++}}
    touched(n);renderSim();fileMsg(`수신함에서 새 회신 ${n}건을 읽어 검토함에 넣었습니다.${bad?` 읽지 못한 줄 ${bad}개.`:''}`,'ok')}
  catch(e){fileMsg('수신함을 읽지 못했습니다: '+esc(e.message||e),'warn')}}
$('simInbox').addEventListener('click',readInbox);
window.__sim={get busy(){return simBusy},runDays,startSim};
renderSim();
