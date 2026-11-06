const SV = (p,y,f=100)=>`https://streetviewpixels-pa.googleapis.com/v1/thumbnail?panoid=${p}&cb_client=maps_sv.tactile&w=900&h=600&yaw=${y}&pitch=0&thumbfov=${f}`;
const SVLINK = (p,y)=>`https://www.google.com/maps/@?api=1&map_action=pano&pano=${p}&heading=${y}`;
const VERDICT = {ok:['success','적합'], warn:['warning','조건부'], ng:['danger','곤란'], na:['','미확인']};
// 경로 구분색: 디자인 시스템 accent(데이터 범주 전용) 토큰 값
const COLOR = {r1:'#fe6f3f', r2:'#b357ff', common:'#00bdde'};

{{NODES}}

{{ROUTES}}
ROUTES.common = ROUTES.r1.slice(ROUTES.r1.findIndex(p=>p[0]===14.41639));

const ORIGINS = {r1:{lat:14.42671,lng:121.01981,t:'경로 1 출발'}, r2:{lat:14.52197,lng:121.09226,t:'경로 2 출발'}};

const nodesFor = g => g==='r1' ? NODES.filter(n=>n.group==='r1'||n.group==='common')
                   : g==='r2' ? NODES.filter(n=>n.group==='r2'||n.group==='common')
                   : g==='common' ? NODES.filter(n=>n.group==='common') : NODES;
const nodeColor = n => COLOR[n.group];
const gmapsEmbed = n => `https://maps.google.com/maps?q=${n.lat},${n.lng}&t=k&z=18&hl=ko&output=embed`;
const gmapsLink = n => `https://www.google.com/maps/search/?api=1&query=${n.lat},${n.lng}`;
const badge = k => { const [tone,label]=VERDICT[k]; return `<span class="gs-badge${tone?' gs-badge--'+tone:''}"><span class="gs-badge__dot"></span>${label}</span>`; };
const groupLabel = g => ({r1:'경로 1',r2:'경로 2',common:'공통'})[g];

// 종합 판정표
(function(){
  let h = '<thead><tr><th>No.</th><th>포인트</th><th>위치</th><th>구간</th><th>레미콘</th><th>트레일러</th></tr></thead><tbody>';
  NODES.forEach(n=>{ h += `<tr class="is-click" data-id="${n.id}" tabindex="0"><td><span class="num" style="background:${nodeColor(n)};width:28px;height:28px;font-size:12px">${n.id}</span></td><td>${n.title}</td><td class="is-sub">${n.where}</td><td>${groupLabel(n.group)}</td><td>${badge(n.rm)}</td><td>${badge(n.tr)}</td></tr>`; });
  const t = document.getElementById('summary-table'); t.innerHTML = h + '</tbody>';
  t.querySelectorAll('tr.is-click').forEach(r=>{
    const go=()=>showTabNode(NODES.find(n=>n.id===r.dataset.id));
    r.addEventListener('click',go); r.addEventListener('keydown',e=>{ if(e.key==='Enter') go(); });
  });
})();

