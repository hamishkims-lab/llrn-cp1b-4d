/* LLRN CP1B — 2단계 가상 현장 · 메신저 핵심 로직 (화면 없이 동작, node 시험 가능)
   - 작업 배정: WBS 경로로 activity를 5개 작업반(가상 인원)에 나눔
   - 계획 메시지: 작업반별 그날 할 일 번호 목록
   - 가상 현장: 시나리오(정상·우천·장비 고장·생산성 저하)에 따라 실제 진척(정답)을 만들고 회신 문장을 씀
   - 회신 해석: 번호형("1. 60%")과 자유 문장("P61 파일캡 완료")을 activity·진척으로 바꿈 (4단계에서 Claude API가 이 자리를 대신함)
   - 날짜 규칙: 현장 시각(UTC+8) 07:00 전에 온 회신은 전날 실적 */
(function(root){
const CREW=[
  {id:'c1',name:'김민수',role:'반장',team:'Bored pile',style:'num',prod:1.0},
  {id:'c2',name:'R. Santos',role:'반장',team:'하부공 (교각·교대)',style:'ko',prod:1.0},
  {id:'c3',name:'이정훈',role:'과장',team:'성토·지반개량',style:'mix',prod:1.0},
  {id:'c4',name:'J. Reyes',role:'협력사',team:'가설잔교·거더 제작',style:'en',prod:1.0},
  {id:'c5',name:'M. Cruz',role:'반장',team:'상부공·부대공',style:'num2',prod:1.0}];
// WBS path -> crew (order matters)
function crewOf(path,name){const p=path.join(' > ')+' > '+name;
  if(/Temporary Bridge|Fabrication of Girders|Temporary Facilities|Removal/i.test(p))return 'c4';
  if(/Schedule of Bored Pile/i.test(p))return 'c1';
  if(/Super structure|Other work/i.test(p))return 'c5';
  if(/Schedule of Substructure/i.test(p))return 'c2';
  if(/Slip Road|Sliproad|Alabing|Embankment|Soil Treatment|Surcharg|BOX Culvert/i.test(p))return 'c3';
  return 'gm'}   // milestones, documents: 공무 records them directly
// work keywords: re = recognises the word in a reply or an activity name, ko/en = how a crew writes it
const KW=[
  {k:'sonic',re:/sonic|음파|그라우팅|grout/i,ko:'음파검사',en:'sonic test'},
  {k:'sheet',re:/sheet\s*pile|sheetpile|시트\s*파일|시트|가물막이/i,ko:'시트파일',en:'sheet pile'},
  {k:'pilecap',re:/pile\s*cap|pilecap|파일\s*캡|기초/i,ko:'파일캡',en:'pile cap'},
  {k:'coping',re:/coping|pier\s*cap|piercap|코핑/i,ko:'코핑',en:'coping'},
  {k:'col2',re:/column\s*2|기둥\s*2|2\s*lot|2차\s*기둥/i,ko:'기둥 2차',en:'column 2'},
  {k:'col1',re:/column\s*1|기둥\s*1|1\s*lot|1차\s*기둥|기둥|column/i,ko:'기둥 1차',en:'column 1'},
  {k:'bearing',re:/bearing|받침|교좌/i,ko:'받침',en:'bearing'},
  {k:'backfill',re:/back\s*fill|되메우기/i,ko:'되메우기',en:'backfill'},
  {k:'exc',re:/excavat|굴착|터파기/i,ko:'굴착',en:'excavation'},
  {k:'pile',re:/bored\s*pile|pile(?!\s*cap)|천공|말뚝|파일(?!\s*캡)/i,ko:'천공',en:'bored pile'},
  {k:'diaph',re:/diaphragm|가로보|다이아프램/i,ko:'가로보',en:'diaphragm'},
  {k:'deckform',re:/deck\s*slab\s*form|slab\s*form|데크\s*거푸집|슬래브\s*거푸집/i,ko:'슬래브 거푸집',en:'deck form'},
  {k:'cure',re:/curing|양생/i,ko:'양생',en:'curing'},
  {k:'connconc',re:/conection|connection|접합|연결\s*콘크리트/i,ko:'연결 콘크리트',en:'connection concrete'},
  {k:'strand',re:/strand|tension|긴장|강연선/i,ko:'긴장',en:'tensioning'},
  {k:'rebar',re:/rebar|철근|formwork|거푸집/i,ko:'철근·거푸집',en:'rebar & formwork'},
  {k:'conc',re:/concrete|concret|pouring|타설|콘크리트/i,ko:'타설',en:'concrete'},
  {k:'span',re:/temporary|temp\.?\s*bridge|trestle|가설\s*교|잔교|span/i,ko:'가설잔교',en:'temp bridge'},
  {k:'cast',re:/casting|girder\s*form|제작/i,ko:'거더 제작',en:'girder casting'},
  {k:'emb',re:/embank|enbank|성토|\bfill\b/i,ko:'성토',en:'embankment'},
  {k:'gravel',re:/gravel|grave\s*fill|쇄석|자갈|rock/i,ko:'쇄석',en:'gravel'},
  {k:'geo',re:/geot|geotax|부직포/i,ko:'부직포',en:'geotextile'},
  {k:'pvd',re:/pvd/i,ko:'PVD',en:'PVD'},
  {k:'dmm',re:/dmm|\bdsm|심층혼합/i,ko:'DMM',en:'DMM'},
  {k:'soil',re:/soil\s*rep|치환/i,ko:'치환',en:'soil replacement'},
  {k:'pump',re:/pump|배수|양수/i,ko:'배수',en:'water pumping'},
  {k:'clean',re:/clean|정리|청소/i,ko:'정리',en:'cleaning'},
  {k:'prep',re:/prepar|준비/i,ko:'준비',en:'preparation'},
  {k:'surch',re:/surcharg|preload|프리로드|재하/i,ko:'재하성토',en:'surcharge'},
  {k:'removal',re:/removal|remove|철거/i,ko:'철거',en:'removal'},
  {k:'joint',re:/joint|신축/i,ko:'신축이음',en:'expansion joint'},
  {k:'barrier',re:/barrier|방호벽/i,ko:'방호벽',en:'barrier'},
  {k:'asph',re:/asphalt|포장/i,ko:'포장',en:'asphalt'},
  {k:'import',re:/import|반입|material/i,ko:'자재 반입',en:'material import'}];
const kwOf=s=>KW.find(k=>k.re.test(s))||null;
// location token from the activity or its parents: P61, A1, R2-3, 슬래브 12, Span 30
function locOf(t,path){const src=[String(t.name),...[...path].reverse().slice(0,3)].join(' | ');let m;
  if((m=src.match(/\bR(?:amp)?\s*-?\s*(\d)\s*-\s*(\d+)/i)))return {k:'R',n:m[1]+'-'+m[2],ko:`R${m[1]}-${m[2]}`};
  if((m=src.match(/\bPIER\s*-?\s*(\d+)/i))||(m=src.match(/\bP\s*-?\s*(\d+)\b/)))return {k:'P',n:m[1],ko:'P'+m[1]};
  if((m=src.match(/\bAB(?:OU|U)T\w*\s*-?\s*(\d+)/i)))return {k:'A',n:m[1],ko:'A'+m[1]};
  if((m=src.match(/\bSpan\s*(\d+)\b/i)))return {k:'S',n:m[1],ko:'Span '+m[1]};
  if((m=src.match(/slab\s*(\d+)\b/i))||(m=src.match(/PC Box\s*([\d,]+)/i)))return {k:'D',n:m[1],ko:'슬래브 '+m[1]};
  if((m=src.match(/\b(Sucat|Sucut|Alab\w*|Albang|Albiag)\b/i)))return {k:'Z',n:/^s/i.test(m[1])?'Sucat':'Alabang',ko:/^s/i.test(m[1])?'Sucat':'Alabang'};
  return null}
const shortName=s=>String(s).trim().replace(/^-\s*/,'').replace(/\s*[\d,.]+\s*(?:set|m3|m|ea|nos|day)?\s*[=\/*].*$/i,'').replace(/\s+/g,' ').trim();
// one row per leaf activity the messenger can talk about
function catalog(tasks,ctx){const out={};
  for(const t of tasks){if(t.summary||!t.start||!t.finish||!String(t.name||'').trim())continue;const path=ctx.path[t.id]||[];
    const kw=kwOf(String(t.name))||kwOf(path[path.length-1]||'');const loc=locOf(t,path);
    out[String(t.uid)]={uid:String(t.uid),id:t.id,crew:crewOf(path,String(t.name)),kw:kw&&kw.k,loc,name:shortName(t.name),parent:String(path[path.length-1]||'').trim(),dur:Math.max(1,+t.dur||1),
      label:`${loc?loc.ko+' · ':''}${shortName(t.name)}`}}
  return out}
// ---------- deterministic random ----------
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rnd(...k){let a=hash(k.join('|'));a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}
// ---------- scenarios: productivity factor and stop reason for a crew on a day ----------
const SCEN={normal:'정상',rain:'우천 (우기)',breakdown:'장비 고장 (하부공 크레인 5일)',slow:'생산성 저하 (Bored pile 70%)',all:'복합 (우천 + 고장 + 생산성 저하)'};
function dayFactor(scen,seed,date,crew,dayNo){const has=k=>scen===k||scen==='all';let f=1,why=null;
  if(has('rain')&&rnd(seed,'rain',date)<0.3){if(crew==='c3'||crew==='c4'){f=0;why='rain'}else f=0.5}
  if(has('breakdown')&&crew==='c2'&&dayNo>=3&&dayNo<8){f=0;why='equip'}
  if(has('slow')&&crew==='c1')f*=0.7;
  return {f,why}}
const WHY={rain:{ko:'비 때문에 작업 중지',en:'Rain, no work today'},equip:{ko:'크레인 고장으로 작업 중지',en:'Crane breakdown, stopped'}};
// ---------- reply text written by the virtual crew ----------
function writeReply(style,items,seed,date){   // items: [{no, cat, done, pct, stop}]
  const L=[];
  for(const it of items){const c=it.cat,kw=KW.find(k=>k.k===c.kw),loc=c.loc?c.loc.ko:'',w=kw?kw.ko:c.name,we=kw?kw.en:c.name,r=rnd(seed,date,c.uid,'v');
    const v=it.stop?(style==='en'||style==='num'&&r<0.3?WHY[it.stop].en:WHY[it.stop].ko):it.done?(r<0.5?'완료':r<0.8?'끝':'done'):`${it.pct}%`;
    if(style==='num')L.push(`${it.no}. ${v}`);
    else if(style==='num2')L.push(`${it.no}번 ${it.stop?v:it.done?'끝':it.pct}`);
    else if(style==='en')L.push(it.stop?`${loc?loc+' ':''}${we}: ${v}`:`${loc?loc+' ':''}${we} ${it.done?'completed':it.pct+'% done'}`);
    else if(style==='ko')L.push(it.stop?`${loc} ${w} ${v}`:`${loc} ${w} ${it.done?(r<0.5?'완료했습니다':'끝났습니다'):it.pct+'% 진행'}`);
    else L.push(it.stop?`${w}${loc&&c.loc.k!=='Z'?' '+loc:''} ${v}`:`${loc&&c.loc.k==='Z'?loc+' ':''}${w}${loc&&c.loc.k!=='Z'?' '+loc:''} ${it.done?'완료':it.pct+'%'}`)}
  const sep=style==='mix'?' / ':style==='ko'?'. ':'\n';
  return (style==='ko'?'오늘 실적입니다. ':'')+L.join(sep)}
// ---------- reply parser ----------
// plan: [{no, uid}] of the crew's plan message for that day; cat: catalogue
function parseReply(text,plan,cat){const out=[];const T=String(text).replace(/오늘\s*실적(입니다)?[.:]?/,'').trim();
  const raw=T.split(/\n|\s\/\s|;|,(?!\d)|(?<=[가-힣%a-z])\.\s+/i).map(s=>s.trim()).filter(Boolean);
  // a piece with no item number, location or work word belongs to the piece before it ("Rain, no work today")
  const segs=[];for(const x of raw){const ind=/^\s*\d{1,2}\s*(번|\.|\)|:|-|\s)/.test(x)||/\b(P|PIER|A|R\d|Span|S)\s*-?\d/i.test(x)||KW.some(k=>k.re.test(x))||/sucat|alab/i.test(x);
    if(!ind&&segs.length)segs[segs.length-1]+=', '+x;else segs.push(x)}
  const stopRe=/(중지|중단|못\s*함|작업\s*없음|stop|no\s*work|rain|비\s*때문|우천|고장|breakdown|자재\s*미입고)/i;
  const doneRe=/(완료|끝|마침|마무리|done(?!\s*today)|finish|complete)/i;
  for(const s of segs){let m,no=null,rest=s;
    if((m=s.match(/^\s*(\d{1,2})\s*(?:번|\.|\)|:|-)\s*(.*)$/))&&+m[1]>=1&&+m[1]<=plan.length){no=+m[1];rest=m[2]}
    else if((m=s.match(/^\s*(\d{1,2})\s+(\d{1,3}|완료|끝|done)\s*%?\s*$/i))&&+m[1]<=plan.length){no=+m[1];rest=m[2]}
    let kind=null,pct=null,why=null;
    const pm0=rest.match(/(\d{1,3}(?:\.\d+)?)\s*(%|퍼센트|프로)/);
    if(stopRe.test(rest)&&!pm0&&!doneRe.test(rest.replace(stopRe,''))){kind='stop';why=/rain|비|우천/i.test(rest)?'rain':/고장|breakdown/i.test(rest)?'equip':/자재/i.test(rest)?'material':'other'}
    else{if(stopRe.test(rest))why=/rain|비|우천/i.test(rest)?'rain':/고장|breakdown/i.test(rest)?'equip':'other';   // progress made, then stopped: keep the progress
      const pm=rest.match(/(\d{1,3}(?:\.\d+)?)\s*(%|퍼센트|프로)/)||(no!=null?rest.match(/^\s*(\d{1,3})\s*$/):null);
      if(/\d{1,3}\s*%\s*done/i.test(rest)&&pm){kind='pct';pct=Math.min(100,+pm[1])}
      else if(doneRe.test(rest)){kind='done';pct=100}else if(pm){kind='pct';pct=Math.min(100,+pm[1])}}
    if(!kind){out.push({seg:s,uid:null,kind:null,conf:0.2});continue}
    if(kind==='pct'&&pct>=100)kind='done';
    if(no!=null){out.push({seg:s,uid:plan[no-1].uid,kind,pct,why,conf:1,how:'번호'});continue}
    // free text: score the crew's plan items by location number + work keyword
    const nums=[...s.matchAll(/(?:^|[^A-Za-z0-9])(?:P|PIER|교각|A|ABUT|R\d?-?|Span|S|슬래브|slab|교대)\s*-?\s*(\d+(?:-\d+)?)/gi)].map(x=>x[1]);
    const isRamp=/\bR\d\s*-\s*\d+/i.test(s);const kw=KW.filter(k=>k.re.test(s)).map(k=>k.k);
    const zone=/sucat|sucut|수캇/i.test(s)?'Sucat':/alab|알라방/i.test(s)?'Alabang':null;
    const sc=plan.map(p=>{const c=cat[p.uid];let v=0;
      if(c.loc&&c.loc.k!=='Z'&&nums.includes(c.loc.n))v+=2;if(c.loc&&c.loc.k==='R'&&!isRamp)v-=1;
      if(c.kw&&kw.includes(c.kw))v+=2;if(c.kw&&kw[0]===c.kw)v+=0.5;
      if(zone&&c.loc&&c.loc.k==='Z'&&c.loc.n===zone)v+=1;if(zone&&c.loc&&c.loc.k==='Z'&&c.loc.n!==zone)v-=2;
      return {p,v}}).sort((a,b)=>b.v-a.v);
    const best=sc[0],second=sc[1];
    const kwClash=best&&kw.length&&cat[best.p.uid].kw&&!kw.includes(cat[best.p.uid].kw);   // right place, different work -> not this item
    if(best&&best.v>=2&&!kwClash&&(!second||best.v>second.v)){out.push({seg:s,uid:best.p.uid,kind,pct,why,conf:best.v>=4?0.95:best.v>=2.5?0.85:0.7,how:'문장'})}
    else out.push({seg:s,uid:null,kind,pct,why,conf:0.3,how:'문장',cands:sc.filter(x=>x.v>0).slice(0,4).map(x=>x.p.uid)})}
  return out}
// site-time report date: before 07:00 a reply is about the previous day
function reportDate(atIso){const d=new Date(Date.parse(atIso)+8*36e5);const h=d.getUTCHours();const ds=d.toISOString().slice(0,10);
  return h<7?new Date(Date.parse(ds)-864e5).toISOString().slice(0,10):ds}

// ---------- one virtual site day ----------
const CAP={c1:8,c2:12,c3:8,c4:6,c5:10,gm:20};   // parallel activities a crew can run in a day
// o: {D, ENG, tasks, cal, actuals, cat, sim}. Returns messages (plan/reply/notice), review items, direct records (공무 items)
function runDay(o){const {D,ENG,tasks,cal,cat,sim}=o,C=o.C||ENG.makeCal(cal,'2020-01-01','2036-12-31');const msgs=[],review=[],direct=[];
  const prev=new Date(Date.parse(D)-864e5).toISOString().slice(0,10),wk=['일','월','화','수','목','금','토'][new Date(D).getUTCDay()],dlab=`${D.slice(5).replace('-','.')}(${wk})`;
  const at=(hh,mm,d)=>`${d||D}T${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00+08:00`;
  if(!C.isWork(D)){msgs.push({chat:'grp',from:'bot',at:at(7,0),kind:'notice',text:`[${dlab}] 휴일입니다 (공정표 캘린더).`});return {msgs,review,direct,holiday:true}}
  sim.dayNo=(sim.dayNo||0)+1;const dayNo=sim.dayNo,seed=sim.seed||'llrn';
  const prog=ENG.progress(tasks,cal,o.actuals,prev);const T=sim.truth;
  const per={c1:[],c2:[],c3:[],c4:[],c5:[],gm:[]};
  for(const[u,tr]of Object.entries(T))if(tr.as&&!tr.af&&cat[u]&&per[cat[u].crew])per[cat[u].crew].push(u);
  const due=[];for(const t of tasks){if(t.summary)continue;const c=cat[String(t.uid)];if(!c)continue;const p=prog.byId[t.id];if(!p||p.state==='done')continue;
    const tr=T[c.uid];if(tr&&(tr.as||tr.af))continue;if(p.state==='run'||p.es<=D)due.push({u:c.uid,es:p.es,crew:c.crew,crit:p.crit})}
  // critical-path work first, then by forecast start; each crew handles up to CAP activities a day
  due.sort((a,b)=>(b.crit-a.crit)||a.es.localeCompare(b.es));
  for(const d of due){const L=per[d.crew];if(L.length<(CAP[d.crew]||8))L.push(d.u)}
  // plan messages 07:00
  const crewN={};for(const c of CREW)crewN[c.id]=c;sim.plans=sim.plans||{};let nPlan=0;
  for(const c of CREW){const L=per[c.id];if(!L.length)continue;nPlan++;
    const plan=L.map((u,i)=>({no:i+1,uid:u}));(sim.plans[c.id]=sim.plans[c.id]||{})[D]=plan;
    const lines=plan.map(p=>{const tr=T[p.uid];return `${p.no}) ${cat[p.uid].label}${tr&&tr.as?` (어제까지 ${Math.round(tr.pct||0)}%)`:' (착수)'}`});
    msgs.push({chat:c.id,from:'bot',at:at(7,0),kind:'plan',text:`[${dlab} 작업 계획 · ${c.name} ${c.role}]\n${lines.join('\n')}\n\n17:00에 실적을 회신해 주세요. 예) 1. 60% / 2. 완료 / 3. 비로 중지`,meta:{plan}})}
  msgs.push({chat:'grp',from:'bot',at:at(7,1),kind:'notice',text:`[${dlab}] 작업반 ${nPlan}곳에 오늘 작업 계획을 보냈습니다. 실적 회신 마감 21:00.`});
  // the virtual site works: truth progress
  for(const c of [...CREW,{id:'gm',style:'gm',prod:1}]){const L=per[c.id];if(!L.length)continue;const {f,why}=dayFactor(sim.scenario,seed,D,c.id,dayNo);const items=[];
    L.forEach((u,i)=>{const it=cat[u];const tr=T[u]=T[u]||{pct:0};
      if(f===0){items.push({no:i+1,cat:it,stop:why});(tr.stops=tr.stops||[]).push({date:D,why});return}
      const g=f*(c.prod||1)*(0.85+0.3*rnd(seed,D,u,'g'));if(!tr.as)tr.as=D;tr.pct=Math.min(100,(tr.pct||0)+100/it.dur*g);
      const done=tr.pct>=99.5;if(done){tr.pct=100;tr.af=D}
      const step=c.style==='num'?5:10;const rep=done?100:Math.max(step,Math.min(95,Math.round(tr.pct/step)*step));items.push({no:i+1,cat:it,done,pct:rep})});
    if(c.id==='gm'){for(const x of items)if(!x.stop)direct.push({uid:x.cat.uid,date:D,as:T[x.cat.uid].as,done:x.done,pct:x.done?100:x.pct});continue}
    // reply: usually 17:00–19:59, sometimes late (22:40) or next morning 06:30 (still today's work)
    const r=rnd(seed,D,c.id,'late'),skip=rnd(seed,D,c.id,'skip')<0.1&&items.length>2?Math.floor(rnd(seed,D,c.id,'which')*items.length):-1;
    const said=items.filter((x,i)=>i!==skip);
    const when=r<0.06?at(6,30,new Date(Date.parse(D)+864e5).toISOString().slice(0,10)):r<0.1?at(22,40):at(17+Math.floor(rnd(seed,D,c.id,'h')*3),Math.floor(rnd(seed,D,c.id,'m')*60));
    if(r<0.1)msgs.push({chat:c.id,from:'bot',at:at(20,0),kind:'notice',text:'오늘 실적 회신이 아직 없습니다. 회신 부탁드립니다.'});
    const text=writeReply(c.style,said,seed,D);
    msgs.push({chat:c.id,from:c.id,at:when,kind:'reply',text,meta:{truth:said.map(x=>({uid:x.cat.uid,kind:x.stop?'stop':x.done?'done':'pct',pct:x.stop?null:x.done?100:x.pct}))}})}
  return {msgs,review,direct,plans:per}}
// accuracy of a parse against the virtual truth (same order of segments)
function score(parsed,truth){let ok=0;truth.forEach((t,i)=>{const p=parsed[i];if(p&&p.uid===t.uid&&p.kind===t.kind&&(t.kind!=='pct'||p.pct===t.pct))ok++});return {ok,n:truth.length}}

root.LLRNSim={runDay,score,CREW,crewOf,KW,kwOf,locOf,catalog,rnd,SCEN,dayFactor,writeReply,parseReply,reportDate,shortName};
if(typeof module!=='undefined')module.exports=root.LLRNSim;
})(typeof window!=='undefined'?window:globalThis);
