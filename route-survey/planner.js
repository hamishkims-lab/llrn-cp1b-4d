/* =================================================================
   경로 직접 설정 — 경유지 · 차량 회전 궤적 · 트럭 밴 · 도로 제한
   ================================================================= */
const PL_OSRM = 'https://router.project-osrm.org';
const PL_OVP  = 'https://overpass-api.de/api/interpreter';
const PLC = {route:'#0f6fff', dark:'#1d1f24', sweep:'#00bdde', danger:'#e63b3b', warning:'#ffa833', success:'#15b874', na:'#8a8a8a'};
const VERD = {danger:['danger','곤란'], warning:['warning','조건부'], success:['success','양호'], na:['','미확인']};
const vbadge = v => { const [t,l]=VERD[v]||VERD.na; return `<span class="gs-badge${t?' gs-badge--'+t:''}"><span class="gs-badge__dot"></span>${l}</span>`; };

/* ---------- 차량 ---------- */
const DPWH_LIMIT = {'2a6w':['2축 6W 단차',18000],'3a10w':['3축 10W 단차',33300],'4a14w':['4축 14W 단차',35600],'semi32':['세미트레일러 3+2축',41500],'semi33':['세미트레일러 3+3축',42000]};
const VEH_PRESETS = {
  mixer6:{name:'레미콘 믹서트럭 6m³ (3축 10W)',type:'rigid',W:2.5,H:3.7,GVW:25000,cfg:'3a10w',fo:1.4,wb:4.6,ro:2.5,Ro:8.5},
  mixer4:{name:'레미콘 믹서트럭 4m³ (2축 6W)',type:'rigid',W:2.3,H:3.3,GVW:16000,cfg:'2a6w',fo:1.2,wb:3.8,ro:1.8,Ro:7.5},
  dump:{name:'덤프트럭 15t (3축 10W)',type:'rigid',W:2.5,H:3.3,GVW:33000,cfg:'3a10w',fo:1.4,wb:4.3,ro:2.3,Ro:8.3},
  pump:{name:'콘크리트 펌프카 36m급 (3축)',type:'rigid',W:2.5,H:4.0,GVW:30000,cfg:'3a10w',fo:1.5,wb:6.0,ro:3.0,Ro:10.5},
  crane:{name:'카고크레인(붐트럭) 11t (3축)',type:'rigid',W:2.5,H:3.6,GVW:25000,cfg:'3a10w',fo:1.4,wb:6.0,ro:2.6,Ro:10.0},
  semi40:{name:'세미트레일러 40ft 평판 (3+3축)',type:'semi',W:2.5,H:4.0,GVW:42000,cfg:'semi33',fo:1.4,wb:4.2,ko:0.5,tfo:1.2,tw:8.8,tro:2.2,Ro:8.5},
  lowbed:{name:'로우베드 중장비 운반 (3+3축)',type:'semi',W:3.0,H:4.3,GVW:45000,cfg:'semi33',fo:1.4,wb:4.2,ko:0.5,tfo:1.0,tw:10.5,tro:2.0,Ro:8.5},
  light:{name:'소형 트럭 (총중량 4.5t 이하)',type:'rigid',W:2.0,H:2.7,GVW:4500,cfg:'2a6w',fo:1.0,wb:3.4,ro:1.4,Ro:6.5},
  custom:{name:'사용자 정의',type:'rigid',W:2.5,H:3.5,GVW:20000,cfg:'3a10w',fo:1.4,wb:5.0,ro:2.0,Ro:9.0}
};
const VEH_FIELDS = {
  rigid:[['W','차폭 (m)'],['H','높이·적재고 (m)'],['GVW','총중량 (kg)'],['Ro','최소회전반경 외측 앞바퀴 (m)'],['fo','앞 오버행 (m)'],['wb','축간거리 앞축~뒤축 중심 (m)'],['ro','뒤 오버행 (m)']],
  semi:[['W','차폭 (m)'],['H','높이·적재고 (m)'],['GVW','총중량 (kg)'],['Ro','최소회전반경 외측 앞바퀴 (m)'],['fo','트랙터 앞 오버행 (m)'],['wb','트랙터 축간거리 (m)'],['ko','킹핀 위치 뒤축 중심 앞쪽 (m)'],['tfo','트레일러 앞 오버행 킹핀 앞 (m)'],['tw','킹핀~트레일러 축 중심 (m)'],['tro','트레일러 뒤 오버행 (m)']]
};
let VEH = Object.assign({key:'mixer6'}, JSON.parse(JSON.stringify(VEH_PRESETS.mixer6)));
const vehLen = v => v.type==='semi' ? v.fo+v.wb-v.ko+v.tw+v.tro : v.fo+v.wb+v.ro;

/* ---------- 공통 유틸 ---------- */
const esc = s => String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const f1 = x => (Math.round(x*10)/10).toFixed(1);
const fmtC = p => `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`;
const kmTxt = m => m>=1000 ? `${f1(m/1000)} km` : `${Math.round(m)} m`;
const pad2 = n => String(n).padStart(2,'0');
const hhmm = d => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const DOW = ['일','월','화','수','목','금','토'];
function hav(a,b){const t=Math.PI/180,dl=(b.lat-a.lat)*t,dn=(b.lng-a.lng)*t;const x=Math.sin(dl/2)**2+Math.cos(a.lat*t)*Math.cos(b.lat*t)*Math.sin(dn/2)**2;return 2*6371008*Math.asin(Math.min(1,Math.sqrt(x)));}
function brg(a,b){const t=Math.PI/180,y=Math.sin((b.lng-a.lng)*t)*Math.cos(b.lat*t),x=Math.cos(a.lat*t)*Math.sin(b.lat*t)-Math.sin(a.lat*t)*Math.cos(b.lat*t)*Math.cos((b.lng-a.lng)*t);return (Math.atan2(y,x)/t+360)%360;}
const angDiff = (a,b) => ((b-a)%360+540)%360-180; // + = 오른쪽(시계방향)
function projector(o){const kx=Math.cos(o.lat*Math.PI/180)*111320,ky=110574;return{to:p=>({x:(p.lng-o.lng)*kx,y:(p.lat-o.lat)*ky}),back:q=>({lat:o.lat+q.y/ky,lng:o.lng+q.x/kx})};}
function segDist(px,py,a,b){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy;let t=l?((px-a.x)*dx+(py-a.y)*dy)/l:0;t=Math.max(0,Math.min(1,t));const x=a.x+t*dx-px,y=a.y+t*dy-py;return Math.sqrt(x*x+y*y);}
function signedLat(p,line){ // + = 왼쪽, 가장 가까운 세그먼트 인덱스 포함
  let best=Infinity,bi=0,sg=1;
  for(let i=0;i<line.length-1;i++){const a=line[i],b=line[i+1];const d=segDist(p.x,p.y,a,b);if(d<best){best=d;bi=i;sg=((b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x))>=0?1:-1;}}
  return {d:best*sg,i:bi};
}
function resample(p,step){const out=[{x:p[0].x,y:p[0].y}];let rem=step;for(let i=1;i<p.length;i++){let ax=p[i-1].x,ay=p[i-1].y;const bx=p[i].x,by=p[i].y;let seg=Math.hypot(bx-ax,by-ay);while(seg>=rem&&seg>0){const t=rem/seg;ax+=(bx-ax)*t;ay+=(by-ay)*t;out.push({x:ax,y:ay});seg-=rem;rem=step;}rem-=seg;}return out;}
function offsetPath(p,d){if(!d)return p.slice();const n=p.length,out=[];for(let i=0;i<n;i++){const a=p[Math.max(0,i-6)],b=p[Math.min(n-1,i+6)];let tx=b.x-a.x,ty=b.y-a.y;const l=Math.hypot(tx,ty)||1;tx/=l;ty/=l;out.push({x:p[i].x-ty*d,y:p[i].y+tx*d});}return out;}
function toast(msg){let t=document.getElementById('gs-toast');if(!t){t=document.createElement('div');t.id='gs-toast';t.className='gs-toast';t.setAttribute('role','status');document.body.appendChild(t);}t.textContent=msg;t.hidden=false;clearTimeout(t._h);t._h=setTimeout(()=>{t.hidden=true;},2400);}
async function copyText(s){try{await navigator.clipboard.writeText(s);return true;}catch(e){const ta=document.createElement('textarea');ta.value=s;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();let ok=false;try{ok=document.execCommand('copy');}catch(_){}ta.remove();return ok;}}
const lsGet=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){return false;}};