// 포인트 카드
function renderList(g){
  const el = document.getElementById('list-'+g); if(!el) return;
  el.innerHTML = nodesFor(g).map(n=>`
   <article class="node" id="card-${g}-${n.id}" data-id="${n.id}" tabindex="0">
     <div class="node-head">
       <div class="nh-left"><span class="num" style="background:${nodeColor(n)}">${n.id}</span>
         <div><h3>${n.title}</h3><div class="where">${n.where}${n.group==='common'&&g!=='common'?' · <b>공통 구간</b>':''}</div></div></div>
       <div class="verdict">레미콘 ${badge(n.rm)} 트레일러 ${badge(n.tr)}</div>
     </div>
     ${n.pics.length?`<div class="pics">${n.pics.map(p=>`<figure><img loading="lazy" src="${SV(p.p,p.y,p.f)}" alt="${p.c}"><figcaption>${p.c}</figcaption></figure>`).join('')}</div>`:''}
     <ul>${n.pts.map(t=>`<li>${t}</li>`).join('')}</ul>
     <div class="links"><a href="${gmapsLink(n)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Google 지도에서 열기</a>${n.pics[0]?`<a href="${SVLINK(n.pics[0].p,n.pics[0].y)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Street View 열기</a>`:''}<span class="coord">${n.lat.toFixed(5)}, ${n.lng.toFixed(5)}</span></div>
   </article>`).join('');
  el.querySelectorAll('.node').forEach(c=>{
    c.addEventListener('click',()=>selectNode(g,c.dataset.id,true));
    c.addEventListener('keydown',e=>{ if(e.key==='Enter') selectNode(g,c.dataset.id,true); });
  });
}

// 지도
const maps = {}, markers = {};
function baseLayers(){
  return {
    '위성(Google)': L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=ko',{subdomains:'0123',maxZoom:21,attribution:'지도 © Google'}),
    '일반(Google)': L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=ko',{subdomains:'0123',maxZoom:21,attribution:'지도 © Google'})
  };
}
const pinIcon = (txt,color,od)=>L.divIcon({className:'pin'+(od?' od':''),html:`<div style="background:${color}">${txt}</div>`,iconSize:od?[72,24]:[28,28],iconAnchor:od?[36,42]:[14,14],popupAnchor:od?[0,-42]:[0,-12]});

function buildMap(g){
  if(maps[g]) return maps[g];
  const layers = baseLayers();
  const m = L.map('map-'+g,{layers:[layers['위성(Google)']],scrollWheelZoom:false});
  L.control.layers(layers,null,{collapsed:true}).addTo(m);
  const lines = g==='overview' ? ['r1','r2'] : [g];
  const bounds = [];
  lines.forEach(r=>{ L.polyline(ROUTES[r],{color:COLOR[r],weight:5,opacity:.95}).addTo(m); bounds.push(...ROUTES[r]); });
  if(g!=='common'){
    (g==='overview'?['r1','r2']:[g]).forEach(r=>{const o=ORIGINS[r]; L.marker([o.lat,o.lng],{icon:pinIcon(o.t,COLOR[r],true)}).addTo(m).bindPopup(`<b>${o.t}</b><br><span class="gs-num">${o.lat}, ${o.lng}</span>`);});
  }
  markers[g] = {};
  nodesFor(g).forEach(n=>{
    const pic = n.pics[0] ? `<img src="${SV(n.pics[0].p,n.pics[0].y,n.pics[0].f)}" alt="">` : '';
    const mk = L.marker([n.lat,n.lng],{icon:pinIcon(n.id,nodeColor(n))}).addTo(m)
      .bindPopup(`<b>${n.id} · ${n.title}</b><br><span style="color:#737373">${n.where}</span>${pic}<div class="verdict">레미콘 ${badge(n.rm)} 트레일러 ${badge(n.tr)}</div><a href="${gmapsLink(n)}" target="_blank" rel="noopener">Google 지도에서 열기</a>`,{maxWidth:270});
    mk.on('click',()=>{ if(g!=='overview') selectNode(g,n.id,false); else showTabNode(n); });
    markers[g][n.id]=mk;
  });
  m.fitBounds((g==='common'?L.latLngBounds(ROUTES.common).pad(0.25):L.latLngBounds(bounds).pad(0.08)));
  maps[g]=m; return m;
}
function selectNode(g,id,fromCard){
  const n = NODES.find(x=>x.id===id); const m = maps[g];
  document.querySelectorAll(`#list-${g} .node`).forEach(c=>c.classList.toggle('sel',c.dataset.id===id));
  const f = document.getElementById('gf-'+g); if(f){ f.src = gmapsEmbed(n); document.getElementById('gt-'+g).textContent = `Google 지도 · ${n.id} ${n.title}`; }
  if(m && fromCard!==null){ m.setView([n.lat,n.lng], Math.max(m.getZoom(),17)); if(fromCard) markers[g][id].openPopup(); }
  if(fromCard===false){ const c=document.getElementById(`card-${g}-${id}`); c&&c.scrollIntoView({behavior:'smooth',block:'nearest'}); }
}
function showTabNode(n){
  const g = n.group; switchTab(g);
  setTimeout(()=>{ selectNode(g,n.id,true); document.getElementById(`card-${g}-${n.id}`).scrollIntoView({behavior:'smooth',block:'center'}); },250);
}

// 사이드내비 전환
function switchTab(t){
  document.querySelectorAll('.gs-sidenav__item').forEach(b=>b.setAttribute('aria-selected', b.dataset.tab===t ? 'true':'false'));
  document.querySelectorAll('.view').forEach(p=>p.classList.toggle('active',p.id==='v-'+t));
  window.scrollTo({top:0});
  if(t==='planner'){ plInit(); return; }
  if(['overview','r1','r2','common'].includes(t)){
    const fresh = !maps[t];
    const m = buildMap(t);
    setTimeout(()=>{ m.invalidateSize();
      if(fresh) m.fitBounds(t==='common'?L.latLngBounds(ROUTES.common).pad(0.25):L.latLngBounds(t==='overview'?ROUTES.r1.concat(ROUTES.r2):ROUTES[t]).pad(0.08));
    },60);
    if(t!=='overview' && !document.querySelector(`#list-${t} .node.sel`)){ selectNode(t,nodesFor(t)[0].id,null); }
  }
}
document.querySelectorAll('.gs-sidenav__item').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));

// 테마 (디자인 시스템 전용 다크 토큰)
(function(){
  const root=document.documentElement, btn=document.getElementById('themeBtn');
  const apply=t=>{ root.setAttribute('data-theme',t); btn.textContent = t==='dark' ? '라이트 모드' : '다크 모드'; };
  apply(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  btn.addEventListener('click',()=>apply(root.getAttribute('data-theme')==='dark'?'light':'dark'));
})();

['r1','r2','common'].forEach(renderList);
buildMap('overview');
if(location.hash.startsWith('#plan=')) setTimeout(()=>switchTab('planner'),0);

{{PLANNER}}
