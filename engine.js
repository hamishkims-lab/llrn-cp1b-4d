
/* LLRN CP1B 4D schedule engine (Rev.2)
   compute(): schedule activities -> structure dates (days from epoch) + shader data table + gantt rows
   cpm():     forward/backward pass on the file's own calendar -> early/late dates, total float, critical path
   Task format: {id,uid,lvl,wbs,name,summary,start:'YYYY-MM-DDTHH:MM',finish,dur(days),milestone,preds:[[uid,type,lagDays]],crit,tf} */
(function(root){
const DAY=864e5, NEVER=1e6, TW=8;
const tms=s=>s?Date.parse(s.length<=10?s+'T00:00:00Z':(s.length===16?s+':00Z':s)):NaN;
function compute(tasks,cfg,st,epoch){
  const T={};for(const t of tasks)T[t.id]=t;
  const warn=[];
  const dnum=ms=>Math.floor((ms-epoch)/DAY);
  const has=i=>i!=null&&!!(T[i]&&T[i].start&&T[i].finish);
  const act=(i,what)=>{if(!has(i)){warn.push(what||('activity '+i));return null}return[tms(T[i].start),tms(T[i].finish)]};
  const iso=d=>new Date(epoch+d*DAY).toISOString().slice(0,10);
  function spread(items,segs){const W=segs.reduce((a,s)=>a+s[2],0),n=items.length,out={};let cum=0;const bounds=[];
    for(const[a,b,w]of segs){bounds.push([cum/W,(cum+w)/W,a,b]);cum+=w}
    items.forEach((it,k)=>{const f=(k+1)/n;for(const[f0,f1,a,b]of bounds)if(f<=f1+1e-9){out[it]=a+(b-a)*((f-f0)/(f1-f0));break}});return out}
  const sup={},span={},viol=[];for(const s of st.supports)sup[s.id]={};for(const s of st.spans)span[s.id]={};
  const spanById={};for(const s of st.spans)spanById[s.id]=s;
  const L=cfg.lag;
  function chain(order,pileSegs,pierA,spanOrder,girdA,deckA){
    const P=spread(order,pileSegs),Q=spread(order,[[...pierA,1]]);
    for(const k of order){const q=Math.max(Q[k],P[k]+L.pile_pier*DAY);if(q>pierA[1]+DAY)viol.push(['pier',k]);sup[k].pile=P[k];sup[k].pier=q}
    const G=girdA?spread(spanOrder,[[...girdA,1]]):null,Dk=spread(spanOrder,[[...deckA,1]]);
    for(const sp of spanOrder){const s=spanById[sp],pr=[sup[s.from].pier,sup[s.to].pier].filter(v=>v!=null);if(!pr.length)continue;let ready=Math.max(...pr)+L.pier_girder*DAY;
      if(G){const g=Math.max(G[sp],ready);if(g>girdA[1]+DAY)viol.push(['girder',sp]);span[sp].girder=g;ready=g+L.girder_deck*DAY}
      const d=Math.max(Dk[sp],ready);if(d>deckA[1]+DAY)viol.push(['deck',sp]);span[sp].deck=d}}
  for(const B of cfg.bridges){
    let spans=B.spans;
    if(!spans){const g=st.spans.filter(s=>s.grp==='SUCAT-BR'&&s.type==='girder').map(s=>s.id);spans=[...g.filter(x=>x.startsWith('SL')),...g.filter(x=>x.startsWith('RC')),...g.filter(x=>x.startsWith('R2'))]}
    const piles=B.pile.map(([id,w],k)=>{const a=act(id,`${B.name} 기초(${k+1})`);return a?[...a,w]:null}).filter(Boolean);
    const pier=act(B.pier,`${B.name} 교각`),deck=act(B.deck,`${B.name} 슬래브`),gird=B.girder!=null?act(B.girder,`${B.name} 거더`):null;
    if(piles.length&&pier&&deck)chain(B.order,piles,pier,spans,gird,deck);
    if(B.name==='BR2-1'){for(const s of st.supports)if(s.kind==='ramp')sup[s.id]={...sup[s.ref]};
      for(const s of st.spans)if(s.ramp)span[s.id]={...span[s.from+'-'+s.to]};}
  }
  // direct mode: every pier / span has its own activities in the schedule (e.g. General Schedule re3)
  if(cfg.direct){
    const fin=(ids,what)=>{if(!ids||!ids.length)return null;const ok=ids.filter(has);if(ok.length<ids.length)warn.push(what);return ok.length?Math.max(...ok.map(i=>tms(T[i].finish))):null};
    for(const[id,d]of Object.entries(cfg.direct.sup)){if(!sup[id])continue;let p=fin(d.pile,`${id} Bored pile`),q=fin(d.pier,`${id} 하부공`);
      if(q==null&&p!=null)q=p+L.pile_pier*DAY;if(p==null&&q!=null)p=q-30*DAY;if(p!=null)sup[id].pile=p;if(q!=null)sup[id].pier=q}
    for(const[id,d]of Object.entries(cfg.direct.span)){if(!span[id])continue;const g=fin(d.girder,`${id} 거더`);let k=fin(d.deck,`${id} 슬래브`);const pv=fin(d.pave,`${id} 포장`);
      if(k==null&&g!=null)k=g+L.girder_deck*DAY;if(g!=null)span[id].girder=g;if(k!=null)span[id].deck=k;if(pv!=null)span[id].pave=pv}
    for(const s of st.supports)if(s.kind==='ramp')sup[s.id]={...sup[s.ref]};
    for(const s of st.spans)if(s.ramp)span[s.id]={...span[s.from+'-'+s.to]};
  }
  const VA=cfg.voided.task==null?null:act(cfg.voided.task,'Sucat Void slab');
  if(VA){const vsp=st.spans.filter(s=>s.type==='voided').map(s=>s.id),V=spread(vsp,[[...VA,1]]);
    for(const sp of vsp){const s=spanById[sp];const fr=sup[s.from].pier,to=sup[s.to].pier;if(fr==null||to==null)continue;
      const r=Math.max(fr,to)+L.void_pier*DAY;const v=Math.max(V[sp],r);if(v>VA[1]+DAY)viol.push(['voidslab',sp]);span[sp].deck=v}}
  const PV=cfg.pave,PA=PV.task==null?null:act(PV.task,'교면 포장');
  if(PA){const[p0,p1]=PA;for(const s of st.spans){const key=s.s0||PV.default;const f=(Math.min(Math.max(key,PV.s0),PV.s1)-PV.s0)/(PV.s1-PV.s0);span[s.id].pave=p0+(p1-p0)*f}}
  const SUP={},SPAN={};
  for(const[k,v]of Object.entries(sup)){SUP[k]={};for(const[a,b]of Object.entries(v))if(b!=null&&isFinite(b))SUP[k][a]=dnum(b)}
  for(const[k,v]of Object.entries(span)){SPAN[k]={};for(const[a,b]of Object.entries(v))if(b!=null&&isFinite(b))SPAN[k][a]=dnum(b)}
  const ZONE={};
  for(const[z,M]of Object.entries(cfg.zones)){const S={};
    for(const[k,ids]of Object.entries(M)){const ok=ids.filter(has);if(ok.length<ids.length)warn.push(`${z} ${k}`);if(!ok.length)continue;
      S[k]=[Math.min(...ok.map(i=>dnum(tms(T[i].start)))),Math.max(...ok.map(i=>dnum(tms(T[i].finish))))]}
    if(S.detour&&S.detour_rm)S.detour=[S.detour[0],S.detour_rm[1]];
    ZONE[z]=S}
  const TR=cfg.trestle,DA=act(TR.dismantle,'가설잔교 해체'),dis=DA?DA.map(dnum):null;
  // trestle: either one activity per segment (r5) or activities per station range with build direction (re3)
  const segd=TR.ranges?null:TR.segs.map((s,i)=>{const a=act(s.task,'가설잔교 설치('+(i+1)+')');return a?a.map(dnum):null});
  const rngd=TR.ranges?TR.ranges.map((r,i)=>{const a=act(r.task,'가설잔교 설치('+(i+1)+')');return a?{...r,d:a.map(dnum)}:null}):null;
  const TRE=st.pieces.map(pc=>{let a0,a1,f;
    if(rngd){const sg=TR.segs[pc.seg],mid=sg.s0+(sg.s1-sg.s0)*pc.fb;const r=rngd.find(r=>r&&mid>=Math.min(r.from,r.to)-1e-6&&mid<=Math.max(r.from,r.to)+1e-6);if(!r)return{a:NEVER,b:NEVER};[a0,a1]=r.d;f=(mid-r.from)/(r.to-r.from)}
    else{const sd=segd[pc.seg];if(!sd)return{a:NEVER,b:NEVER};[a0,a1]=sd;f=pc.fb}
    let a=a0+Math.floor((a1-a0)*f+1e-9),b=dis?dis[0]+Math.floor((dis[1]-dis[0])*pc.fd+1e-9):NEVER;
    for(const z of pc.cz){const ws=ZONE[z]&&ZONE[z].wall?ZONE[z].wall[0]:NEVER;b=Math.min(b,Math.max(a+TR.clamp_min,ws))}return{a,b}});
  const E=st.elems,tab=new Float32Array(E.length*TW*4).fill(NEVER);
  const put=(e,r,v)=>{for(let i=0;i<4;i++)if(v[i]!=null&&isFinite(v[i]))tab[(e*TW+r)*4+i]=v[i]};
  const zs=(S,k)=>S[k]||[NEVER,NEVER];
  let ti=0;
  E.forEach((el,e)=>{
    if(el.k==='pier'){const d=SUP[el.id]||{};put(e,0,[d.pile,d.pier])}
    else if(el.k==='span'){const d=SPAN[el.id]||{};put(e,0,[d.girder??d.deck,d.deck,d.pave])}
    else if(el.k==='zone'){const S=ZONE[el.zid]||{};
      put(e,0,[...zs(S,'wall'),...zs(S,'wallrm')]);put(e,1,[...zs(S,'detour'),...zs(S,'detour_rm')]);
      put(e,2,[...zs(S,'gravel'),...zs(S,'gi')]);put(e,3,[...zs(S,'fill'),...zs(S,'prefill')]);put(e,4,[...zs(S,'prerm'),...zs(S,'pave')])}
    else if(el.k==='tr'){const t=TRE[ti++];put(e,0,[t.a,t.b])}});
  // outline rows for the gantt: skip a single wrapping top summary (project / LLRN P-I)
  const top=tasks.filter(t=>t.lvl===1&&t.name&&t.start);const minL=top.length===1&&top[0].summary?2:1;
  const rows=[],stack=[];
  for(const t of tasks){stack[t.lvl]=t.id;if(t.name&&String(t.name).trim()&&t.start&&t.lvl>=minL)rows.push({id:t.id,lvl:t.lvl,d:t.lvl-minL,name:String(t.name).trim(),s:t.start.slice(0,10),f:t.finish.slice(0,10),sum:!!t.summary,ms:!!t.milestone||+t.dur===0,p:stack[t.lvl-1]})}
  const all=tasks.filter(t=>t.start&&t.finish);
  return {SUP,SPAN,ZONE,TRE,tab,TW,viol,warn:[...new Set(warn)],rows,iso,
    start:all.reduce((a,t)=>t.start<a?t.start:a,'9999').slice(0,10),finish:all.reduce((a,t)=>t.finish>a?t.finish:a,'0000').slice(0,10)};
}
/* ---------- working calendar (read from the schedule file; no editing yet) ---------- */
function makeCal(cal,from,to){
  const work=(cal&&cal.work)||[false,true,true,true,true,true,false];
  const ex=new Map();for(const e of (cal&&cal.exceptions)||[]){for(let d=tms(e.from);d<=tms(e.to);d+=DAY)ex.set(new Date(d).toISOString().slice(0,10),!!e.working)}
  const base=tms(from)-400*DAY,n=Math.ceil((tms(to)-base)/DAY)+2000;const before=new Int32Array(n+1),wd=[];let c=0;
  for(let k=0;k<n;k++){before[k]=c;const ds=new Date(base+k*DAY).toISOString().slice(0,10);const w=ex.has(ds)?ex.get(ds):work[new Date(base+k*DAY).getUTCDay()];if(w){wd.push(ds);c++}}
  before[n]=c;
  const k=ds=>Math.max(0,Math.min(n,Math.round((tms(ds.slice(0,10))-base)/DAY)));
  return {idx:ds=>before[k(ds)], isWork:ds=>{const kk=k(ds);return before[kk+1]>before[kk]}, date:i=>wd[Math.max(0,Math.min(wd.length-1,i))], work, n:wd.length};
}
function cpm(tasks,cal,frozenDD){
  if(frozenDD){const A={};for(const t of tasks)if(!t.summary&&t.act&&t.act.as)A[String(t.uid)]=t.act;
    const r=progress(tasks,cal,A,frozenDD);if(!r)return null;const out={};let same=0,total=0;
    for(const t of tasks){const o=r.byId[t.id];if(!o)continue;total++;const ok=o.es===t.start.slice(0,10)&&o.ef===t.finish.slice(0,10);if(ok)same++;
      out[t.id]={tf:o.tf==null?null:o.tf,crit:o.crit,es:o.es,ef:o.ef,lf:null,ok,state:o.state}}
    return {byId:out,chain:r.chain,finish:r.finish,reproduced:same,total,ignored:0,loops:0,fileCrit:{n:0,agree:0},work:r.work,frozen:frozenDD}}
  const leaves=tasks.filter(t=>!t.summary&&t.start&&t.finish&&t.name!=null&&String(t.name).trim()!=='');
  if(!leaves.length)return null;
  const byU=new Map();for(const t of leaves)byU.set(String(t.uid),t);
  const C=makeCal(cal,leaves.reduce((a,t)=>t.start<a?t.start:a,'9999'),leaves.reduce((a,t)=>t.finish>a?t.finish:a,'0000'));
  const hour=s=>+(s.slice(11,13)||8);
  const S0=t=>t.milestone||+t.dur===0?C.idx(t.start)+(hour(t.start)>=12&&C.isWork(t.start)?1:0):C.idx(t.start);
  const D={};for(const t of leaves)D[t.uid]=Math.max(0,+t.dur||0);
  let ignored=0;const succ=new Map();
  for(const t of leaves)for(const[p,ty,lg]of t.preds||[]){if(!byU.has(String(p))){ignored++;continue}const k=String(p);if(!succ.has(k))succ.set(k,[]);succ.get(k).push([t.uid,ty,+lg||0])}
  // topological order (Kahn); loops are reported and broken
  const indeg=new Map(leaves.map(t=>[String(t.uid),0]));for(const t of leaves)for(const[p]of t.preds||[])if(byU.has(String(p)))indeg.set(String(t.uid),indeg.get(String(t.uid))+1);
  const q=[...indeg].filter(([,v])=>v===0).map(([k])=>k),order=[];
  while(q.length){const u=q.shift();order.push(u);for(const[s]of succ.get(u)||[]){const k=String(s);indeg.set(k,indeg.get(k)-1);if(indeg.get(k)===0)q.push(k)}}
  const loops=leaves.length-order.length;for(const t of leaves)if(!order.includes(String(t.uid)))order.push(String(t.uid));
  const ES={},EF={};
  for(const u of order){const t=byU.get(u),d=D[u],ps=(t.preds||[]).filter(([p])=>byU.has(String(p))&&ES[String(p)]!=null);
    let s=ps.length?-Infinity:S0(t);
    for(const[p,ty,lg]of ps){const k=String(p),a=ES[k],b=EF[k],l=+lg||0;s=Math.max(s,ty==='SS'?a+l:ty==='FF'?b+l-d:ty==='SF'?a+l-d:b+l)}
    ES[u]=s;EF[u]=s+d}
  const PF=Math.max(...Object.values(EF)),LF={};
  for(const u of [...order].reverse()){let f=PF;for(const[s,ty,l]of succ.get(u)||[]){const k=String(s);if(LF[k]==null)continue;const lf=LF[k],ls=lf-D[k],d=D[u];
      f=Math.min(f,ty==='SS'?ls-l+d:ty==='FF'?lf-l:ty==='SF'?lf-l+d:ls-l)}LF[u]=f}
  const out={},eps=1e-6;let same=0;
  for(const u of order){const t=byU.get(u),tf=LF[u]-EF[u],ms=t.milestone||D[u]===0;
    const es=ms?C.date(ES[u]-1):C.date(Math.floor(ES[u])),ef=ms?es:C.date(Math.ceil(EF[u])-1);
    const ok=es===(ms?t.finish:t.start).slice(0,10)&&ef===t.finish.slice(0,10);if(ok)same++;
    out[t.id]={tf:Math.round(tf*100)/100,crit:tf<=eps,es,ef,lf:C.date(Math.ceil(LF[u])-1),ok}}
  // driving chain from the project finish backwards
  const chain=[];let cur=order.filter(u=>Math.abs(EF[u]-PF)<eps&&LF[u]-EF[u]<=eps).sort((a,b)=>ES[b]-ES[a])[0];const seen=new Set();
  while(cur&&!seen.has(cur)){seen.add(cur);const t=byU.get(cur);chain.push(t.id);let best=null;
    for(const[p,ty,lg]of t.preds||[]){const k=String(p);if(!byU.has(k))continue;const l=+lg||0,d=D[cur];
      const v=ty==='SS'?ES[k]+l:ty==='FF'?EF[k]+l-d:ty==='SF'?ES[k]+l-d:EF[k]+l;
      if(Math.abs(v-ES[cur])<eps&&LF[k]-EF[k]<=eps){if(!best||EF[k]>EF[best])best=k}}
    cur=best}
  chain.reverse();
  const fileCrit=leaves.filter(t=>t.crit!=null);const agree=fileCrit.filter(t=>!!t.crit===out[t.id].crit).length;
  return {byId:out,chain,finish:C.date(Math.ceil(PF)-1),reproduced:same,total:leaves.length,ignored,loops,fileCrit:{n:fileCrit.length,agree},work:C.work};
}
function addMonths(iso,m){const d=new Date(tms(iso));const y=d.getUTCFullYear(),mo=d.getUTCMonth()+m,day=d.getUTCDate();const last=new Date(Date.UTC(y,mo+1,0)).getUTCDate();return new Date(Date.UTC(y,mo,Math.min(day,last))).toISOString().slice(0,10)}

/* Commencement shift (Rev.4): every activity — with or without predecessors, summaries included — moves by the same number
   of WORKING days on the schedule file's own calendar, so durations, logic and float are kept exactly.
   newStart on a non-working day is moved to the next working day (reported in .snapped). */
function shiftSchedule(sched,newStart,refId){
  const T=sched.tasks,ref=T.find(t=>t.id===refId)||T.filter(t=>t.start).reduce((a,t)=>!a||t.start<a.start?t:a,null);
  const old=ref.start.slice(0,10);if(!newStart||newStart===old)return{sched,delta:0,old,start:old,snapped:false};
  const lo=[old,newStart].sort()[0],all=T.filter(t=>t.start).map(t=>t.start).concat(T.filter(t=>t.finish).map(t=>t.finish)).sort();
  const span=tms(all[all.length-1])-tms(all[0]);
  const C=makeCal(sched.cal,lo<all[0]?lo:all[0],new Date(Math.max(tms(newStart),tms(old))+span+400*DAY).toISOString().slice(0,10));
  const snapped=!C.isWork(newStart),ns=C.date(C.idx(newStart));const delta=C.idx(ns)-C.idx(old);
  const mv=v=>{if(!v)return v;const d=v.slice(0,10),i=C.idx(d),base=C.date(i),off=Math.round((tms(d)-tms(base))/DAY);
    return new Date(tms(C.date(i+delta))+off*DAY).toISOString().slice(0,10)+v.slice(10)};
  const tasks=T.map(t=>({...t,start:mv(t.start),finish:mv(t.finish)}));
  return{sched:{...sched,tasks,meta:{...sched.meta,shift:{from:old,to:ns,delta}}},delta,old,start:ns,snapped}}
/* ---------- Actual-based schedule (Rev.5, stage 1) ----------
   P6 defaults: Retained logic, duration % complete (remaining = original × (1 − %)), the schedule file's own calendar.
   Data date DD = the last day whose progress is reported; remaining work starts on the next working day.
   actuals: {uid: {as:'YYYY-MM-DD', af:'YYYY-MM-DD'|null, pct:0..100}} — only leaf activities carry actuals. */
function progress(tasks,cal,actuals,dataDate){
  const A=actuals||{},leaves=tasks.filter(t=>!t.summary&&t.start&&t.finish&&t.name!=null&&String(t.name).trim()!=='');
  if(!leaves.length)return null;
  const byU=new Map();for(const t of leaves)byU.set(String(t.uid),t);
  const lo=[dataDate,...leaves.map(t=>t.start)].sort()[0],hi=leaves.reduce((a,t)=>t.finish>a?t.finish:a,dataDate);
  const C=makeCal(cal,lo,new Date(tms(hi)+3*365*DAY).toISOString().slice(0,10));
  const nextDay=d=>new Date(tms(d)+DAY).toISOString().slice(0,10);
  const dd=C.idx(nextDay(dataDate));                       // index of the first working day after the data date
  const hour=s=>+(s.slice(11,13)||8);
  const isMs=t=>t.milestone||+t.dur===0;
  const S0=t=>isMs(t)?C.idx(t.start)+(hour(t.start)>=12&&C.isWork(t.start)?1:0):C.idx(t.start);
  const D={},ST={},RD={},hpd=(cal&&+cal.hpd)||8;
  for(const t of leaves){const u=String(t.uid),a=A[u],d=Math.max(0,+t.dur||0);D[u]=d;
    if(a&&a.af){ST[u]='done'}else if(a&&a.as){ST[u]='run';RD[u]=Math.round(d*(1-Math.min(100,Math.max(0,+a.pct||0))/100)*hpd)/hpd}else ST[u]='todo'}
  const succ=new Map();
  for(const t of leaves)for(const[p,ty,lg]of t.preds||[]){const k=String(p);if(!byU.has(k))continue;if(!succ.has(k))succ.set(k,[]);succ.get(k).push([String(t.uid),ty,+lg||0])}
  const indeg=new Map(leaves.map(t=>[String(t.uid),0]));for(const t of leaves)for(const[p]of t.preds||[])if(byU.has(String(p)))indeg.set(String(t.uid),indeg.get(String(t.uid))+1);
  const q=[...indeg].filter(([,v])=>v===0).map(([k])=>k),order=[];
  while(q.length){const u=q.shift();order.push(u);for(const[s]of succ.get(u)||[]){indeg.set(s,indeg.get(s)-1);if(indeg.get(s)===0)q.push(s)}}
  const inOrder=new Set(order);for(const t of leaves)if(!inOrder.has(String(t.uid)))order.push(String(t.uid));
  const ES={},EF={},RS={};
  for(const u of order){const t=byU.get(u),a=A[u],ps=(t.preds||[]).filter(([p])=>byU.has(String(p))&&ES[String(p)]!=null);
    if(ST[u]==='done'){const ms=isMs(t)||a.as===a.af&&D[u]===0;ES[u]=ms?C.idx(a.af)+1:C.idx(a.as);EF[u]=C.idx(a.af)+1;RS[u]=EF[u];continue}
    if(ST[u]==='run'){ES[u]=C.idx(a.as);let rs=dd;
      for(const[p,ty,lg]of ps){if(ty==='FS'||!ty)rs=Math.max(rs,EF[String(p)]+(+lg||0))}   // retained logic: an open FS predecessor holds the remaining work
      let ef=rs+RD[u];for(const[p,ty,lg]of ps){const k=String(p),l=+lg||0;if(ty==='FF')ef=Math.max(ef,EF[k]+l);if(ty==='SF')ef=Math.max(ef,ES[k]+l)}
      RS[u]=rs;EF[u]=Math.max(ef,dd);continue}
    const d=D[u];let s=Math.max(dd,ps.length?-Infinity:S0(t));
    for(const[p,ty,lg]of ps){const k=String(p),l=+lg||0;s=Math.max(s,ty==='SS'?ES[k]+l:ty==='FF'?EF[k]+l-d:ty==='SF'?ES[k]+l-d:EF[k]+l)}
    ES[u]=s;RS[u]=s;EF[u]=s+d}
  const PF=Math.max(...Object.values(EF)),LF={};
  for(const u of [...order].reverse()){if(ST[u]==='done')continue;let f=PF;
    for(const[s,ty,l]of succ.get(u)||[]){if(LF[s]==null)continue;const rem=ST[s]==='run'?RD[s]:D[s],ls=LF[s]-rem,d=ST[u]==='run'?RD[u]:D[u];
      if(ST[s]==='run'&&(ty==='SS'||ty==='SF'))continue;
      f=Math.min(f,ty==='SS'?ls-l+d:ty==='FF'?LF[s]-l:ty==='SF'?LF[s]-l+d:ls-l)}LF[u]=f}
  const out={};
  for(const u of order){const t=byU.get(u),a=A[u]||{},ms=isMs(t)&&ST[u]!=='done';
    const es=ST[u]==='todo'?(ms?C.date(ES[u]-1):C.date(Math.floor(ES[u]))):a.as;
    const ef=ST[u]==='done'?a.af:ms?es:C.date(Math.ceil(EF[u])-1);
    const tf=ST[u]==='done'?null:Math.round((LF[u]-EF[u])*100)/100;
    out[t.id]={uid:u,state:ST[u],es,ef,rs:ST[u]==='run'?C.date(Math.floor(RS[u])):null,pct:ST[u]==='done'?100:ST[u]==='run'?Math.min(100,+a.pct||0):0,tf,crit:tf!=null&&tf<=1e-6,
      dfin:C.idx(nextDay(ef))-C.idx(nextDay(t.finish.slice(0,10)))}}   // finish variance vs plan in working days (+ = late)
  // forecast copy of the schedule: leaves take actual / forecast dates, summaries roll up their children
  const ft=tasks.map(t=>{const o=out[t.id];return o?{...t,start:o.es+'T08:00',finish:o.ef+'T17:00'}:{...t}});
  for(let i=ft.length-1;i>=0;i--){const t=ft[i];if(!t.summary)continue;let s=null,f=null;
    for(let j=i+1;j<ft.length&&ft[j].lvl>t.lvl;j++){const c=ft[j];if(c.summary||!c.start)continue;if(!s||c.start<s)s=c.start;if(!f||c.finish>f)f=c.finish}
    if(s){t.start=s;t.finish=f}}
  const n={done:0,run:0,todo:0};for(const u of order)n[ST[u]]++;
  // driving chain backwards from the forecast finish (stops at the data date or at an activity already under way)
  const eps=1e-6,chain=[],seen=new Set();let cu=order.filter(u=>ST[u]!=='done'&&Math.abs(EF[u]-PF)<eps&&LF[u]-EF[u]<=eps).sort((a,b)=>ES[b]-ES[a])[0];
  while(cu&&!seen.has(cu)){seen.add(cu);const t=byU.get(cu);chain.push(t.id);if(ST[cu]==='done')break;let best=null;
    for(const[p,ty,lg]of t.preds||[]){const k=String(p);if(!byU.has(k)||ST[k]==='done'||LF[k]==null)continue;const l=+lg||0,d=D[cu];
      const v=ST[cu]==='run'?(ty==='FS'||!ty?EF[k]+l:-1e9):ty==='SS'?ES[k]+l:ty==='FF'?EF[k]+l-d:ty==='SF'?ES[k]+l-d:EF[k]+l;
      const tgt=ST[cu]==='run'?RS[cu]:ES[cu];if(Math.abs(v-tgt)<eps&&LF[k]-EF[k]<=eps){if(!best||EF[k]>EF[best])best=k}}
    cu=best}
  chain.reverse();
  return {byId:out,finish:C.date(Math.ceil(PF)-1),dataDate,dd:C.date(dd),tasks:ft,count:n,chain,work:C.work}
}
/* duration-weighted % complete at time t (ms) — plan curve from the baseline, actual/forecast curve from progress() */
function curve(base,prog,dataDate,points,frozenDD){
  const fEnd=frozenDD?tms(frozenDD)+DAY:null;   // revised baseline: its past is the actual record (t.act) up to its own data date
  const L=base.filter(t=>!t.summary&&t.start&&t.finish&&String(t.name||'').trim());
  const w=L.map(t=>Math.max(DAY,tms(t.finish.slice(0,10))+DAY-tms(t.start.slice(0,10))));const W=w.reduce((a,b)=>a+b,0);
  const ddEnd=tms(dataDate)+DAY;
  const lin=(t,a,b)=>t<=a?0:t>=b?1:(t-a)/(b-a);
  return points.map(t=>{let p=0,a=0;
    L.forEach((x,i)=>{const xs=tms(x.start.slice(0,10)),xf=tms(x.finish.slice(0,10))+DAY;
      if(fEnd&&x.act&&x.act.as&&!x.act.af){const pc=(+x.act.pct||0)/100;p+=w[i]*(t<=fEnd?pc*lin(t,xs,fEnd):pc+(1-pc)*lin(t,fEnd,xf))}else p+=w[i]*lin(t,xs,xf);
      if(!prog)return;const o=prog.byId[x.id];if(!o)return;const s=tms(o.es),f=tms(o.ef)+DAY;let v;
      if(o.state==='done')v=lin(t,s,f);
      else if(o.state==='run'){const pc=o.pct/100;v=t<=ddEnd?pc*lin(t,s,ddEnd):pc+(1-pc)*lin(t,tms(o.rs),f)}
      else v=lin(t,s,f);
      a+=w[i]*v});
    return {t,plan:p/W*100,act:prog?a/W*100:null}})}
function rebaseline(tasks,cal,actuals,dataDate){const r=progress(tasks,cal,actuals,dataDate);if(!r)return null;
  const C=makeCal(cal,'2000-01-01',new Date(tms(r.finish)+400*DAY).toISOString().slice(0,10));
  const wd=(a,b)=>Math.max(0,C.idx(new Date(tms(b)+DAY).toISOString().slice(0,10))-C.idx(a));
  const nt=r.tasks.map(t=>{const o=r.byId[t.id];if(!o||t.summary)return {...t};const a=actuals[String(t.uid)];const x={...t,crit:o.crit,tf:o.tf};delete x.act;
    if(o.state==='done'){x.dur=wd(o.es,o.ef);x.act={as:a.as,af:a.af,pct:100}}
    else if(o.state==='run')x.act={as:a.as,af:null,pct:+a.pct||0};   // planned duration kept: the remaining work = dur × (1 − %) as before
    return x});
  return {tasks:nt,finish:r.finish,count:r.count}}
root.LLRNEngine={compute,cpm,progress,curve,rebaseline,makeCal,addMonths,shiftSchedule,NEVER,TW,DAY,tms};
if(typeof module!=='undefined')module.exports=root.LLRNEngine;
})(typeof window!=='undefined'?window:globalThis);