function parseCoord(s){
  if(!s) return null; s=String(s).trim(); if(!s) return null;
  const dms=s.match(/(\d+)°\s*(\d+)['′]\s*([\d.]+)["″]?\s*([NS])[\s,]+(\d+)°\s*(\d+)['′]\s*([\d.]+)["″]?\s*([EW])/i);
  if(dms){const la=(+dms[1]+dms[2]/60+dms[3]/3600)*(/s/i.test(dms[4])?-1:1),lo=(+dms[5]+dms[6]/60+dms[7]/3600)*(/w/i.test(dms[8])?-1:1);return {lat:+la.toFixed(6),lng:+lo.toFixed(6)};}
  const at=s.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  const q=s.match(/[?&](?:q|query|ll|destination|origin)=(-?\d+(?:\.\d+)?)(?:,|%2C)\s*(-?\d+(?:\.\d+)?)/i);
  const nums=at?[at[1],at[2]]:q?[q[1],q[2]]:(s.match(/-?\d+(?:\.\d+)?/g)||[]);
  if(nums.length<2) return null;
  let a=parseFloat(nums[0]),b=parseFloat(nums[1]);
  if(Math.abs(a)>90&&Math.abs(b)<=90)[a,b]=[b,a];
  if(!isFinite(a)||!isFinite(b)||Math.abs(a)>90||Math.abs(b)>180) return null;
  return {lat:+a.toFixed(6),lng:+b.toFixed(6)};
}

/* ---------- 외부 서비스 ---------- */
const PL = {pts:[],mode:'via',map:null,lay:{},ptMarkers:[],turnMarkers:{},token:0,timer:null,cache:new Map(),res:null,sel:-1,svdir:'in',inited:false,ovpChain:Promise.resolve(),ovpCache:new Map()};
const newPt = (lat=null,lng=null,mode='road') => ({lat,lng,text:'',err:false,mode,cands:null,choice:'auto',candState:''});

function ovp(q,lane){
  if(PL.ovpCache.has(q)) return Promise.resolve(PL.ovpCache.get(q));
  const run = async () => {
    const ac=new AbortController(); const tm=setTimeout(()=>ac.abort(),70000);
    try{
      const r=await fetch(PL_OVP,{method:'POST',body:'data='+encodeURIComponent(q),headers:{'Content-Type':'application/x-www-form-urlencoded'},signal:ac.signal});
      if(!r.ok) throw new Error('overpass '+r.status);
      const j=await r.json(); PL.ovpCache.set(q,j); return j;
    } finally { clearTimeout(tm); }
  };
  const key=lane==='slow'?'ovpSlow':'ovpChain'; if(!PL[key]) PL[key]=Promise.resolve();
  const p = PL[key].then(run,run);
  PL[key] = p.catch(()=>{});
  return p;
}
function splitSep(elements){const groups=[[]];elements.forEach(e=>{if(e.type==='sep')groups.push([]);else groups[groups.length-1].push(e);});return groups;}

async function osrmJSON(url){
  if(PL.cache.has(url)) return PL.cache.get(url);
  const r=await fetch(url); const j=await r.json();
  if(j.code!=='Ok'){const e=new Error(j.code);e.code=j.code;e.msgRaw=j.message;throw e;}
  PL.cache.set(url,j); return j;
}

/* ---------- 도로 후보 (고가 / 지상) ---------- */
function levelOf(t,name){
  t=t||{}; const layer=parseFloat(t.layer||'0')||0, hw=t.highway||'';
  const exp=/motorway/.test(hw)||/expressway|skyway|expy|slex|nlex|cavitex|tollway/i.test(name||'');
  if((t.tunnel&&t.tunnel!=='no')||layer<0) return {code:'under',label:'지하'};
  if((t.bridge&&t.bridge!=='no')||layer>0) return {code:'elev',label:exp?'고가·고속도로':'고가'};
  if(exp) return {code:'mway',label:'고속도로'};
  return {code:'ground',label:'지상'};
}
function nearestWay(ways,loc,name){
  if(!ways||!ways.length) return null;
  const P=projector(loc); let best=null,bd=Infinity,bestN=null,bdN=Infinity;
  ways.forEach(w=>{ if(!w.geometry) return; const g=w.geometry.map(q=>P.to({lat:q.lat,lng:q.lon}));
    let d=Infinity; for(let i=0;i<g.length-1;i++) d=Math.min(d,segDist(0,0,g[i],g[i+1]));
    if(d<bd){bd=d;best=w;} if(name&&w.tags&&w.tags.name===name&&d<bdN){bdN=d;bestN=w;} });
  return (bestN&&bdN<=bd+4)?bestN:best;
}
async function plFetchCands(p){
  if(p.lat==null) return;
  const key=fmtC(p); p._ck=key; p.candState='loading'; plRenderRows();
  try{
    const n=await osrmJSON(`${PL_OSRM}/nearest/v1/driving/${p.lng},${p.lat}?number=10`);
    let ways=[];
    try{ const j=await ovp(`[out:json][timeout:25];way(around:45,${p.lat},${p.lng})[highway][highway!~"^(footway|path|steps|cycleway|pedestrian|corridor|bridleway|platform)$"];out tags geom;`); ways=j.elements.filter(e=>e.type==='way'); }catch(e){}
    if(p._ck!==key) return;
    const seen=new Map();
    n.waypoints.forEach(w=>{
      const loc={lat:w.location[1],lng:w.location[0]}; const way=nearestWay(ways,loc,w.name); const tags=way?way.tags:{};
      const lvl=levelOf(tags,w.name); const k=(w.name||'')+'|'+lvl.code;
      if(!seen.has(k)) seen.set(k,{name:w.name||'(이름 없는 도로)',dist:w.distance,hint:w.hint,loc,lvl,hw:tags.highway||'',lanes:tags.lanes||'',layer:tags.layer||''});
    });
    p.cands=[...seen.values()].slice(0,6); p.candState='';
    if(p.choice!=='auto'&&!p.cands[+p.choice]) p.choice='auto';
  }catch(e){ if(p._ck!==key) return; p.cands=null; p.candState='error'; }
  plRenderRows(); plSchedule(50);
}
function chosenCand(p){
  if(!p.cands||!p.cands.length) return null;
  if(p.choice!=='auto') return p.cands[+p.choice]||null;
  if(document.getElementById('pl-ground').checked){
    const hasElev=p.cands.some(c=>c.lvl.code!=='ground'&&c.dist<=40);
    if(hasElev) return p.cands.find(c=>c.lvl.code==='ground'&&c.dist<=40)||null;
  }
  return null;
}

/* ---------- 지점 목록 UI ---------- */
function ptTag(i){const n=PL.pts.length;return i===0?'출발':i===n-1?'도착':'V'+i;}
function plRenderRows(){
  const list=document.getElementById('pl-list'); const n=PL.pts.length;
  list.innerHTML=PL.pts.map((p,i)=>{
    const kind=i===0?'start':i===n-1?'end':'via', tag=ptTag(i);
    let cand='';
    if(p.candState==='loading') cand='<div class="hint">주변 도로 확인 중…</div>';
    else if(p.candState==='error') cand='<div class="hint">주변 도로 정보를 불러오지 못했습니다. 가장 가까운 도로로 계산합니다.</div>';
    else if(p.cands&&p.cands.length>1){
      const ch=chosenCand(p);
      cand=`<label class="pt-seg pt-seg--block" style="margin-top:8px">붙일 도로 <select class="gs-select gs-select--sm" data-f="choice">
        <option value="auto"${p.choice==='auto'?' selected':''}>자동${ch&&p.choice==='auto'?` (${esc(ch.name)} · ${ch.lvl.label})`:' (가장 가까운 도로)'}</option>
        ${p.cands.map((c,k)=>`<option value="${k}"${String(p.choice)===String(k)?' selected':''}>${esc(c.name)} · ${c.lvl.label} · ${Math.round(c.dist)} m</option>`).join('')}
      </select></label>`;
    }
    return `<div class="pt-row" data-i="${i}">
      <div class="pt-row__top"><span class="pt-tag pt-tag--${kind}">${tag}</span>
        <input class="gs-input${p.err?' is-error':''}" data-f="coord" value="${p.lat!=null?fmtC(p):esc(p.text)}" placeholder="${kind==='via'?'경유지':'좌표'} 예: 14.426705, 121.019811" aria-label="${tag} 좌표"></div>
      ${p.err?'<div class="field-error">좌표 형식을 확인하십시오. 예: 14.426705, 121.019811</div>':''}
      ${cand}
      <div class="pt-row__bottom">
        ${i<n-1?`<label class="pt-seg">다음 구간 <select class="gs-select gs-select--sm" data-f="mode"><option value="road"${p.mode!=='line'?' selected':''}>도로 따라</option><option value="line"${p.mode==='line'?' selected':''}>직선 연결</option></select></label>`:'<span class="pt-seg">최종 도착지</span>'}
        <span class="pt-actions">
          <button class="gs-btn gs-btn--sm gs-btn--ghost" type="button" data-a="up"${i===0?' disabled':''}>위로</button>
          <button class="gs-btn gs-btn--sm gs-btn--ghost" type="button" data-a="down"${i===n-1?' disabled':''}>아래로</button>
          <button class="gs-btn gs-btn--sm gs-btn--ghost" type="button" data-a="${kind==='via'?'del':'clear'}">${kind==='via'?'삭제':'지우기'}</button>
        </span></div></div>`;
  }).join('');
}
function plSetPt(p,c){ p.lat=c.lat; p.lng=c.lng; p.text=''; p.err=false; p.cands=null; p.choice='auto'; plFetchCands(p); }
function plChanged(delay){ plRenderRows(); plSyncMarkers(); plSaveDraft(); plSchedule(delay); }
function plSchedule(delay=350){ clearTimeout(PL.timer); PL.timer=setTimeout(plCalc,delay); }
function plStatus(msg,err){ const s=document.getElementById('pl-status'); s.textContent=msg||''; s.classList.toggle('is-error',!!err); }

function plBindForm(){
  const list=document.getElementById('pl-list');
  list.addEventListener('change',e=>{
    const row=e.target.closest('.pt-row'); if(!row) return; const p=PL.pts[+row.dataset.i];
    if(e.target.dataset.f==='coord'){ const v=e.target.value.trim(); if(!v){Object.assign(p,newPt(null,null,p.mode));} else { const c=parseCoord(v); if(c) plSetPt(p,c); else {p.lat=null;p.lng=null;p.text=v;p.err=true;} } plChanged(); }
    else if(e.target.dataset.f==='mode'){ p.mode=e.target.value; plChanged(50); }
    else if(e.target.dataset.f==='choice'){ p.choice=e.target.value; plChanged(50); }
  });
  list.addEventListener('keydown',e=>{ if(e.key==='Enter'&&e.target.dataset.f==='coord') e.target.blur(); });
  list.addEventListener('click',e=>{
    const b=e.target.closest('button[data-a]'); if(!b) return; const i=+b.closest('.pt-row').dataset.i, a=b.dataset.a, P=PL.pts;
    if(a==='up'&&i>0) [P[i-1],P[i]]=[P[i],P[i-1]];
    else if(a==='down'&&i<P.length-1) [P[i+1],P[i]]=[P[i],P[i+1]];
    else if(a==='del') P.splice(i,1);
    else if(a==='clear') P[i]=newPt(null,null,P[i].mode);
    plChanged(100);
  });
  document.getElementById('pl-add').addEventListener('click',()=>{ PL.pts.splice(PL.pts.length-1,0,newPt()); plRenderRows(); const ins=document.querySelectorAll('#pl-list .pt-row')[PL.pts.length-2]; ins&&ins.querySelector('input').focus(); });
  document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{
    const k=b.dataset.preset;
    if(k==='reset') PL.pts=[newPt(),newPt()];
    else { const o=ORIGINS[k]; PL.pts=[newPt(),newPt()]; plSetPt(PL.pts[0],{lat:o.lat,lng:o.lng}); plSetPt(PL.pts[1],{lat:14.419006,lng:121.051798}); }
    plChanged(100); plFit();
  }));
  document.querySelectorAll('.seg [data-mode]').forEach(b=>b.addEventListener('click',()=>{
    PL.mode=b.dataset.mode; document.querySelectorAll('.seg [data-mode]').forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false'));
    document.getElementById('map-planner').classList.toggle('is-picking',PL.mode!=='off');
  }));
  ['pl-uturn','pl-ground','pl-keepright'].forEach(id=>document.getElementById(id).addEventListener('change',()=>{ if(id==='pl-ground') plRenderRows(); plSchedule(50); }));
  document.getElementById('pl-ref').addEventListener('change',e=>{ if(!PL.map) return; if(e.target.checked) PL.lay.ref.addTo(PL.map); else PL.lay.ref.remove(); });
  document.getElementById('pl-calc').addEventListener('click',()=>{ PL.cache.clear(); plCalc(); });
  ['pl-depart','pl-cargo','pl-factor'].forEach(id=>document.getElementById(id).addEventListener('change',()=>{ if(PL.res){ banEvaluate(PL.res); plRenderBan(); plRenderSteps(); } }));
  document.getElementById('pl-save').addEventListener('click',plSaveRoute);
  document.getElementById('pl-copy').addEventListener('click',async()=>{ const s=PL.pts.filter(p=>p.lat!=null).map((p,i)=>`${ptTag(PL.pts.indexOf(p))}\t${fmtC(p)}`).join('\n'); toast(await copyText(s)?'좌표를 복사했습니다.':'복사하지 못했습니다.'); });
  document.getElementById('pl-link').addEventListener('click',async()=>{ const url=location.href.split('#')[0]+'#plan='+encodeURIComponent(JSON.stringify(plSerialize())); toast(await copyText(url)?'경로 링크를 복사했습니다. 이 HTML 파일을 받은 사람이 링크 뒤 부분을 붙여 열 수 있습니다.':'복사하지 못했습니다.'); });
  document.getElementById('pd-prev').addEventListener('click',()=>plStepSel(-1));
  document.getElementById('pd-next').addEventListener('click',()=>plStepSel(1));
  document.querySelectorAll('[data-svdir]').forEach(b=>b.addEventListener('click',()=>{ PL.svdir=b.dataset.svdir; document.querySelectorAll('[data-svdir]').forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false')); plRenderDetail(true); }));
  document.getElementById('pd-ask').addEventListener('click',async()=>{ const r=PL.res&&PL.res.rows[PL.sel]; if(!r) return; toast(await copyText(askText(r))?'검토 요청 문구를 복사했습니다. Claude 대화창에 붙여넣으십시오.':'복사하지 못했습니다.'); });
}

/* ---------- 차량 UI ---------- */
function vehInit(){
  const sel=document.getElementById('veh-preset');
  sel.innerHTML=Object.entries(VEH_PRESETS).map(([k,v])=>`<option value="${k}">${esc(v.name)}</option>`).join('');
  sel.value=VEH.key;
  sel.addEventListener('change',()=>{ const k=sel.value; VEH=Object.assign({key:k},JSON.parse(JSON.stringify(VEH_PRESETS[k]))); vehRender(); vehChanged(); });
  document.getElementById('veh-form').addEventListener('change',e=>{
    const f=e.target.dataset.v; if(!f) return;
    if(f==='type'){ const t=e.target.value; VEH.type=t; if(t==='semi'){ VEH.ko=VEH.ko??0.5; VEH.tfo=VEH.tfo??1.2; VEH.tw=VEH.tw??8.8; VEH.tro=VEH.tro??2.2; } vehRender(); }
    else if(f==='cfg') VEH.cfg=e.target.value;
    else { const v=parseFloat(e.target.value); if(isFinite(v)&&v>=0) VEH[f]=v; else e.target.value=VEH[f]; }
    vehRender(true); vehChanged();
  });
  vehRender();
}
function vehRender(keepForm){
  document.getElementById('veh-preset').value=VEH.key;
  if(!keepForm){
    const fields=VEH_FIELDS[VEH.type];
    document.getElementById('veh-form').innerHTML=
      `<label>차량 형식<select class="gs-select gs-select--sm" data-v="type"><option value="rigid"${VEH.type==='rigid'?' selected':''}>단차(트럭)</option><option value="semi"${VEH.type==='semi'?' selected':''}>세미트레일러</option></select></label>
       <label>축 구성 (DPWH 한도)<select class="gs-select gs-select--sm" data-v="cfg">${Object.entries(DPWH_LIMIT).map(([k,v])=>`<option value="${k}"${VEH.cfg===k?' selected':''}>${v[0]} · ${v[1].toLocaleString()} kg</option>`).join('')}</select></label>`+
      fields.map(([k,l])=>`<label>${l}<input class="gs-input gs-input--sm gs-num" type="number" step="${k==='GVW'?100:0.1}" min="0" data-v="${k}" value="${VEH[k]}"></label>`).join('');
  }
  const L=vehLen(VEH);
  document.getElementById('veh-summary').textContent=`전장 약 ${f1(L)} m · 폭 ${f1(VEH.W)} m · 높이 ${f1(VEH.H)} m · 총중량 ${Math.round(VEH.GVW).toLocaleString()} kg · 최소회전반경 ${f1(VEH.Ro)} m`;
  // 평면 개략도
  const svg=document.getElementById('veh-svg'), s=380/Math.max(L,6), cy=45, h=Math.min(40,VEH.W*s), x0=10;
  const rect=(x,w,cls)=>`<rect x="${x}" y="${cy-h/2}" width="${w}" height="${h}" rx="3" fill="${cls}" fill-opacity=".25" stroke="${cls}" stroke-width="1.5"/>`;
  const axle=(x)=>`<line x1="${x}" y1="${cy-h/2-5}" x2="${x}" y2="${cy+h/2+5}" stroke="currentColor" stroke-width="3"/>`;
  let g='';
  if(VEH.type==='semi'){
    const kx=x0+(VEH.fo+VEH.wb-VEH.ko)*s;
    g+=rect(x0,(VEH.fo+VEH.wb+1.0)*s,PLC.dark)+rect(kx-VEH.tfo*s,(VEH.tfo+VEH.tw+VEH.tro)*s,PLC.sweep)+axle(x0+VEH.fo*s)+axle(x0+(VEH.fo+VEH.wb)*s)+axle(kx+VEH.tw*s)+`<circle cx="${kx}" cy="${cy}" r="3" fill="currentColor"/>`;
  } else g+=rect(x0,L*s,PLC.sweep)+axle(x0+VEH.fo*s)+axle(x0+(VEH.fo+VEH.wb)*s);
  g+=`<text x="${x0}" y="86" font-size="11" fill="currentColor">진행 방향 ←  전장 ${f1(L)} m</text>`;
  svg.innerHTML=g; svg.style.color='var(--color-text-secondary)';
}
function vehChanged(){ plSaveDraft(); if(PL.res){ analyzeTurns(PL.res); plDraw(); plRenderResult(); if(PL.sel>=0) plSelect(PL.sel,false); } }

/* ---------- 지도 ---------- */
function plInit(){
  if(PL.inited){ setTimeout(()=>PL.map&&PL.map.invalidateSize(),60); return; }
  PL.inited=true;
  const layers=baseLayers();
  const m=L.map('map-planner',{layers:[layers['위성(Google)']],maxZoom:21});
  L.control.layers(layers,null,{collapsed:true}).addTo(m);
  L.control.scale({imperial:false,position:'bottomleft'}).addTo(m);
  PL.map=m;
  PL.lay.ref=L.layerGroup([L.polyline(ROUTES.r1,{color:COLOR.r1,weight:3,opacity:.7,dashArray:'6 6'}),L.polyline(ROUTES.r2,{color:COLOR.r2,weight:3,opacity:.7,dashArray:'6 6'})]);
  if(document.getElementById('pl-ref').checked) PL.lay.ref.addTo(m);
  PL.lay.route=L.layerGroup().addTo(m); PL.lay.turns=L.layerGroup().addTo(m); PL.lay.sweep=L.layerGroup().addTo(m); PL.lay.pts=L.layerGroup().addTo(m); PL.lay.flags=L.layerGroup().addTo(m);
  m.on('click',plMapClick);
  m.fitBounds(L.latLngBounds(ROUTES.r1.concat(ROUTES.r2)).pad(0.05));
  vehInit(); plBindForm(); plRenderSaved();
  const dep=document.getElementById('pl-depart'); const d=new Date(Date.now()+(480+new Date().getTimezoneOffset())*60000); d.setMinutes(0,0,0); d.setHours(d.getHours()+1);
  dep.value=`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:00`;
  const fromHash=plFromHash(); const draft=lsGet('gs-route-planner-draft',null);
  if(fromHash) plLoad(fromHash); else if(draft&&draft.p&&draft.p.length>=2) plLoad(draft);
  else { PL.pts=[newPt(),newPt()]; plSetPt(PL.pts[0],ORIGINS.r1); plSetPt(PL.pts[1],{lat:14.419006,lng:121.051798}); plChanged(200); }
  setTimeout(()=>{m.invalidateSize(); plFit();},80);
}
function plMapClick(e){
  if(PL.mode==='off') return;
  const c={lat:+e.latlng.lat.toFixed(6),lng:+e.latlng.lng.toFixed(6)}; const P=PL.pts, last=P.length-1;
  if(PL.mode==='start') plSetPt(P[0],c);
  else if(PL.mode==='end') plSetPt(P[last],c);
  else {
    if(P[0].lat==null) plSetPt(P[0],c);
    else if(P[last].lat==null) plSetPt(P[last],c);
    else { const emp=P.findIndex((q,i)=>i>0&&i<last&&q.lat==null);
      if(emp>0) plSetPt(P[emp],c);
      else { const np=newPt(); P.splice(bestInsert(c),0,np); plSetPt(np,c); } }
  }
  plChanged(150);
}
function bestInsert(c){ const v=PL.pts.map((q,i)=>({q,i})).filter(o=>o.q.lat!=null); let best=PL.pts.length-1,cost=Infinity;
  for(let k=0;k<v.length-1;k++){const a=v[k].q,b=v[k+1].q,x=hav(a,c)+hav(c,b)-hav(a,b);if(x<cost){cost=x;best=v[k+1].i;}} return best; }
function plSyncMarkers(){
  if(!PL.map) return; PL.lay.pts.clearLayers();
  PL.pts.forEach((p,i)=>{ if(p.lat==null) return; const tag=ptTag(i), kind=i===0||i===PL.pts.length-1?'od':'via';
    const icon=L.divIcon({className:'pin od',html:`<div style="background:${kind==='od'?PLC.dark:PLC.route}">${tag}</div>`,iconSize:[44,24],iconAnchor:[22,12]});
    const mk=L.marker([p.lat,p.lng],{icon,draggable:true,zIndexOffset:1000}).addTo(PL.lay.pts);
    mk.on('dragend',ev=>{ const ll=ev.target.getLatLng(); plSetPt(p,{lat:+ll.lat.toFixed(6),lng:+ll.lng.toFixed(6)}); plChanged(100); });
    if(kind==='via'){ mk.bindPopup(`<b>${tag}</b><br><span class="gs-num">${fmtC(p)}</span><br><button class="gs-btn gs-btn--sm" type="button" data-delpt="${i}" style="margin-top:8px">이 경유지 삭제</button>`);
      mk.on('popupopen',ev=>{ const b=ev.popup.getElement().querySelector('[data-delpt]'); b&&b.addEventListener('click',()=>{ PL.map.closePopup(); PL.pts.splice(i,1); plChanged(100); }); }); }
  });
}
function plFit(){ if(!PL.map) return; const ll=PL.pts.filter(p=>p.lat!=null).map(p=>[p.lat,p.lng]); if(PL.res) ll.push(...PL.res.path.map(q=>[q.lat,q.lng])); if(ll.length>1) PL.map.fitBounds(L.latLngBounds(ll).pad(0.12)); else if(ll.length) PL.map.setView(ll[0],16); }

/* ---------- 경로 계산 ---------- */
async function osrmRoute(pts){
  const coords=pts.map(p=>{const c=chosenCand(p);const q=c?c.loc:p;return `${q.lng},${q.lat}`;}).join(';');
  const hints=pts.map(p=>{const c=chosenCand(p);return c?c.hint:'';});
  const base=`${PL_OSRM}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true&continue_straight=${document.getElementById('pl-uturn').checked?'false':'true'}`;
  try{ return await osrmJSON(hints.some(Boolean)?base+'&hints='+hints.join(';'):base); }
  catch(e){ if(hints.some(Boolean)&&e.code!=='NoRoute') return await osrmJSON(base); throw e; }
}
const MOD={uturn:'U턴','sharp right':'급우회전',right:'우회전','slight right':'약간 우회전',straight:'직진','slight left':'약간 좌회전',left:'좌회전','sharp left':'급좌회전'};
function describe(t,mod,exit){const m=MOD[mod]||'';switch(t){
  case 'turn':case 'end of road':return m||'회전';
  case 'new name':return m||'직진';
  case 'continue':return mod==='uturn'?'U턴':(m&&m!=='직진'?m+' 후 계속':'직진');
  case 'merge':return '합류'+(m&&m!=='직진'?` (${m})`:'');
  case 'on ramp':return '램프 진입'+(m?` (${m})`:'');
  case 'off ramp':return '램프 진출'+(m?` (${m})`:'');
  case 'fork':return '분기점'+(m?` ${m}`:'');
  case 'roundabout':case 'rotary':return `회전교차로${exit?` · ${exit}번째 출구`:''}`;
  case 'roundabout turn':return `회전교차로 ${m}`;
  case 'exit roundabout':case 'exit rotary':return '회전교차로 진출';
  default:return m||t;}}
function mkRow(o){
  const r=Object.assign({kind:'step',text:'',road:'',d:0,dur:0,bIn:0,bOut:0,mod:'',type:''},o);
  r.angle=(r.kind==='step'||r.kind==='via')?angDiff(r.bIn,r.bOut):0;
  r.uturn=r.mod==='uturn'||Math.abs(r.angle)>=150;
  r.isTurn=(r.kind==='step'||r.kind==='via')&&(Math.abs(r.angle)>=35||r.uturn||/^(roundabout|rotary)$/.test(r.type));
  return r;
}
async function plCalc(){
  const tok=++PL.token, P=PL.pts, n=P.length;
  if(n<2||P[0].lat==null||P[n-1].lat==null){ plClearResult(); plStatus('출발지와 도착지를 입력하면 경로를 계산합니다.'); return; }
  const valid=P.map((p,i)=>Object.assign({},p,{pi:i,ref:p})).filter(p=>p.lat!=null);
  const runs=[]; let cur=null;
  for(let i=0;i<valid.length-1;i++){
    if(valid[i].mode==='line'){ cur={type:'line',pts:[valid[i],valid[i+1]]}; runs.push(cur); }
    else if(cur&&cur.type==='road') cur.pts.push(valid[i+1]);
    else { cur={type:'road',pts:[valid[i],valid[i+1]]}; runs.push(cur); }
  }
  plStatus('경로 계산 중…');
  let results;
  try{ results=await Promise.all(runs.map(r=>r.type==='road'?osrmRoute(r.pts.map(q=>q.ref)):null)); }
  catch(e){ if(tok!==PL.token) return;
    const msg=e.code==='NoRoute'||e.code==='NoSegment'?'이 지점들 사이에서 도로 경로를 찾지 못했습니다. 지점이 도로 위에 있는지 확인하거나, 도로 데이터가 없는 구간은 "직선 연결"로 지정하십시오.':'경로 서버(OSRM)에 연결하지 못했습니다. 인터넷 연결을 확인하고 "경로 계산하기"를 다시 누르십시오.';
    plStatus(msg,true); return; }
  if(tok!==PL.token) return;
  const res=buildResult(valid,runs,results); res.tok=tok;
  PL.res=res; PL.sel=-1;
  analyzeTurns(res); banPrepare(res); banEvaluate(res);
  plDraw(); plRenderResult();
  const nT=res.rows.filter(r=>r.ev).length;
  plStatus(`계산했습니다 · ${kmTxt(res.dist)} · 회전 검토 지점 ${nT}곳. 도로 폭·행정구역·제한 표지 정보를 불러오는 중입니다…`);
  Promise.allSettled([enrichTurns(res,tok),enrichRestrict(res,tok),enrichBan(res,tok)]).then(()=>{ if(tok===PL.token) plStatus(`계산 완료 · ${kmTxt(res.dist)} · 회전 검토 지점 ${nT}곳`); });
}
function buildResult(valid,runs,results){
  const path=[],segs=[],rows=[],warns=[]; let dist=0,dur=0,legNo=0,prevB=null; const nLegs=valid.length-1;
  const push=cs=>cs.forEach(c=>{const l=path[path.length-1];if(!l||l.lat!==c[0]||l.lng!==c[1])path.push({lat:c[0],lng:c[1]});});
  const viaRow=(p,bOut,base)=>{ const r=mkRow(Object.assign({},base||{},{kind:'via',text:`경유지 ${ptTag(p.pi)} 통과`,lat:(base||p).lat,lng:(base||p).lng,bIn:prevB==null?bOut:prevB,bOut}));
    if(Math.abs(r.angle)>=150) r.text=`경유지 ${ptTag(p.pi)} — 진행 방향 반전(U턴)`; return r; };
  runs.forEach((run,ri)=>{
    if(run.type==='line'){
      const a=run.pts[0],b=run.pts[1],d=hav(a,b),bb=brg(a,b),t=d/(15/3.6);
      rows.push(legNo===0?mkRow({kind:'depart',text:'출발',lat:a.lat,lng:a.lng,bIn:bb,bOut:bb}):viaRow(a,bb));
      rows.push(mkRow({kind:'line',text:'직선 연결 구간',road:'도로 데이터 미사용 (사유지·현장 내부 도로 등)',lat:a.lat,lng:a.lng,bIn:bb,bOut:bb,d,dur:t}));
      segs.push({type:'line',coords:[[a.lat,a.lng],[b.lat,b.lng]]}); push([[a.lat,a.lng],[b.lat,b.lng]]);
      dist+=d; dur+=t; prevB=bb; legNo++;
      if(legNo===nLegs) rows.push(mkRow({kind:'arrive',text:'도착',lat:b.lat,lng:b.lng}));
      return;
    }
    const j=results[ri], route=j.routes[0];
    j.waypoints.forEach((w,k)=>{ if(w.distance>30) warns.push(`${ptTag(run.pts[k].pi)} 지점이 도로에서 약 ${Math.round(w.distance)} m 떨어져 있어 가장 가까운 도로(${w.name||'이름 없는 도로'})로 보정했습니다.`); });
    const coords=route.geometry.coordinates.map(c=>[c[1],c[0]]); segs.push({type:'road',coords}); push(coords);
    dist+=route.distance; dur+=route.duration;
    route.legs.forEach((leg,k)=>{
      leg.steps.forEach(st=>{
        const m=st.maneuver, base={lat:m.location[1],lng:m.location[0],bIn:m.bearing_before,bOut:m.bearing_after,d:st.distance,dur:st.duration,road:st.name||st.ref||'',type:m.type,mod:m.modifier||'',exit:m.exit};
        if(m.type==='depart'){ rows.push(legNo===0?mkRow(Object.assign(base,{kind:'depart',text:'출발'})):viaRow(run.pts[k],m.bearing_after,base)); }
        else if(m.type==='arrive'){ prevB=m.bearing_before; if(legNo===nLegs-1) rows.push(mkRow(Object.assign(base,{kind:'arrive',text:'도착',d:0,dur:0}))); }
        else if(m.type==='notification'||m.type==='use lane'||((m.type==='new name'||m.type==='continue')&&(!m.modifier||m.modifier==='straight'||/slight/.test(m.modifier)))){
          const l=rows[rows.length-1]; if(l){l.d+=st.distance;l.dur+=st.duration;} }
        else rows.push(mkRow(Object.assign(base,{kind:'step',text:describe(m.type,m.modifier,m.exit)})));
      });
      legNo++;
    });
  });
  let cd=0,ct=0; rows.forEach(r=>{r.cumD=cd;r.cumT=ct;cd+=r.d;ct+=r.dur;});
  const pc=[0]; for(let i=1;i<path.length;i++) pc.push(pc[i-1]+hav(path[i-1],path[i]));
  let from=0; rows.forEach(r=>{let b=from,bd=Infinity;for(let i=from;i<path.length;i++){const d=Math.abs(path[i].lat-r.lat)+Math.abs(path[i].lng-r.lng);if(d<bd){bd=d;b=i;}if(bd<1e-7||(i-from>3000))break;}r.pi=b;from=b;});
  // 회전각은 경로 형상(전후 30 m)으로 다시 계산 — 안내 지점 이전에 이미 꺾이는 곡선 교차로 대응
  const tmp={path,pc};
  rows.forEach(r=>{ if(r.kind!=='step'&&r.kind!=='via') return;
    const a1=pathPointAt(tmp,r.pi,-30),a2=pathPointAt(tmp,r.pi,-6),e1=pathPointAt(tmp,r.pi,6),e2=pathPointAt(tmp,r.pi,30);
    if(hav(a1,a2)<5||hav(e1,e2)<5) return;
    const g=angDiff(brg(a1,a2),brg(e1,e2)); if(Math.abs(g)>Math.abs(r.angle)) r.angle=g;
    r.uturn=r.mod==='uturn'||Math.abs(r.angle)>=150;
    r.isTurn=Math.abs(r.angle)>=35||r.uturn||/^(roundabout|rotary)$/.test(r.type); });
  // 25 m 이내 연속 회전은 하나로 묶음(같은 교차로를 두 번 세지 않도록)
  let prevT=null; rows.forEach(r=>{ if(!r.isTurn) return; if(prevT&&Math.abs(r.cumD-prevT.cumD)<25){ if(Math.abs(r.angle)>Math.abs(prevT.angle)){prevT.isTurn=false;prevT=r;} else r.isTurn=false; } else prevT=r; });
  let n=0; rows.forEach(r=>{ if(r.isTurn) r.no='T'+(++n); });
  return {valid,rows,path,pc,segs,warns,dist,dur};
}

/* ---------- 회전 궤적 시뮬레이션 ---------- */
function simulateTurn(path,pi,veh,keepRight,shift=0){
  const Lv=vehLen(veh), before=Lv+30, after=Lv+30;
  let i0=pi,a=0; while(i0>0&&a<before){a+=hav(path[i0-1],path[i0]);i0--;}
  let i1=pi; a=0; while(i1<path.length-1&&a<after){a+=hav(path[i1],path[i1+1]);i1++;}
  const P=projector(path[pi]); const raw=path.slice(i0,i1+1).map(P.to); if(raw.length<2) return null;
  let center=resample(raw,0.5); if(center.length<8) return null;
  // 시작부가 짧으면 직선으로 연장 (차량을 출발 전 정렬)
  const need=Math.ceil((Lv+8)/0.5); const h0=Math.atan2(center[4].y-center[0].y,center[4].x-center[0].x);
  const ext=[]; for(let s=need;s>0;s--) ext.push({x:center[0].x-Math.cos(h0)*s*0.5,y:center[0].y-Math.sin(h0)*s*0.5});
  center=ext.concat(center);
  let ti=0,bd=Infinity; center.forEach((q,i)=>{const d=q.x*q.x+q.y*q.y;if(d<bd){bd=d;ti=i;}});
  // 회전부 근처(±12 m)에서 바깥쪽으로 shift(m)만큼 벌려 진입하는 운전 패턴, ±30 m까지 점진 복귀
  const base=keepRight?-1.6:0, sgnOut=0; const bump=i=>{const d=Math.abs(i-ti)*0.5;return d<=12?1:d>=30?0:(30-d)/18;};
  let lane=center.slice();
  { const n=center.length,out=[]; const h=Math.atan2(center[Math.min(n-1,ti+40)].y-center[Math.max(0,ti-40)].y,center[Math.min(n-1,ti+40)].x-center[Math.max(0,ti-40)].x);
    // 회전 방향: 경로 전후 방위 차이로 판정 (+ 좌회전 / - 우회전) → 바깥쪽은 반대편
    const hA0=Math.atan2(center[Math.max(0,ti-20)].y-center[Math.max(0,ti-60)].y,center[Math.max(0,ti-20)].x-center[Math.max(0,ti-60)].x);
    const hE0=Math.atan2(center[Math.min(n-1,ti+60)].y-center[Math.min(n-1,ti+20)].y,center[Math.min(n-1,ti+60)].x-center[Math.min(n-1,ti+20)].x);
    const dir=Math.sign(Math.atan2(Math.sin(hE0-hA0),Math.cos(hE0-hA0)))||1;
    for(let i=0;i<n;i++){const a=center[Math.max(0,i-6)],b=center[Math.min(n-1,i+6)];let tx=b.x-a.x,ty=b.y-a.y;const l=Math.hypot(tx,ty)||1;tx/=l;ty/=l;
      const d=base+(-dir)*shift*bump(i); out.push({x:center[i].x-ty*d,y:center[i].y+tx*d});}
    lane=out; }
  const track=(veh.W||2.5)-0.3, Rf=Math.max(3,veh.Ro-track/2), ds=0.25;
  // 회전부를 최소회전반경 원호로 대체한 앞축 목표 경로(운전자가 미리 핸들을 꺾는 궤적)
  const hd=(i,j)=>{i=Math.max(0,Math.min(lane.length-1,i));j=Math.max(0,Math.min(lane.length-1,j));return Math.atan2(lane[j].y-lane[i].y,lane[j].x-lane[i].x);};
  const hA=hd(ti-50,ti-20), hE=hd(ti+20,ti+50); let dTurn=Math.atan2(Math.sin(hE-hA),Math.cos(hE-hA)); // + = 왼쪽(반시계)
  let target=lane;
  const near=(p,from,to)=>{let b=from,bd=Infinity;for(let j=Math.max(0,from);j<Math.min(lane.length,to);j++){const d=(lane[j].x-p.x)**2+(lane[j].y-p.y)**2;if(d<bd){bd=d;b=j;}}return b;};
  const arcFrom=(p0,h0,ang,Rt)=>{const pts=[];let h=h0,p={...p0},turned=0;const sg=Math.sign(ang),ad=Math.abs(ang);while(turned<ad-0.01){const st=Math.min(0.5/Rt,ad-turned);h+=sg*st;turned+=st;p={x:p.x+Math.cos(h)*0.5,y:p.y+Math.sin(h)*0.5};pts.push(p);}return pts;};
  if(Math.abs(dTurn)>0.35){
    const ad=Math.abs(dTurn), Rt=Rf;
    const iA=Math.max(0,ti-50), iE=Math.min(lane.length-1,ti+50);
    const uA={x:Math.cos(hA),y:Math.sin(hA)}, uE={x:Math.cos(hE),y:Math.sin(hE)};
    const den=uA.x*uE.y-uA.y*uE.x;
    let done=false;
    if(ad<2.7&&Math.abs(den)>0.05){
      // 접근선·진출선의 교점 V에 반경 Rt 원호를 접하도록 배치
      const dx=lane[iE].x-lane[iA].x, dy=lane[iE].y-lane[iA].y, tA=(dx*uE.y-dy*uE.x)/den;
      const V={x:lane[iA].x+uA.x*tA,y:lane[iA].y+uA.y*tA}, t=Rt*Math.tan(ad/2);
      const T1={x:V.x-uA.x*t,y:V.y-uA.y*t};
      const j1=near(T1,0,ti+1);
      if((V.x-lane[ti].x)**2+(V.y-lane[ti].y)**2<30*30 && j1>8){
        const arc=arcFrom(T1,hA,dTurn,Rt), end=arc[arc.length-1]||T1, j2=near(end,ti,lane.length);
        target=lane.slice(0,j1).concat([T1],arc,lane.slice(Math.min(lane.length-1,j2+4)));
        done=true;
      }
    }
    if(!done){
      let t=ad<2.7?Rt*Math.tan(ad/2):Rt; t=Math.min(t,Lv+28);
      const i1=Math.max(6,ti-Math.round(t/0.5)); const h0=Math.atan2(lane[i1].y-lane[i1-6].y,lane[i1].x-lane[i1-6].x);
      const arc=arcFrom(lane[i1],h0,dTurn,Rt), end=arc[arc.length-1]||lane[i1], j2=near(end,ti,lane.length);
      target=lane.slice(0,i1+1).concat(arc,lane.slice(Math.min(lane.length-1,j2+6)));
    }
  }
  const Ld=3, look=Math.round(Ld/0.5);
  let F={x:target[0].x,y:target[0].y}, th=Math.atan2(target[6].y-target[0].y,target[6].x-target[0].x);
  let R={x:F.x-Math.cos(th)*veh.wb,y:F.y-Math.sin(th)*veh.wb}, K=null, T=null;
  const unit=(p,q)=>{const dx=p.x-q.x,dy=p.y-q.y,l=Math.hypot(dx,dy)||1;return {x:dx/l,y:dy/l};};
  if(veh.type==='semi'){ const u=unit(F,R); K={x:R.x+u.x*veh.ko,y:R.y+u.y*veh.ko}; T={x:K.x-u.x*veh.tw,y:K.y-u.y*veh.tw}; }
  const N=target.length, samples=[], ftrack=[]; let k=0, steps=0, travelled=0; const hw=veh.W/2;
  const rectPts=(front,u,len,w)=>{ const n={x:-u.y,y:u.x}, pts=[]; const corners=[];
    const fl={x:front.x+n.x*w,y:front.y+n.y*w}, fr={x:front.x-n.x*w,y:front.y-n.y*w}, rl={x:fl.x-u.x*len,y:fl.y-u.y*len}, rr={x:fr.x-u.x*len,y:fr.y-u.y*len};
    corners.push(fl,fr,rr,rl);
    for(let t=0;t<=len;t+=1.5){ pts.push({x:fl.x-u.x*t,y:fl.y-u.y*t},{x:fr.x-u.x*t,y:fr.y-u.y*t}); }
    pts.push(rl,rr); return {corners,pts}; };
  while(steps++<20000){
    let best=k,bb=Infinity; for(let j=k;j<Math.min(N,k+60);j++){const d=(target[j].x-F.x)**2+(target[j].y-F.y)**2;if(d<bb){bb=d;best=j;}} k=best;
    if(k>=N-3) break;
    const tg=target[Math.min(N-1,k+look)]; let al=Math.atan2(tg.y-F.y,tg.x-F.x)-th; al=Math.atan2(Math.sin(al),Math.cos(al));
    let kap=2*Math.sin(al)/Ld; const km=1/Rf; if(kap>km)kap=km; if(kap<-km)kap=-km;
    th+=kap*ds; F={x:F.x+Math.cos(th)*ds,y:F.y+Math.sin(th)*ds}; travelled+=ds;
    let u=unit(F,R); R={x:F.x-u.x*veh.wb,y:F.y-u.y*veh.wb}; u=unit(F,R);
    if(veh.type==='semi'){ K={x:R.x+u.x*veh.ko,y:R.y+u.y*veh.ko}; const u2=unit(K,T); T={x:K.x-u2.x*veh.tw,y:K.y-u2.y*veh.tw}; }
    if(steps%4===0){
      ftrack.push({x:F.x,y:F.y,k});
      if(travelled>=Lv+4){
        const bodies=[];
        if(veh.type==='semi'){
          bodies.push(rectPts({x:F.x+u.x*veh.fo,y:F.y+u.y*veh.fo},u,veh.fo+veh.wb+1.0,hw));
          const u2=unit(K,T); bodies.push(rectPts({x:K.x+u2.x*veh.tfo,y:K.y+u2.y*veh.tfo},u2,veh.tfo+veh.tw+veh.tro,hw));
        } else bodies.push(rectPts({x:F.x+u.x*veh.fo,y:F.y+u.y*veh.fo},u,veh.fo+veh.wb+veh.ro,hw));
        samples.push({F:{...F},last:veh.type==='semi'?{...T}:{...R},k,bodies});
      }
    }
  }
  if(!samples.length) return null;
  // 지표: 중앙선 기준 좌우 점유, 앞축 차로 이탈, 오프트래킹
  let leftA=-Infinity,leftE=-Infinity,right=-Infinity,frontDev=0,offtrack=0,leftPtA=null,leftPtE=null;
  samples.forEach(s=>{
    frontDev=Math.max(frontDev,Math.abs(signedLat(s.F,target.slice(Math.max(0,s.k-40),Math.min(N,s.k+40))).d));
    s.bodies.forEach(b=>b.pts.forEach(p=>{ const r=signedLat(p,center);
      const zone=Math.abs(r.i-ti)<=20; // 교차로 내부(±10 m)는 대향차로 판정에서 제외
      if(!zone){ if(r.i<ti){ if(r.d>leftA){leftA=r.d;leftPtA=p;} } else { if(r.d>leftE){leftE=r.d;leftPtE=p;} } }
      right=Math.max(right,-r.d); }));
    const fl=ftrack.filter(q=>Math.abs(q.k-s.k)<80); if(fl.length>1) offtrack=Math.max(offtrack,Math.abs(signedLat(s.last,fl).d));
  });
  return {shift,P,center,lane:target,ti,samples,Lv,Rf,leftA,leftE,leftPtA,leftPtE,right,frontDev,offtrack,swept:Math.max(leftA,leftE)+right};
}

/* ---------- 포장면(도로+가각) 모델과 판정 ---------- */
function chamfer(src,nx,ny,cs){const d=new Float32Array(nx*ny),a=cs,b=cs*Math.SQRT2;for(let i=0;i<d.length;i++)d[i]=src[i]?0:1e9;
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const i=y*nx+x;let v=d[i];if(!v)continue;if(x>0)v=Math.min(v,d[i-1]+a);if(y>0){v=Math.min(v,d[i-nx]+a);if(x>0)v=Math.min(v,d[i-nx-1]+b);if(x<nx-1)v=Math.min(v,d[i-nx+1]+b);}d[i]=v;}
  for(let y=ny-1;y>=0;y--)for(let x=nx-1;x>=0;x--){const i=y*nx+x;let v=d[i];if(!v)continue;if(x<nx-1)v=Math.min(v,d[i+1]+a);if(y<ny-1){v=Math.min(v,d[i+nx]+a);if(x<nx-1)v=Math.min(v,d[i+nx+1]+b);if(x>0)v=Math.min(v,d[i+nx-1]+b);}d[i]=v;}
  return d;}
function pavement(center,ti,wA,wE,rc){
  let minx=Infinity,miny=Infinity,maxx=-Infinity,maxy=-Infinity; center.forEach(q=>{minx=Math.min(minx,q.x);miny=Math.min(miny,q.y);maxx=Math.max(maxx,q.x);maxy=Math.max(maxy,q.y);});
  const pad=Math.max(wA,wE)/2+rc+6; minx-=pad;miny-=pad;maxx+=pad;maxy+=pad;
  const cs=0.3,nx=Math.ceil((maxx-minx)/cs)+1,ny=Math.ceil((maxy-miny)/cs)+1, pav=new Uint8Array(nx*ny);
  for(let i=0;i<center.length-1;i++){const a=center[i],b=center[i+1],h=(i<ti?wA:wE)/2;
    const x0=Math.max(0,Math.floor((Math.min(a.x,b.x)-h-minx)/cs)),x1=Math.min(nx-1,Math.ceil((Math.max(a.x,b.x)+h-minx)/cs));
    const y0=Math.max(0,Math.floor((Math.min(a.y,b.y)-h-miny)/cs)),y1=Math.min(ny-1,Math.ceil((Math.max(a.y,b.y)+h-miny)/cs));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const k=y*nx+x;if(!pav[k]&&segDist(minx+x*cs,miny+y*cs,a,b)<=h)pav[k]=1;}}
  const d1=chamfer(pav,nx,ny,cs), nd=new Uint8Array(nx*ny); for(let i=0;i<nd.length;i++) nd[i]=d1[i]>rc?1:0;
  const d2=chamfer(nd,nx,ny,cs), closed=new Uint8Array(nx*ny); for(let i=0;i<closed.length;i++) closed[i]=(pav[i]||d2[i]>rc)?1:0;
  return {minx,miny,cs,nx,ny,closed,dOut:chamfer(closed,nx,ny,cs)};
}
const LANES_DEF={motorway:[4,2],trunk:[4,2],primary:[4,2],secondary:[2,2],tertiary:[2,1],unclassified:[2,1],residential:[2,1],living_street:[2,1],service:[1,1],track:[1,1]};
const LANE_W={motorway:3.5,trunk:3.4,primary:3.3,secondary:3.2,tertiary:3.1};
const RC_DEF={motorway:9,trunk:9,primary:9,secondary:7.5,tertiary:6};
function roadInfo(tags){
  if(!tags) return null; const hw=(tags.highway||'').replace('_link',''), link=/_link$/.test(tags.highway||''), ow=tags.oneway==='yes'||tags.oneway==='1'||tags.junction==='roundabout'||(/motorway/.test(hw)&&tags.oneway!=='no');
  let w=parseFloat(String(tags.width||'').replace(',','.')), src='OSM 폭';
  if(!isFinite(w)||w<=0){ const ln=parseInt(tags.lanes,10); const def=LANES_DEF[hw]||[2,1]; const lanes=isFinite(ln)&&ln>0?ln:(link?1:(ow?def[1]:def[0]));
    w=lanes*(LANE_W[hw]||3.0)+(link?0.8:0); src=isFinite(ln)&&ln>0?`OSM 차로 ${lanes}개`:`기본값 차로 ${lanes}개(추정)`; }
  return {name:tags.name||tags.ref||'(이름 없는 도로)',hw:tags.highway||'',w,oneway:ow,src,dflt:/추정/.test(src),rc:RC_DEF[hw]||(link?7:4.5),lvl:levelOf(tags,tags.name)};
}
function evaluateTurn(r,veh){
  if(!r.sims) return null; const s0=r.sims[0]; if(!s0) return null;
  const A=r.wayA||{w:6.4,oneway:false,dflt:true,src:'기본값(추정)',rc:6,name:'접근 도로'}, E=r.wayE||{w:6.4,oneway:false,dflt:true,src:'기본값(추정)',rc:6,name:'진출 도로'};
  const rc=r.uturn?2:Math.min(A.rc,E.rc);
  const pv=pavement(s0.center,s0.ti,A.w,E.w,rc);
  const score1=s=>{ let out=0,outPt=null;
    s.samples.forEach(x=>x.bodies.forEach(b=>b.pts.forEach(p=>{
      const gx=Math.round((p.x-pv.minx)/pv.cs),gy=Math.round((p.y-pv.miny)/pv.cs);
      const v=(gx<0||gy<0||gx>=pv.nx||gy>=pv.ny)?9.9:(pv.closed[gy*pv.nx+gx]?0:pv.dOut[gy*pv.nx+gx]);
      if(v>out){out=v;outPt=p;} })));
    const oppA=A.oneway?0:Math.max(0,s.leftA), oppE=E.oneway?0:Math.max(0,s.leftE);
    return {s,out,outPt,opp:Math.max(oppA,oppE),oppPt:oppA>=oppE?s.leftPtA:s.leftPtE}; };
  let best=null;
  [0,1,2,3].forEach(k=>{ if(!r.sims[k]) r.sims[k]=simulateTurn(PL.res.path,r.pi,veh,r.keepRight,k); const sk=r.sims[k]; if(!sk) return;
    const c=score1(sk); c.score=c.out*4+c.opp+k*0.05; if(!best||c.score<best.score) best=c; });
  const s=best.s; r.sim=s; const out=best.out,outPt=best.outPt,opp=best.opp,oppPt=best.oppPt;
  let v='success'; if(out>0.5) v='danger'; else if(out>0.2||opp>0.3) v='warning';
  const heightRisk=(r.restr||[]).some(overOf);
  if(heightRisk) v='danger';
  return {shift:s.shift,A,E,rc,out,outPt,opp,oppPt,v,est:A.dflt||E.dflt||!r.wayA||!r.wayE};
}
function analyzeTurns(res){
  const kr=document.getElementById('pl-keepright').checked;
  res.rows.forEach(r=>{ if(!r.isTurn){r.sim=null;r.sims=null;r.ev=null;return;} r.keepRight=kr; r.sims={0:simulateTurn(res.path,r.pi,VEH,kr,0)}; r.sim=r.sims[0]; r.ev=r.sim?evaluateTurn(r,VEH):null; });
}
function pathPointAt(res,pi,offset){ // 경로를 따라 offset(m) 떨어진 점
  let i=pi,acc=0; const dir=offset<0?-1:1, tgt=Math.abs(offset);
  while(i+dir>=0&&i+dir<res.path.length&&acc<tgt){acc+=hav(res.path[i],res.path[i+dir]);i+=dir;}
  return res.path[i];
}
async function enrichTurns(res,tok){
  const turns=res.rows.filter(r=>r.sim); if(!turns.length) return;
  for(let c=0;c<turns.length;c+=15){
    const chunk=turns.slice(c,c+15);
    const q='[out:json][timeout:60];'+chunk.map((r,i)=>`way(around:30,${r.lat},${r.lng})[highway][highway!~"^(footway|path|steps|cycleway|pedestrian|corridor|bridleway|platform)$"];out tags geom;make sep n=${i};out;`).join('');
    let j; try{ j=await ovp(q); }catch(e){ return; }
    if(tok!==PL.token) return;
    const groups=splitSep(j.elements);
    chunk.forEach((r,i)=>{ const ways=groups[i]||[]; const idx=res.rows.indexOf(r); const prevRoad=(res.rows.slice(0,idx).reverse().find(x=>x.road)||{}).road||'';
      const a=pathPointAt(res,r.pi,-15), e=pathPointAt(res,r.pi,15);
      const wa=nearestWay(ways,a,prevRoad), we=nearestWay(ways,e,r.road);
      r.wayA=wa?roadInfo(wa.tags):null; r.wayE=we?roadInfo(we.tags):null; r.enriched=true; r.ev=evaluateTurn(r,VEH); });
    plDrawTurns(); plRenderSteps(); if(PL.sel>=0) plRenderDetail(false);
  }
}

/* ---------- 트럭 밴 ---------- */
const BAN_RULES=[
  {id:'mmda',label:'MMDA 통합 트럭 밴',ncr:true,win:[[360,540],[960,1200]],basis:'MMDA 발표(2026-04 보도)',fine:'₱2,000 · 3회 적발 시 운전면허 1년 정지 (2019 자료, 현행 금액 확인 필요)',exempt:{essential:'필수·부패성 화물 예외(한시)',fuel:'유류 탱크로리 예외(한시)',permit:'MMDA 특별허가 조건에 따름'}},
  {id:'muntinlupa',label:'문틴루파시 트럭 밴',city:/muntinlupa/i,win:[[360,600],[960,1260]],basis:'Ord. No. 11-022 (2019 자료)',fine:'시 통합 벌금표(Ord. 2023-055) — 금액 확인 필요'},
  {id:'laspinas',label:'라스피냐스시 트럭 밴',city:/las pi(n|ñ)as/i,win:[[360,540],[960,1200]],basis:'Ord. No. 652-04 (2019 자료)',fine:'금액 확인 필요',note:'2차로 이하 시 도로 통행 금지'},
  {id:'taguig',label:'타기그시 트럭 밴',city:/taguig/i,win:[[360,540],[960,1200]],basis:'Ord. No. 103 s.2003 (2019 자료)',fine:'금액 확인 필요',note:'2차로 이하 시 도로 통행 금지 · BGC 별도'},
  {id:'paranaque',label:'파라냐케시 트럭 밴',city:/para(n|ñ)aque/i,win:[[360,540],[960,1200]],basis:'Ord. No. 05-04 s.2004 (2019 자료)',fine:'금액 확인 필요',note:'2차로 이하 시 도로 통행 금지'}
];
const winTxt=w=>w.map(([a,b])=>`${pad2(a/60|0)}:${pad2(a%60)}–${pad2(b/60|0)}:${pad2(b%60)}`).join(', ');
const isExpRoad=n=>/expressway|expy|skyway|slex|nlex|cavitex|tollway|toll/i.test(n||'');
function banPrepare(res){
  const total=res.pc[res.pc.length-1]||0, step=Math.max(1200,total/12), S=[];
  for(let d=0;d<total;d+=step) S.push(d); S.push(total);
  res.samples=S.map(d=>{ let i=0; while(i<res.pc.length-1&&res.pc[i+1]<d) i++; const p=res.path[i];
    const row=[...res.rows].reverse().find(r=>r.cumD<=d+1)||res.rows[0];
    const r2=res.rows.find(r=>r.cumD>d)||null; let t=row.cumT; if(r2&&r2.cumD>row.cumD) t=row.cumT+(r2.cumT-row.cumT)*((d-row.cumD)/(r2.cumD-row.cumD)); else t=Math.min(res.dur,row.cumT+(d-row.cumD)/Math.max(1,row.d)*row.dur);
    return {d,t,lat:p.lat,lng:p.lng,road:row.road,exp:isExpRoad(row.road)}; });
}
function minutesOverlap(t0,t1,win){ // Date 범위가 금지 시간대(분)와 겹치는 구간 반환
  const hits=[]; for(let t=new Date(t0);t<=t1;t=new Date(t.getTime()+5*60000)){ const m=t.getHours()*60+t.getMinutes(); if(win.some(([a,b])=>m>=a&&m<b)) hits.push(t); }
  return hits;
}
function banEvaluate(res,offsetMin=0){
  const dep=new Date(document.getElementById('pl-depart').value||Date.now()); dep.setMinutes(dep.getMinutes()+offsetMin);
  const f=parseFloat(document.getElementById('pl-factor').value)||1.3, cargo=document.getElementById('pl-cargo').value;
  const segs=[]; (res.samples||[]).forEach((s,i)=>{ const at=new Date(dep.getTime()+s.t*f*1000), city=s.city;
    const key=(city===undefined?'…':city||'?')+'|'+(s.exp?'x':'c'); const last=segs[segs.length-1];
    if(last&&last.key===key){ last.t1=at; last.d1=s.d; if(s.road&&!last.roads.includes(s.road)) last.roads.push(s.road); }
    else segs.push({key,city,ncr:s.ncr,exp:s.exp,t0:at,t1:at,d0:s.d,d1:s.d,roads:s.road?[s.road]:[]}); });
  const heavy=VEH.GVW>4500; let conflicts=0;
  segs.forEach(g=>{ g.rules=[]; if(g.exp){ g.v='na'; g.note='유료도로 구간 — 시 트럭 밴 대신 운영사 규정 적용'; return; }
    if(!heavy){ g.v='success'; g.note='총중량 4,500 kg 이하 — 화물차 트럭 밴 대상 아님(경트럭 규정은 별도)'; return; }
    BAN_RULES.forEach(rule=>{ const applies=rule.ncr?(g.ncr!==false):(g.city&&rule.city.test(g.city)); if(!applies) return;
      const hits=minutesOverlap(g.t0,g.t1,rule.win); const ex=rule.exempt&&rule.exempt[cargo];
      g.rules.push({rule,hits:hits.length,exempt:ex||(cargo!=='general'&&!rule.exempt?'화물 구분에 따른 예외 여부 확인 필요':'')}); });
    const bad=g.rules.filter(x=>x.hits&&!(x.rule.exempt&&x.rule.exempt[cargo]));
    g.v=bad.length?'danger':(g.city===null?'na':'success'); if(bad.length) conflicts++;
    if(g.city===null&&!g.rules.length) g.note='행정구역 확인 중이거나 확인 실패 — MMDA 규정만 적용'; });
  if(!offsetMin){ res.ban={segs,dep,conflicts,heavy,cargo};
    res.ban.suggest=null;
    if(conflicts){ for(let m=10;m<=24*60;m+=10){ const tr=banEvaluate(res,m); if(!tr.conflicts){ const d=new Date(dep.getTime()+m*60000); res.ban.suggest={dep:d,arr:new Date(d.getTime()+res.dur*f*1000)}; break; } } }
    // 지점별 통과 예정 시각
    res.rows.forEach(r=>{ r.at=new Date(dep.getTime()+r.cumT*f*1000); });
    res.arrive=new Date(dep.getTime()+res.dur*f*1000);
  }
  return {conflicts};
}
async function enrichBan(res,tok){
  const S=res.samples||[]; if(!S.length) return;
  const q='[out:json][timeout:90];'+S.map((s,i)=>`is_in(${s.lat},${s.lng})->.a;area.a[boundary=administrative][admin_level~"^[3-7]$"];out tags;make sep n=${i};out;`).join('');
  let j; try{ j=await ovp(q,'slow'); }catch(e){ S.forEach(s=>{ if(s.city===undefined) s.city=null; }); banEvaluate(res); plRenderBan(); return; }
  if(tok!==PL.token) return;
  const groups=splitSep(j.elements);
  S.forEach((s,i)=>{ const g=groups[i]||[]; const city=g.find(e=>e.tags&&e.tags.admin_level==='6')||g.find(e=>e.tags&&e.tags.admin_level==='7');
    s.city=city?(city.tags['name:en']||city.tags.name):null; s.ncr=g.some(e=>e.tags&&/metro manila|national capital/i.test((e.tags.name||'')+' '+(e.tags['name:en']||''))); });
  banEvaluate(res); plRenderBan(); plRenderSteps();
}

/* ---------- 도로 제한 표지 ---------- */
async function enrichRestrict(res,tok){
  const P=res.path; if(P.length<2) return; const pts=[P[0]]; let acc=0;
  for(let i=1;i<P.length;i++){acc+=hav(P[i-1],P[i]);if(acc>=25){pts.push(P[i]);acc=0;}} pts.push(P[P.length-1]);
  const step=Math.ceil(pts.length/350), line=pts.filter((_,i)=>i%step===0||i===pts.length-1).map(p=>`${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join(',');
  const q=`[out:json][timeout:60];way(around:12,${line})[highway][~"^(hgv|maxweight|maxheight|maxwidth|maxlength|maxaxleload|goods)$"~"."];out tags center;`;
  let j; try{ j=await ovp(q); }catch(e){ res.restr={error:true}; plRenderRestrict(); return; }
  if(tok!==PL.token) return;
  const list=[]; const num=v=>{const m=String(v||'').match(/[\d.]+/);return m?parseFloat(m[0]):NaN;};
  j.elements.forEach(e=>{ const t=e.tags||{}, name=t.name||t.ref||'(이름 없는 도로)', c=e.center?{lat:e.center.lat,lng:e.center.lon}:null;
    const add=(k,label,val,n)=>list.push({name,k,label,val,n,c});
    if(t.maxheight) add('maxheight','높이 제한',t.maxheight+' m',num(t.maxheight));
    if(t.maxweight) add('maxweight','중량 제한',t.maxweight+' t',num(t.maxweight));
    if(t.maxwidth) add('maxwidth','폭 제한',t.maxwidth+' m',num(t.maxwidth));
    if(t.maxlength) add('maxlength','길이 제한',t.maxlength+' m',num(t.maxlength));
    if(t.maxaxleload) add('maxaxleload','축중 제한',t.maxaxleload+' t',NaN);
    if(t.hgv&&t.hgv!=='yes'&&t.hgv!=='designated') add('hgv','대형 화물차 통행',t.hgv==='no'?'금지':t.hgv==='destination'?'목적지 차량만':t.hgv,t.hgv==='no'?1:NaN);
    if(t.goods&&t.goods==='no') add('goods','화물차 통행','금지',1); });
  const seen=new Set(); res.restr=list.filter(x=>{const k=x.name+x.k+x.val;if(seen.has(k))return false;seen.add(k);return true;});
  res.rows.forEach(r=>{ if(r.sim){ r.restr=res.restr.filter(x=>x.c&&hav(x.c,r)<45); r.ev=evaluateTurn(r,VEH); } });
  plRenderRestrict(); plDrawFlags(); plDrawTurns(); plRenderSteps(); if(PL.sel>=0) plRenderDetail(false);
}

/* ---------- 지도 그리기 ---------- */
function plDraw(){
  if(!PL.map) return; PL.lay.route.clearLayers(); PL.lay.sweep.clearLayers();
  (PL.res?PL.res.segs:[]).forEach(s=>{
    L.polyline(s.coords,{color:'#ffffff',weight:9,opacity:.7}).addTo(PL.lay.route);
    L.polyline(s.coords,{color:PLC.route,weight:5,opacity:.95,dashArray:s.type==='line'?'8 8':null}).addTo(PL.lay.route); });
  plDrawTurns(); plDrawFlags();
}
function plDrawTurns(){
  if(!PL.map) return; PL.lay.turns.clearLayers(); if(!PL.res) return;
  PL.res.rows.forEach((r,i)=>{ if(!r.ev) return; const col=PLC[r.ev.v]||PLC.na;
    const icon=L.divIcon({className:'pin',html:`<div style="background:${col};width:30px;height:30px;font-size:11px">${r.no}</div>`,iconSize:[30,30],iconAnchor:[15,15]});
    L.marker([r.lat,r.lng],{icon,zIndexOffset:500}).addTo(PL.lay.turns).on('click',()=>plSelect(i,true)).bindTooltip(`${r.no} ${r.text}${r.road?' · '+esc(r.road):''}`); });
}
function overOf(x){ if(!isFinite(x.n)) return false; const L=vehLen(VEH);
  return x.k==='maxheight'?VEH.H>x.n:x.k==='maxweight'?VEH.GVW/1000>x.n:x.k==='maxwidth'?VEH.W>x.n:x.k==='maxlength'?L>x.n:(x.k==='hgv'||x.k==='goods')?(VEH.GVW>3500):false; }
function plDrawFlags(){
  if(!PL.map) return; PL.lay.flags.clearLayers(); const R=PL.res; if(!R||!R.restr||!R.restr.length) return;
  R.restr.forEach(x=>{ if(!x.c) return; L.circleMarker([x.c.lat,x.c.lng],{radius:7,color:'#ffffff',weight:2,fillColor:overOf(x)?PLC.danger:PLC.warning,fillOpacity:1}).addTo(PL.lay.flags).bindTooltip(`${esc(x.label)}: ${esc(x.val)} · ${esc(x.name)}`); });
}
function plDrawSweep(r){
  PL.lay.sweep.clearLayers(); const s=r&&r.sim; if(!s) return;
  const B=q=>{const g=s.P.back(q);return [g.lat,g.lng];}, ll=[];
  const nb=s.samples[0].bodies.length;
  for(let b=0;b<nb;b++) for(let c=0;c<4;c++){ const line=s.samples.map(x=>B(x.bodies[b].corners[c])); ll.push(...line); L.polyline(line,{color:PLC.sweep,weight:2,opacity:.95}).addTo(PL.lay.sweep); }
  const snaps=[0,Math.floor(s.samples.length*0.35),Math.floor(s.samples.length*0.55),Math.floor(s.samples.length*0.75),s.samples.length-1];
  s.samples.forEach((x,i)=>{ if(i%2) return; x.bodies.forEach(b=>L.polygon(b.corners.map(B),{stroke:false,fillColor:PLC.sweep,fillOpacity:.07,interactive:false}).addTo(PL.lay.sweep)); });
  const fb=[]; snaps.forEach(i=>{ const x=s.samples[i]; x.bodies.forEach(b=>{ const cs=b.corners.map(B); if(i!==snaps[0]&&i!==snaps[4]) fb.push(...cs); L.polygon(cs,{color:'#ffffff',weight:1.5,fillColor:PLC.sweep,fillOpacity:.35,interactive:false}).addTo(PL.lay.sweep); }); });
  L.polyline(s.lane.map(B),{color:'#ffffff',weight:1,dashArray:'4 4',opacity:.8,interactive:false}).addTo(PL.lay.sweep);
  const ev=r.ev; if(ev){
    if(ev.outPt&&ev.out>0.2) L.circleMarker(B(ev.outPt),{radius:9,color:'#ffffff',weight:2,fillColor:PLC.danger,fillOpacity:1}).addTo(PL.lay.sweep).bindTooltip(`도로 밖 침범 추정 ${f1(ev.out)} m`,{permanent:true,direction:'top'});
    if(ev.oppPt&&ev.opp>0.3) L.circleMarker(B(ev.oppPt),{radius:9,color:'#ffffff',weight:2,fillColor:PLC.warning,fillOpacity:1}).addTo(PL.lay.sweep).bindTooltip(`대향 차로 침범 ${f1(ev.opp)} m`,{permanent:true,direction:'top'}); }
  fb.push([r.lat,r.lng]); PL.map.fitBounds(L.latLngBounds(fb).pad(0.35),{maxZoom:20});
}

/* ---------- 결과 렌더링 ---------- */
function plClearResult(){ PL.res=null; PL.sel=-1; document.getElementById('pl-result').hidden=true; document.getElementById('pl-detail').hidden=true; if(PL.map){PL.lay.route.clearLayers();PL.lay.turns.clearLayers();PL.lay.sweep.clearLayers();PL.lay.flags.clearLayers();} }
function plRenderResult(){
  const R=PL.res; if(!R) return; document.getElementById('pl-result').hidden=false;
  const f=parseFloat(document.getElementById('pl-factor').value)||1.3;
  const ev=R.rows.filter(r=>r.ev), nd=ev.filter(r=>r.ev.v==='danger').length, nw=ev.filter(r=>r.ev.v==='warning').length;
  document.getElementById('pl-kpis').innerHTML=
    `<span class="gs-chip">총 거리 <b class="gs-num">${kmTxt(R.dist)}</b></span>
     <span class="gs-chip">예상 소요 <b class="gs-num">약 ${Math.round(R.dur*f/60)}분</b> (대형차 보정)</span>
     <span class="gs-chip">회전 검토 <b class="gs-num">${ev.length}곳</b> ${vbadge('danger')} <b class="gs-num">${nd}</b> ${vbadge('warning')} <b class="gs-num">${nw}</b></span>
     <span class="gs-chip">차량 <b>${esc(VEH_PRESETS[VEH.key]?VEH_PRESETS[VEH.key].name:'사용자 정의')}</b></span>`;
  document.getElementById('pl-warns').innerHTML=R.warns.map(w=>`<div class="gs-alert gs-alert--warning" role="status"><p class="gs-alert__title">지점 보정</p><p class="gs-alert__body">${esc(w)}</p></div>`).join('');
  const v=PL.pts.filter(p=>p.lat!=null), o=v[0], d=v[v.length-1], w=v.slice(1,-1).slice(0,9);
  document.getElementById('pl-gmaps').href=`https://www.google.com/maps/dir/?api=1&origin=${o.lat},${o.lng}&destination=${d.lat},${d.lng}${w.length?'&waypoints='+w.map(p=>`${p.lat},${p.lng}`).join('%7C'):''}&travelmode=driving`;
  plRenderSteps(); plRenderBan(); plRenderRestrict(); plRenderVehCheck();
}
function plRenderSteps(){
  const R=PL.res; if(!R) return; const t=document.getElementById('pl-steps');
  const rows=R.rows.filter(r=>r.kind!=='arrive'||true);
  t.innerHTML='<thead><tr><th>No.</th><th>안내</th><th>도로</th><th class="is-num">회전각</th><th>판정</th><th>근거(추정)</th><th class="is-num">통과 예정</th><th class="is-num">누적</th></tr></thead><tbody>'+
    rows.map(r=>{ const i=R.rows.indexOf(r), ev=r.ev;
      const why=ev?[ev.out>0.2?`도로 밖 ${f1(ev.out)} m`:'',ev.opp>0.3?`대향차로 ${f1(ev.opp)} m`:'',(r.restr||[]).length?'제한 표지':''].filter(Boolean).join(' · ')||'차로 내 회전':'';
      return `<tr class="${ev?'is-click':''}${i===PL.sel?' is-sel':''}" data-i="${i}"${ev?' tabindex="0"':''}>
        <td>${r.no?`<span class="num" style="background:${PLC[ev?ev.v:'na']};width:30px;height:30px;font-size:11px">${r.no}</span>`:''}</td>
        <td>${esc(r.text)}</td><td class="is-sub">${esc(r.road)}</td>
        <td class="is-num">${r.isTurn?`${r.angle>0?'우':'좌'} ${Math.round(Math.abs(r.angle))}°`:''}</td>
        <td>${ev?vbadge(ev.v)+(ev.est?' <span class="is-sub">추정</span>':''):''}</td>
        <td class="is-sub">${why}</td>
        <td class="is-num">${r.at?hhmm(r.at):''}</td><td class="is-num">${kmTxt(r.cumD)}</td></tr>`; }).join('')+'</tbody>';
  t.querySelectorAll('tr.is-click').forEach(tr=>{ const go=()=>plSelect(+tr.dataset.i,true); tr.addEventListener('click',go); tr.addEventListener('keydown',e=>{if(e.key==='Enter')go();}); });
}
function plRenderBan(){
  const R=PL.res, el=document.getElementById('pl-ban'); if(!R||!R.ban){ el.innerHTML=''; return; } const B=R.ban;
  const loading=(R.samples||[]).some(s=>s.city===undefined);
  let h='';
  if(!B.heavy) h+=`<div class="gs-alert" role="status"><p class="gs-alert__title">트럭 밴 대상 아님</p><p class="gs-alert__body">총중량 4,500 kg 이하 차량은 MMDA 화물차 정의(Reg. 99-002) 밖입니다. EDSA 등 경트럭 규정은 별도로 확인하십시오.</p></div>`;
  else if(B.conflicts) h+=`<div class="gs-alert gs-alert--warning" role="alert"><p class="gs-alert__title">금지 시간대에 통과하는 구간이 ${B.conflicts}곳 있습니다</p><p class="gs-alert__body">${B.suggest?`같은 날짜 기준으로 위반 없이 출발할 수 있는 가장 빠른 시각은 <b class="gs-num">${DOW[B.suggest.dep.getDay()]} ${hhmm(B.suggest.dep)}</b> (도착 약 ${hhmm(B.suggest.arr)})입니다.`:'24시간 안에서 위반 없는 출발 시각을 찾지 못했습니다.'} 위반 시 벌금 외에 단속 지점 정차로 레미콘 타설 시간이 지연될 수 있습니다.</p></div>`;
  else h+=`<div class="gs-alert" role="status"><p class="gs-alert__title">${loading?'행정구역 확인 중 (MMDA 규정 기준 1차 판정)':'출발 일시 기준 금지 시간대 통과 구간 없음'}</p><p class="gs-alert__body">출발 ${DOW[B.dep.getDay()]} ${hhmm(B.dep)} · 도착 약 ${hhmm(R.arrive)}. ${B.dep.getDay()===0?'일요일·공휴일 적용 여부는 현행 고시로 확인하십시오.':''}</p></div>`;
  h+='<div class="gs-table-wrap"><table class="gs-table"><thead><tr><th>구간</th><th>통과 예정</th><th>적용 규정</th><th>금지 시간대</th><th>판정</th><th>벌금·비고</th></tr></thead><tbody>'+
    B.segs.map(g=>`<tr><td>${esc(g.city||(g.city===null?'행정구역 미확인':'확인 중…'))}${g.exp?' · 유료도로':''}<div class="is-sub">${esc(g.roads.slice(0,3).join(', '))}</div></td>
      <td class="gs-num">${hhmm(g.t0)}–${hhmm(g.t1)}</td>
      <td>${g.rules&&g.rules.length?g.rules.map(x=>`${esc(x.rule.label)}<div class="is-sub">${esc(x.rule.basis)}</div>`).join(''):'—'}</td>
      <td class="gs-num">${g.rules&&g.rules.length?g.rules.map(x=>winTxt(x.rule.win)).join('<br>'):'—'}</td>
      <td>${vbadge(g.v)}${g.rules?g.rules.filter(x=>x.hits).map(()=>'').join(''):''}</td>
      <td class="is-sub">${g.note?esc(g.note):''}${g.rules?g.rules.map(x=>`${x.hits?`<div><b>${esc(x.rule.label)}</b>: ${esc(x.rule.fine)}</div>`:''}${x.exempt?`<div>${esc(x.exempt)}</div>`:''}${x.rule.note?`<div>${esc(x.rule.note)}</div>`:''}`).join(''):''}</td></tr>`).join('')+'</tbody></table></div>';
  h+='<p class="hint">규정은 공개 자료 기준이며(리스크·체크리스트 화면의 규정표 참고), 시간대·금액이 바뀌었을 수 있습니다. 통과 시각은 승용차 기준 소요시간에 대형차 보정 계수를 곱한 추정입니다.</p>';
  el.innerHTML=h;
}
function plRenderRestrict(){
  const R=PL.res, el=document.getElementById('pl-restrict'); if(!R) return;
  if(!R.restr){ el.innerHTML='<p class="hint">경로 주변 제한 표지를 확인하는 중입니다…</p>'; return; }
  if(R.restr.error){ el.innerHTML='<p class="hint">제한 표지 정보를 불러오지 못했습니다. 잠시 후 "경로 계산하기"를 다시 누르십시오.</p>'; return; }
  if(!R.restr.length){ el.innerHTML='<p class="hint">OpenStreetMap에 등록된 높이·중량·폭·대형차 통행 제한이 경로 주변에 없습니다. 미등록 제한(육교·전선 높이 등)은 Street View와 현장에서 확인하십시오.</p>'; return; }
  el.innerHTML='<div class="gs-table-wrap"><table class="gs-table"><thead><tr><th>도로</th><th>제한</th><th>값</th><th>판정</th><th></th></tr></thead><tbody>'+
    R.restr.map((x,i)=>`<tr><td>${esc(x.name)}</td><td>${esc(x.label)}</td><td class="gs-num">${esc(x.val)}</td><td>${overOf(x)?vbadge('danger'):vbadge('warning')}</td><td>${x.c?`<button class="gs-btn gs-btn--sm" type="button" data-rz="${i}">지도에서 보기</button>`:''}</td></tr>`).join('')+'</tbody></table></div>';
  el.querySelectorAll('[data-rz]').forEach(b=>b.addEventListener('click',()=>{const x=R.restr[+b.dataset.rz];PL.map.setView([x.c.lat,x.c.lng],18);document.getElementById('map-planner').scrollIntoView({behavior:'smooth',block:'center'});}));
}
function plRenderVehCheck(){
  const el=document.getElementById('pl-vehcheck'), lim=DPWH_LIMIT[VEH.cfg], L=vehLen(VEH), items=[];
  items.push([VEH.GVW>lim[1]?'danger':'success','총중량',`${Math.round(VEH.GVW).toLocaleString()} kg / DPWH 한도(${lim[0]}) ${lim[1].toLocaleString()} kg`,VEH.GVW>lim[1]?'한도 초과 — 과적 단속 대상(MVUC 25% 벌금). 분리 불가 화물이면 DPWH 특별통행허가 필요':'한도 이내']);
  items.push([VEH.GVW>4500?'warning':'success','트럭 밴 대상',VEH.GVW>4500?'총중량 4,500 kg 초과 화물차':'4,500 kg 이하',VEH.GVW>4500?'금지 시간대 통행 불가(예외 화물 제외)':'화물차 트럭 밴 대상 아님']);
  items.push([VEH.W>2.5?'danger':'success','차폭',`${f1(VEH.W)} m`,VEH.W>2.5?'일반적 차폭 한도(2.5 m) 초과로 보임 — 규격 초과 운송 허가·호송 필요 여부 확인':'일반 범위']);
  items.push([VEH.H>=4.0?'warning':'success','높이',`${f1(VEH.H)} m`,VEH.H>=4.0?'고가 하부·육교·횡단 전선 저촉 위험 — 경로상 높이 제한 표·Street View 확인':'일반 범위']);
  items.push([L>=15?'warning':'success','전장',`${f1(L)} m`,L>=15?'장대 차량 — 회전 지점 궤적과 대향차로 통제 계획 필요':'일반 범위']);
  el.innerHTML='<div class="gs-table-wrap"><table class="gs-table"><thead><tr><th>항목</th><th>값</th><th>판정</th><th>의견</th></tr></thead><tbody>'+
    items.map(([v,a,b,c])=>`<tr><td>${a}</td><td class="gs-num">${b}</td><td>${vbadge(v)}</td><td class="is-sub">${c}</td></tr>`).join('')+'</tbody></table></div>';
}

/* ---------- 회전 지점 상세 ---------- */
function svUrl(lat,lng,h){return `https://maps.google.com/maps?layer=c&cbll=${lat},${lng}&cbp=11,${Math.round((h+360)%360)},0,0,0&output=svembed`;}
function svLink(lat,lng,h){return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}&heading=${Math.round((h+360)%360)}`;}
function svView(r){
  const R=PL.res; if(PL.svdir==='out'){ return {p:{lat:r.lat,lng:r.lng},h:r.bOut}; }
  if(PL.svdir==='side'){ return {p:{lat:r.lat,lng:r.lng},h:r.bIn+(r.angle>=0?70:-70)}; }
  const p=pathPointAt(R,r.pi,-22); return {p,h:r.bIn};
}
function plSelect(i,fromUser){
  PL.sel=i; const r=PL.res.rows[i]; document.getElementById('pl-detail').hidden=false;
  document.querySelectorAll('#pl-steps tr').forEach(tr=>tr.classList.toggle('is-sel',+tr.dataset.i===i));
  plDrawSweep(r); plRenderDetail(true);
  if(fromUser) document.getElementById('map-planner').scrollIntoView({behavior:'smooth',block:'start'});
}
function plStepSel(dir){ const R=PL.res; if(!R) return; const idx=R.rows.map((r,i)=>r.ev?i:-1).filter(i=>i>=0); if(!idx.length) return;
  let k=idx.indexOf(PL.sel); k=k<0?0:(k+dir+idx.length)%idx.length; plSelect(idx[k],false); }
function ideasFor(r){
  const ev=r.ev, s=r.sim, L=[]; const V=VEH;
  if(!ev) return L;
  if(ev.out>0.5) L.push(`회전 안쪽(가각부)에서 도로 밖으로 약 ${f1(ev.out)} m 벗어나는 것으로 추정됩니다. 지도의 빨간 점 위치에 연석·전주·담장·배수로가 있는지 Street View로 확인하십시오.`);
  else if(ev.out>0.2) L.push(`가각부 여유가 작습니다(약 ${f1(ev.out)} m 침범 추정). 연석을 밟거나 보도 쪽으로 차체가 넘어갈 수 있습니다.`);
  if(ev.opp>0.3) L.push(`회전 중 대향 차로를 약 ${f1(ev.opp)} m 침범합니다. 신호수 배치, 야간·저교통 시간대 운행, 일시 차로 통제로 대응할 수 있습니다.`);
  if(ev.out>0.5&&ev.opp>0.3) L.push('안쪽과 바깥쪽이 모두 부족합니다. 진입 전 바깥 차로로 크게 벌려 들어가거나 전·후진을 반복해야 할 수 있어, 신호수와 교통 통제가 필요합니다.');
  if(r.uturn) L.push('대형차 U턴은 중앙분리대 개구부와 대향 차로 폭이 함께 확보돼야 합니다. 블록을 한 바퀴 도는 우회(우회전 3회) 경유지를 넣어 비교해 보십시오.');
  else if(Math.abs(r.angle)>=120) L.push('예각 회전입니다. 반대 방향에서 접근하도록 경유지를 조정하면 회전각을 줄일 수 있습니다.');
  if(ev.v==='danger'){
    L.push('가각 정리(연석 절개·임시 포장)나 전주·표지판 이설을 관리청·바랑가이와 협의하는 방안을 검토하십시오.');
    L.push(V.type==='semi'?'세미트레일러 대신 단차 트럭으로 나눠 운송하거나, 회전이 쉬운 다른 진입로를 경유지로 지정해 비교하십시오.':'더 짧은 차량(예: 레미콘 6m³ → 4m³)으로 바꾸면 궤적 폭이 줄어듭니다. 차종을 바꿔 다시 확인해 보십시오.');
  }
  if(Math.abs(r.angle)>=60&&Math.abs(r.angle)<150&&r.angle<0&&ev.v!=='success') L.push('좌회전이 어렵다면, 직진 후 다음 교차로에서 우회전을 반복해 돌아오는 경로를 경유지로 지정해 비교해 보십시오.');
  (r.restr||[]).forEach(x=>L.push(`${x.label} ${x.val} — ${overOf(x)?'차량 제원 초과: 이 지점을 피하는 경유지가 필요합니다':'제한 내용 확인 필요'}`));
  if(ev.A&&ev.A.lvl&&ev.A.lvl.code!=='ground'||ev.E&&ev.E.lvl&&ev.E.lvl.code!=='ground') L.push('이 지점 주변에 고가·지하 도로가 겹쳐 있습니다. 경로가 의도한 지상 도로를 지나는지 경유지의 "붙일 도로"를 확인하십시오.');
  if(ev.est) L.push('도로 폭 일부를 기본값으로 추정했습니다. Street View로 실제 차로 수와 폭을 확인하면 판정이 달라질 수 있습니다.');
  if(ev.v==='success') L.push('추정상 차로 안에서 회전 가능합니다. 노상 주차·노점·트라이시클 정차로 유효 폭이 줄 수 있으니 통행 시간대에 확인하십시오.');
  L.push(`Street View에서 확인할 것: 회전 안쪽 연석·전주·표지판 위치, 상부 전선·구조물 높이(차량 ${f1(V.H)} m), 노상 주차·노점.`);
  return L;
}
function plRenderDetail(reloadSv){
  const R=PL.res, r=R&&R.rows[PL.sel]; if(!r) return; const ev=r.ev, s=r.sim;
  document.getElementById('pd-title').textContent=`${r.no||''} · ${r.text}${r.road?' → '+r.road:''}`;
  const sv=svView(r);
  if(reloadSv){ document.getElementById('pd-sv').src=svUrl(sv.p.lat,sv.p.lng,sv.h); }
  document.getElementById('pd-svlink').href=svLink(sv.p.lat,sv.p.lng,sv.h);
  const road=w=>w?`${esc(w.name)} · 폭 ${f1(w.w)} m${w.oneway?' · 일방':' · 양방향'} · ${esc(w.lvl?w.lvl.label:'')} <span class="is-sub">(${esc(w.src)})</span>`:`<span class="is-sub">${r.enriched?'OSM 미등록 — 기본값 6.4 m 양방향':'불러오는 중 — 임시 기본값 6.4 m'}</span>`;
  document.getElementById('pd-metrics').innerHTML=ev?`
    <dt>판정</dt><dd>${vbadge(ev.v)}${ev.est?' <span class="is-sub">도로 폭 추정 포함</span>':''}</dd>
    <dt>회전</dt><dd>${r.angle>0?'우회전':'좌회전'} ${Math.round(Math.abs(r.angle))}°${r.uturn?' (U턴)':''}</dd>
    <dt>좌표</dt><dd class="gs-num">${r.lat.toFixed(6)}, ${r.lng.toFixed(6)}</dd>
    <dt>접근 도로</dt><dd>${road(ev.A===r.wayA?r.wayA:null)}</dd>
    <dt>진출 도로</dt><dd>${road(ev.E===r.wayE?r.wayE:null)}</dd>
    <dt>가정한 주행 방법</dt><dd>${ev.shift?`회전 직전 바깥쪽으로 약 ${ev.shift} m 벌려 진입`:'차로를 따라 그대로 회전'}</dd>
    <dt>가각 반경(가정)</dt><dd class="gs-num">${f1(ev.rc)} m</dd>
    <dt>회전 중 점유 폭</dt><dd class="gs-num">${f1(s.swept)} m <span class="is-sub">(직진 시 ${f1(VEH.W)} m)</span></dd>
    <dt>도로 밖 침범</dt><dd class="gs-num">${ev.out>0.2?f1(ev.out)+' m':'없음'}</dd>
    <dt>대향 차로 침범</dt><dd class="gs-num">${ev.opp>0.3?f1(ev.opp)+' m':'없음'}</dd>
    <dt>내륜차(오프트래킹)</dt><dd class="gs-num">${f1(s.offtrack)} m</dd>
    <dt>앞축 회전 반경(가정)</dt><dd class="gs-num">${f1(s.Rf)} m</dd>
    <dt>통과 예정</dt><dd class="gs-num">${r.at?DOW[r.at.getDay()]+' '+hhmm(r.at):'—'}</dd>`:'';
  document.getElementById('pd-ideas').innerHTML=ideasFor(r).map(t=>`<li>${esc(t)}</li>`).join('');
}
function askText(r){
  const ev=r.ev, s=r.sim, V=VEH, sv=svView(r);
  return `[경로 회전 지점 검토 요청]
지점: ${r.no} ${r.text}${r.road?' → '+r.road:''}
좌표: ${r.lat.toFixed(6)}, ${r.lng.toFixed(6)}
Street View: ${svLink(sv.p.lat,sv.p.lng,sv.h)}
회전: ${r.angle>0?'우회전':'좌회전'} ${Math.round(Math.abs(r.angle))}°${r.uturn?' (U턴)':''}
차량: ${VEH_PRESETS[V.key]?VEH_PRESETS[V.key].name:'사용자 정의'} · 전장 ${f1(vehLen(V))} m · 폭 ${f1(V.W)} m · 높이 ${f1(V.H)} m · 총중량 ${Math.round(V.GVW)} kg · 최소회전반경 ${f1(V.Ro)} m
추정: 회전 중 점유 폭 ${f1(s.swept)} m, 도로 밖 침범 ${f1(ev.out)} m, 대향 차로 침범 ${f1(ev.opp)} m, 판정 ${VERD[ev.v][1]}
도로: 접근 ${ev.A.name||''} ${f1(ev.A.w)} m(${ev.A.src||''}), 진출 ${ev.E.name||''} ${f1(ev.E.w)} m(${ev.E.src||''})
이 지점의 Street View를 보고 실제로 이 차량이 회전할 수 있는지, 장애물(연석·전주·전선·노상 점유)과 개선 아이디어를 알려줘.`;
}

/* ---------- 저장 · 불러오기 ---------- */
function plSerialize(){ return {p:PL.pts.map(p=>[p.lat,p.lng,p.mode==='line'?1:0]),v:VEH,u:document.getElementById('pl-uturn').checked?1:0}; }
function plLoad(o){
  try{ PL.pts=o.p.map(a=>{const p=newPt(a[0],a[1],a[2]?'line':'road'); return p;});
    while(PL.pts.length<2) PL.pts.push(newPt());
    if(o.v&&o.v.type){ VEH=Object.assign({},VEH,o.v); vehRender(); }
    if(o.u!=null) document.getElementById('pl-uturn').checked=!!o.u;
    PL.pts.forEach(p=>{ if(p.lat!=null) plFetchCands(p); });
    plChanged(200); setTimeout(plFit,100);
  }catch(e){ toast('경로 정보를 읽지 못했습니다.'); }
}
function plFromHash(){ if(!location.hash.startsWith('#plan=')) return null; try{ return JSON.parse(decodeURIComponent(location.hash.slice(6))); }catch(e){ return null; } }
function plSaveDraft(){ lsSet('gs-route-planner-draft',plSerialize()); }
function plSaveRoute(){
  const name=document.getElementById('pl-name').value.trim()||`경로 ${new Date().toLocaleString('ko-KR')}`;
  const list=lsGet('gs-route-planner-saved',[]).filter(x=>x.name!==name); list.unshift(Object.assign({name,at:new Date().toISOString()},plSerialize()));
  toast(lsSet('gs-route-planner-saved',list)?'경로를 저장했습니다.':'이 브라우저에서는 저장할 수 없습니다. 링크 복사를 이용하십시오.');
  document.getElementById('pl-name').value=''; plRenderSaved();
}
function plRenderSaved(){
  const list=lsGet('gs-route-planner-saved',[]), el=document.getElementById('pl-saved');
  el.innerHTML=list.length?list.map((x,i)=>`<div class="saved-item"><div>${esc(x.name)}<small>지점 ${x.p.length}개 · ${esc(x.v&&VEH_PRESETS[x.v.key]?VEH_PRESETS[x.v.key].name:'')}</small></div><div class="pt-actions"><button class="gs-btn gs-btn--sm" type="button" data-load="${i}">불러오기</button><button class="gs-btn gs-btn--sm gs-btn--ghost" type="button" data-delr="${i}">삭제</button></div></div>`).join(''):'<p class="hint">저장한 경로가 없습니다.</p>';
  el.querySelectorAll('[data-load]').forEach(b=>b.addEventListener('click',()=>plLoad(list[+b.dataset.load])));
  el.querySelectorAll('[data-delr]').forEach(b=>b.addEventListener('click',()=>{ list.splice(+b.dataset.delr,1); lsSet('gs-route-planner-saved',list); plRenderSaved(); }));
}
