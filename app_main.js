const ICON_PLAY=`<svg class="ic sm" aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 17.3336V6.66698C5 5.78742 5 5.34715 5.18509 5.08691C5.34664 4.85977 5.59564 4.71064 5.87207 4.67499C6.18868 4.63415 6.57701 4.84126 7.35254 5.25487L17.3525 10.5882L17.3562 10.5898C18.2132 11.0469 18.642 11.2756 18.7826 11.5803C18.9053 11.8462 18.9053 12.1531 18.7826 12.4189C18.6418 12.7241 18.212 12.9537 17.3525 13.4121L7.35254 18.7454C6.57645 19.1593 6.1888 19.3657 5.87207 19.3248C5.59564 19.2891 5.34664 19.1401 5.18509 18.9129C5 18.6527 5 18.2132 5 17.3336Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`, ICON_STOP=`<svg class="ic sm" aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 8.2002V15.8002C5 16.9203 5 17.4796 5.21799 17.9074C5.40973 18.2837 5.71547 18.5905 6.0918 18.7822C6.5192 19 7.07899 19 8.19691 19H15.8036C16.9215 19 17.4805 19 17.9079 18.7822C18.2842 18.5905 18.5905 18.2837 18.7822 17.9074C19 17.48 19 16.921 19 15.8031V8.19691C19 7.07899 19 6.5192 18.7822 6.0918C18.5905 5.71547 18.2842 5.40973 17.9079 5.21799C17.4801 5 16.9203 5 15.8002 5H8.2002C7.08009 5 6.51962 5 6.0918 5.21799C5.71547 5.40973 5.40973 5.71547 5.21799 6.0918C5 6.51962 5 7.08009 5 8.2002Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`, ICON_MOON=`<svg class="ic " aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 6.00098C9 10.9715 13.0294 15.001 18 15.001C18.9093 15.001 19.787 14.8665 20.6144 14.6157C19.4943 18.3113 16.0613 21.0008 12 21.0008C7.02944 21.0008 3 16.9717 3 12.0011C3 7.93981 5.69007 4.50681 9.38561 3.38672C9.13484 4.21409 9 5.09172 9 6.00098Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`, ICON_SUN=`<svg class="ic " aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4V2M12 20V22M6.41421 6.41421L5 5M17.728 17.728L19.1422 19.1422M4 12H2M20 12H22M17.7285 6.41421L19.1427 5M6.4147 17.728L5.00049 19.1422M12 17C9.23858 17 7 14.7614 7 12C7 9.23858 9.23858 7 12 7C14.7614 7 17 9.23858 17 12C17 14.7614 14.7614 17 12 17Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
(async function(){
const DAY=864e5,D0=Date.UTC(2026,9,6);   // model epoch: day numbers in the 3D data table count from here
const MS=d=>Date.parse(d), iso=ms=>new Date(ms).toISOString().slice(0,10);
// ---------------- schedule engine (stage 1: all dates computed in the browser) ----------------
const ENG=window.LLRNEngine, IMP=window.LLRNImport; const EL=ST.elems;
let RES,CPM,SCHED,MAP,CFGA,TL,M,PL,EZS,EZ,t0,t1,NDAYS,leaves,durW,totW,COMM,BASE,SHIFT;
// contract settings; v2 (Rev.4): start = commencement that moves the whole schedule (v1 only moved the contract dates)
const CKEY='llrn4d-contract-v2';let CON={};try{CON=JSON.parse(localStorage.getItem(CKEY)||'{}')||{}}catch(e){CON={}}
function deriveSchedule(base,map,opts){
  const cfg=map?IMP.remapCfg(CFG,map):CFG;
  // every activity moves by the same number of working days on the file's own calendar (no-predecessor activities included).
  // A revised baseline (Rev.1 …) holds real dates and its own actuals, so it is never shifted.
  BASE=base;if(opts&&opts.abs){const cm=base.tasks.find(x=>x.id===cfg.commence);const d=cm&&cm.start?cm.start.slice(0,10):null;SHIFT={sched:base,delta:0,old:d,start:d,snapped:false,abs:true}}
  else SHIFT=ENG.shiftSchedule(base,CON.start,cfg.commence);const sched=SHIFT.sched;
  const R=ENG.compute(sched.tasks,cfg,ST,D0);
  SCHED=sched;MAP=map||null;CFGA=cfg;RES=R;CPM=ENG.cpm(sched.tasks,sched.cal,sched.frozen&&sched.frozen.dataDate);
  TL={gantt:R.rows,start:R.start,finish:R.finish};
  VP=viewData(R);useView();
  const cm=sched.tasks.find(x=>x.id===cfg.commence);COMM=cm&&cm.start?MS(cm.start.slice(0,10)):t0;
  return R}
// structure dates for one schedule (plan, or actual/forecast) -> what the 3D, KPIs, profile and zone panel read
function viewData(R){const di=d=>d==null||!isFinite(d)||d>=ENG.NEVER/2?null:R.iso(d);let M,PL,EZS,EZ;
  M={piers:ST.supports.map(s=>({id:s.id,pile:di(R.SUP[s.id].pile),pier:di(R.SUP[s.id].pier)})),
     spans:ST.spans.map(s=>({id:s.id,s0:s.s0,s1:s.s1,ramp:s.ramp,girder:di(R.SPAN[s.id].girder),deck:di(R.SPAN[s.id].deck),pave:di(R.SPAN[s.id].pave)}))};
  const PM={};for(const p of M.piers)PM[p.id]=p;const SM={};for(const s of M.spans)SM[s.id]=s;
  M.profile={...PROF,piers:PROF.piers.map(p=>({...p,pile:PM[p.id].pile,pier:PM[p.id].pier})),spans:PROF.spans.map(s=>({...s,girder:SM[s.id].girder,deck:SM[s.id].deck,pave:SM[s.id].pave}))};
  PL=[];EL.forEach(e=>{if(e.k!=='pier'||!e.piles)return;const p=R.SUP[e.id].pile;if(p==null)return;for(let k=0;k<e.piles[0];k++)PL.push(R.iso(p-2*k))});PL.sort();
  EZS=Object.entries(R.ZONE).map(([id,S])=>({id,st:Object.fromEntries(Object.entries(S).map(([k,v])=>[k,[R.iso(v[0]),R.iso(v[1])]]))}));
  EZ=EZS.map(z=>{const S={};for(const[k,v]of Object.entries(z.st))S[k]=[MS(v[0]),MS(v[1])+DAY];return{id:z.id,S}});
  const leaves=R.rows.filter(r=>!r.sum),durW=leaves.map(r=>({a:MS(r.s),b:MS(r.f)+DAY})),totW=durW.reduce((x,y)=>x+(y.b-y.a),0);
  return {R,M,PL,EZS,EZ,leaves,durW,totW,start:R.start,finish:R.finish}}
// view mode: 'plan' | 'act' (actual + forecast) | 'cmp' (actual/forecast coloured against the plan)
let MODE='plan',VP=null,VF=null,PROG=null,RESF=null;
function useView(){const v=MODE!=='plan'&&VF?VF:VP;({M,PL,EZS,EZ,leaves,durW,totW}=v);
  t0=MS(VF&&VF.start<VP.start?VF.start:VP.start);t1=MS(VF&&VF.finish>VP.finish?VF.finish:VP.finish);NDAYS=Math.round((t1-t0)/DAY);return v}
// a previously uploaded schedule is kept in this browser and restored on the next visit
// v2: baseline = General Schedule re3 (v1 maps were made against r5)
const SKEY='llrn4d-sched-v2';let restored=false;
try{const s=JSON.parse(localStorage.getItem(SKEY)||'null');if(s&&s.sched&&s.map){deriveSchedule(s.sched,s.map);restored=true}}catch(e){try{localStorage.removeItem(SKEY)}catch(_){}}
if(!restored)deriveSchedule(SCHED0,null);
const $=id=>document.getElementById(id);
// ---------------- theme ----------------
function setTheme(t){document.documentElement.dataset.theme=t;$('themeBtn').innerHTML=t==='dark'?ICON_SUN:ICON_MOON;try{localStorage.setItem('llrn4d-theme',t)}catch(e){};if(window._redraw)_redraw()}
try{const s=localStorage.getItem('llrn4d-theme');if(s)setTheme(s)}catch(e){}
$('themeBtn').addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
$('helpBtn').addEventListener('click',()=>{const h=$('mapHint');h.style.background='rgba(15,111,255,.9)';setTimeout(()=>h.style.background='',1600);$('sec-viewer').scrollIntoView({behavior:'smooth'})});
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-go]').forEach(x=>x.removeAttribute('aria-current'));b.setAttribute('aria-current','true');$(b.dataset.go).scrollIntoView({behavior:'smooth',block:'start'})}));
$('viewsToggle').addEventListener('click',e=>{const b=e.currentTarget,o=b.getAttribute('aria-expanded')==='true';b.setAttribute('aria-expanded',String(!o));$('viewList').hidden=o});
// ---------------- geo frame ----------------
if(typeof Cesium==='undefined'){$('netAlert').hidden=false;$('netMsg').textContent='3D 지도 엔진(CesiumJS)을 불러오지 못했습니다. 인터넷 연결 또는 회사 보안 정책(cdn.jsdelivr.net 차단)을 확인해 주세요. 공정표와 종단면도는 정상 동작합니다.'}
const C=window.Cesium; const RE=6378137;
const ce=FR.ce,cn=FR.cn; const det=ce[0]*cn[1]-ce[1]*cn[0];
function l2enu(x,y,zl){const e=ce[0]*x+ce[1]*(-zl)+ce[2],n=cn[0]*x+cn[1]*(-zl)+cn[2];return[e,n,y-(e*e+n*n)/(2*RE)]}
function enu2l(e,n){const a=e-ce[2],b=n-cn[2];const x=(cn[1]*a-ce[1]*b)/det,mz=(-cn[0]*a+ce[0]*b)/det;return[x,-mz]}
let ve=2, viewer=null, model=null, ghost=null, enuFrame=null;
function W(x,y,zl){const[e,n,u]=l2enu(x,y,zl);return C.Matrix4.multiplyByPoint(enuFrame,new C.Cartesian3(e,n,u*ve),new C.Cartesian3())}
const shaderDay={value:0};
const TOL=7;   // comparison colours: more than 7 days ahead / behind the plan
if(C){
  C.Ion.defaultAccessToken=undefined;
  viewer=new C.Viewer('cesium',{baseLayer:false,baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,animation:false,timeline:false,fullscreenButton:false,infoBox:false,selectionIndicator:false,skyBox:false,
    terrainProvider:new C.EllipsoidTerrainProvider(),creditContainer:$('credits'),msaaSamples:4,requestRenderMode:false});
  const sc=viewer.scene; sc.backgroundColor=C.Color.fromCssColorString('#a9bcc8');
  // Globe surface needs web workers, which browsers block for pages opened from a local file.
  // Draw the satellite ground ourselves as synchronous rectangle primitives instead.
  sc.globe.show=false; sc.fog.enabled=false; if(sc.skyAtmosphere)sc.skyAtmosphere.show=true;
  sc.screenSpaceCameraController.minimumZoomDistance=15;
  const TILE='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const merc=(z,y)=>Math.atan(Math.sinh(Math.PI*(1-2*y/2**z)))*180/Math.PI;
  const tRect=(z,x,y)=>C.Rectangle.fromDegrees(x/2**z*360-180,merc(z,y+1),(x+1)/2**z*360-180,merc(z,y));
  const lx=(lon,z)=>Math.floor((lon+180)/360*2**z), ly=(lat,z)=>{const r=lat*Math.PI/180;return Math.floor((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*2**z)};
  const ground=new C.PrimitiveCollection(); sc.primitives.add(ground);
  function rectPrim(rect,h,material,translucent){return new C.Primitive({geometryInstances:new C.GeometryInstance({geometry:new C.RectangleGeometry({rectangle:rect,height:h,vertexFormat:C.EllipsoidSurfaceAppearance.VERTEX_FORMAT})}),
    appearance:new C.EllipsoidSurfaceAppearance({material,aboveGround:true,translucent:!!translucent,flat:true}),asynchronous:false})}
  ground.add(rectPrim(C.Rectangle.fromDegrees(120.95,14.33,121.17,14.55),-1.2,C.Material.fromType('Color',{color:C.Color.fromCssColorString('#5d7a86')})));
  let tOk=0,tBad=0,tTotal=0;
  function addTiles(z,w,s,e,n,h){for(let x=lx(w,z);x<=lx(e,z);x++)for(let y=ly(n,z);y<=ly(s,z);y++){tTotal++;
    const img=new Image();img.crossOrigin='anonymous';
    img.onload=()=>{tOk++;ground.add(rectPrim(tRect(z,x,y),h,C.Material.fromType('Image',{image:img})))};
    img.onerror=()=>{tBad++};img.src=TILE.replace('{z}',z).replace('{y}',y).replace('{x}',x)}}
  addTiles(15,121.005,14.390,121.105,14.485,-0.8);   // context
  addTiles(17,121.0465,14.4115,121.0665,14.4600,-0.4); // project corridor
  setTimeout(()=>{if(tOk===0){$('netAlert').hidden=false;$('netMsg').textContent=`위성지도(Esri) 타일을 불러오지 못했습니다 (${tBad}/${tTotal} 실패). 회사 네트워크에서 server.arcgisonline.com 접속이 막혀 있을 수 있습니다. 3D 모델과 공정 기능은 그대로 사용할 수 있습니다.`}},12000);
  $('credits').textContent='Imagery © Esri, Maxar, Earthstar Geographics';
  const ovl=rectPrim(C.Rectangle.fromDegrees(OVB[0][1],OVB[0][0],OVB[1][1],OVB[1][0]),0.2,C.Material.fromType('Image',{image:OVIMG}),true); ovl.show=false; sc.primitives.add(ovl);
  $('cad').addEventListener('change',e=>ovl.show=e.target.checked);
  enuFrame=C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(FR.lon0,FR.lat0,0));
  const bin=atob(GLB_B64),u8=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
  const url=URL.createObjectURL(new Blob([u8],{type:'model/gltf-binary'}));
  const SCHED_GLSL=`
      vec4 tabRow(sampler2D T,float e,float r){return texture(T,vec2((r+0.5)/8.0,(e+0.5)/u_rows));}
      vec4 sched(vec4 q,sampler2D T){ const float NV=1.0e6;
        float e=q.x, r=floor(q.y+0.5), o=r<1.5?q.z:q.z/65535.0, y0=q.w/100.0-50.0; vec4 A=tabRow(T,e,0.0);
        if(r>19.5)return vec4(NV,NV,NV,0.0);   // 20 = outside CP1B scope (past END 8+525.53): never drawn
        if(r<1.5){float t=A.x-o;return vec4(t,t,NV,0.0);}
        if(r<2.5){float t=min(A.x+21.0,A.y-40.0);return vec4(t,t,NV,0.0);}
        if(r<3.5)return vec4(A.y-45.0,A.y,NV,y0);
        if(r<4.5)return vec4(A.y,A.y,NV,0.0);
        if(r<5.5)return vec4(A.x,A.x,NV,0.0);
        if(r<6.5)return vec4(A.y,A.y,NV,0.0);
        if(r<7.5)return vec4(A.y+25.0,A.y+25.0,NV,0.0);
        if(r<8.5)return vec4(A.y+40.0,A.y+40.0,NV,0.0);
        if(r<9.5)return vec4(A.z,A.z,NV,0.0);
        if(r<10.5)return vec4(A.y+20.0,A.y+20.0,NV,0.0);
        if(r>18.5)return vec4(A.x,A.x,A.y,0.0);
        vec4 B=tabRow(T,e,1.0),G=tabRow(T,e,2.0),F=tabRow(T,e,3.0),P=tabRow(T,e,4.0);
        if(r<11.5){float t=mix(G.x,G.y,o);return vec4(t,t,NV,0.0);}
        if(r<12.5)return vec4(F.x,F.y,NV,y0);
        if(r<14.5){float t=mix(P.z,P.w,o)+(r>13.5?20.0:0.0);if(r>13.5)t=min(t,u_end-1.0);return vec4(t,t,NV,0.0);}
        if(r<15.5){float t=mix(A.x,A.y,o);return vec4(t,t,mix(A.z,A.w,o),0.0);}
        if(r<16.5){float t=B.x+o*min(90.0,B.z-B.x);return vec4(t,t,mix(B.z,B.w,o),0.0);}
        if(r<17.5){float t=mix(G.z,G.w,o);return vec4(t,t,F.x+0.3*(F.y-F.x),0.0);}
        return vec4(F.z,F.w,P.y,y0);}`;
  const VS=SCHED_GLSL+`
    void vertexMain(VertexInput vsInput, inout czm_modelVertexOutput vsOutput){
      vec4 a=sched(vsInput.attributes.ra,u_tab); float y0=a.w; v_new=0.0; v_hide=0.0; v_dl=0.0;
      if(u_mode>1.5){vec4 p=sched(vsInput.attributes.ra,u_tabP); if(a.x<1.0e5&&p.x<1.0e5&&p.z>1.0e5) v_dl=a.y-p.y;}
      if(u_day<a.x||u_day>=a.z){v_hide=1.0;vsOutput.positionMC=vec3(0.0);}
      else{ if(a.y>a.x){float f=clamp((u_day-a.x)/(a.y-a.x),0.0,1.0); vec3 p=vsOutput.positionMC; p.y=y0+(p.y-y0)*f; vsOutput.positionMC=p;}
            v_new=1.0-clamp((u_day-a.y)/30.0,0.0,1.0);} }`;
  const tabU=R=>new C.TextureUniform({typedArray:R.tab,width:R.TW,height:R.tab.length/(4*R.TW),pixelFormat:C.PixelFormat.RGBA,pixelDatatype:C.PixelDatatype.FLOAT,
    repeat:false,minificationFilter:C.TextureMinificationFilter.NEAREST,magnificationFilter:C.TextureMagnificationFilter.NEAREST});
  const endDay=()=>(MS(MODE!=='plan'&&VF?VF.finish:TL.finish)-D0)/DAY+0.5;
  const uni=()=>({u_tabP:{type:C.UniformType.SAMPLER_2D,value:tabU(RES)},u_mode:{type:C.UniformType.FLOAT,value:0},u_tol:{type:C.UniformType.FLOAT,value:TOL},u_end:{type:C.UniformType.FLOAT,value:endDay()},u_hl:{type:C.UniformType.FLOAT,value:1},u_day:{type:C.UniformType.FLOAT,value:0},u_rows:{type:C.UniformType.FLOAT,value:EL.length},u_tab:{type:C.UniformType.SAMPLER_2D,value:tabU(RES)}});
  const shader=new C.CustomShader({uniforms:uni(),varyings:{v_new:C.VaryingType.FLOAT,v_hide:C.VaryingType.FLOAT,v_dl:C.VaryingType.FLOAT},lightingModel:C.LightingModel.PBR,
    vertexShaderText:VS,fragmentShaderText:`void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material){ if(v_hide>0.5) discard;
      vec3 pe=fsInput.attributes.positionEC; material.normalEC=normalize(cross(dFdx(pe),dFdy(pe)));
      material.diffuse=mix(material.diffuse,vec3(1.0,0.66,0.2),v_new*0.55*u_hl*step(u_day,u_end-0.25)*(u_mode>1.5?0.0:1.0));
      if(u_mode>1.5){ if(v_dl>u_tol) material.diffuse=mix(material.diffuse,vec3(0.90,0.23,0.23),0.72); else if(v_dl< -u_tol) material.diffuse=mix(material.diffuse,vec3(0.06,0.44,1.0),0.62); } }`});
  const gshader=new C.CustomShader({uniforms:uni(),varyings:{v_show:C.VaryingType.FLOAT},lightingModel:C.LightingModel.UNLIT,translucencyMode:C.CustomShaderTranslucencyMode.TRANSLUCENT,
    vertexShaderText:SCHED_GLSL+`
    void vertexMain(VertexInput vsInput, inout czm_modelVertexOutput vsOutput){ vec4 a=sched(vsInput.attributes.ra,u_tab);
      if(u_mode>1.5){vec4 p=sched(vsInput.attributes.ra,u_tabP); v_show=(u_day>=p.x&&u_day<p.z&&u_day<a.x)?2.0:0.0;}
      else v_show=(u_day<a.x&&a.x<1.0e5&&a.z>1.0e5)?1.0:0.0;
      if(v_show<0.5) vsOutput.positionMC=vec3(0.0);}`,
    fragmentShaderText:`void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material){ if(v_show<0.5) discard; if(v_show>1.5){material.diffuse=vec3(1.0,0.42,0.38);material.alpha=0.34;}else{material.diffuse=vec3(1.0);material.alpha=0.16;} }`});
  // u_tab = schedule on screen (plan, or actual/forecast), u_tabP = plan (comparison colours)
  window._setTab=(R,P)=>{const a=tabU(R),b=tabU(P||R);for(const sh of [shader,gshader]){sh.setUniform('u_tab',a);sh.setUniform('u_tabP',b);sh.setUniform('u_end',endDay())}};
  window._setMode=m=>{for(const sh of [shader,gshader])sh.setUniform('u_mode',m==='cmp'?2:m==='act'?1:0)};
  const mm=()=>C.Matrix4.multiplyByScale(enuFrame,new C.Cartesian3(1,1,ve),new C.Matrix4());
  model=await C.Model.fromGltfAsync({url,modelMatrix:mm(),customShader:shader,backFaceCulling:false,forwardAxis:C.Axis.X});
  ghost=await C.Model.fromGltfAsync({url,modelMatrix:mm(),customShader:gshader,backFaceCulling:false,forwardAxis:C.Axis.X});
  sc.primitives.add(model); sc.primitives.add(ghost); window.__dbg={viewer,model,ghost,shader,C};
  window._setDay=d=>{shader.setUniform('u_day',d);gshader.setUniform('u_day',d)};
  window._setVE=()=>{model.modelMatrix=mm();ghost.modelMatrix=mm();placeLabels()};
  $('ghost').addEventListener('change',e=>ghost.show=e.target.checked);
  $('hl').addEventListener('change',e=>shader.setUniform('u_hl',e.target.checked?1:0));
  $('under').addEventListener('change',e=>{ground.show=!e.target.checked})
  // labels
  const lab=[];const font='600 12px "Pretendard Variable", Pretendard, "Noto Sans KR", sans-serif';
  function addLbl(t,x,y,z,grp,key){lab.push({e:viewer.entities.add({position:W(x,y,z),label:{text:t,font,fillColor:key?C.Color.fromCssColorString('#0f6fff'):C.Color.fromCssColorString('#303030'),showBackground:true,backgroundColor:C.Color.WHITE.withAlpha(.92),backgroundPadding:new C.Cartesian2(6,4),
     verticalOrigin:C.VerticalOrigin.BOTTOM,disableDepthTestDistance:Number.POSITIVE_INFINITY,scale:1.0,distanceDisplayCondition:new C.DistanceDisplayCondition(0,grp==='pier'?1500:20000)}}),x,y,z,grp})}
  APP.labels.keys.forEach(k=>addLbl(k[0],k[1],22,k[2],'main',true)); APP.labels.stas.forEach(s=>addLbl(s[0],s[1],s[2]+3,s[3],'main',false));
  APP.labels.ramps.forEach(r=>addLbl(r[0],r[1],r[2]+2,r[3],'main',true)); APP.labels.piers.forEach(l=>addLbl(l[0],l[1],l[2],l[3],'pier',false));
  function placeLabels(){const sm=$('lbls').checked,sp=$('plbl').checked;lab.forEach(l=>{l.e.position=W(l.x,l.y,l.z);l.e.show=l.grp==='pier'?sp:sm})}
  window.placeLabels=placeLabels; $('lbls').addEventListener('change',placeLabels);$('plbl').addEventListener('change',placeLabels);placeLabels();
  // picking
  const PK=APP.pick;
  viewer.screenSpaceEventHandler.setInputAction(ev=>{const p=sc.pickPosition(ev.position);if(!C.defined(p)||!C.defined(sc.pick(ev.position)))return;
    const inv=C.Matrix4.inverseTransformation(enuFrame,new C.Matrix4());const q=C.Matrix4.multiplyByPoint(inv,p,new C.Cartesian3());
    const[x,zl]=enu2l(q.x,q.y);const y=q.z/ve;let best=null;
    for(const s of PK){const d=Math.hypot(s[0]-x,(s[1]-y)*0.6,s[2]-zl);if(!best||d<best[0])best=[d,s[3]]}
    if(best&&best[0]<30)showInfo(EL[best[1]])},C.ScreenSpaceEventType.LEFT_CLICK);
}
// ---------------- views ----------------
const P7=APP.view.p7, AL=APP.view.alab;
const views={'v-ic':{p:[P7[0]-520,330,P7[1]+560],t:[P7[0]+10,5,P7[1]-80]},'v-loop':{p:[P7[0]+330,150,P7[1]+260],t:[P7[0]+60,5,P7[1]+20]},
  'v-pier':{p:[P7[0]-110,16,P7[1]+90],t:[P7[0]-20,9,P7[1]]},'v-br2':{p:[P7[0]-160,70,P7[1]+900],t:[P7[0]-60,10,P7[1]+1250]},
  'v-alab':{p:[AL[0]-480,300,AL[1]+430],t:[AL[0]-20,5,AL[1]-40]},'v-all':{p:[-2600,2600,1600],t:[150,0,-300]},'v-top':{p:[-150,6200,0.5],t:[-150,0,0]}};
function atSta(s){s=Math.max(CL[0][0],Math.min(CL[CL.length-1][0],s));for(let i=0;i<CL.length-1;i++){const a=CL[i],b=CL[i+1];if(s<=b[0]){const f=(s-a[0])/(b[0]-a[0]);const dx=b[1]-a[1],dz=b[2]-a[2],L=Math.hypot(dx,dz);return{x:a[1]+f*dx,z:a[2]+f*dz,fg:a[3]+f*(b[3]-a[3]),dx:dx/L,dz:dz/L}}}}
function fmt(s){const k=Math.floor(s/1000);return k+'+'+(s-k*1000).toFixed(3).padStart(7,'0')}
function parseSta(t){t=(t||'').trim();const m=t.match(/^(\d+)\+(\d+(?:\.\d+)?)$/);return m?+m[1]*1000+ +m[2]:(isFinite(+t)?+t:NaN)}
let viewSta=6000,lastView='v-ic';
function staView(kind,s){const p=atSta(s);const nx=p.dz,nz=-p.dx;const lake=nx>0?1:-1;
  if(kind==='v-sideLake')return{p:[p.x+nx*lake*190,30,p.z+nz*lake*190],t:[p.x,9,p.z]};
  if(kind==='v-sideLand')return{p:[p.x-nx*lake*190,30,p.z-nz*lake*190],t:[p.x,9,p.z]};
  return{p:[p.x-p.dx*140,40,p.z-p.dz*140],t:[p.x+p.dx*260,8,p.z+p.dz*260]}}
function go(id,s,dur){document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===id)));lastView=id;if(isFinite(s))viewSta=s;drawCursor();
  if(!viewer)return;const v=id.startsWith('v-side')||id==='v-along'?staView(id,viewSta):views[id];
  const D=W(...v.p),T=W(...v.t);const dir=C.Cartesian3.normalize(C.Cartesian3.subtract(T,D,new C.Cartesian3()),new C.Cartesian3());
  const upE=C.Ellipsoid.WGS84.geodeticSurfaceNormal(D,new C.Cartesian3());const right=C.Cartesian3.normalize(C.Cartesian3.cross(dir,upE,new C.Cartesian3()),new C.Cartesian3());
  const up=C.Cartesian3.cross(right,dir,new C.Cartesian3());const o={destination:D,orientation:{direction:dir,up}};
  if(dur===0)viewer.camera.setView(o);else viewer.camera.flyTo({...o,duration:dur??1.6})}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{const s=parseSta($('sta').value);go(b.dataset.view,isFinite(s)?s:viewSta)}));
$('sta').addEventListener('keydown',e=>{if(e.key==='Enter'){const s=parseSta(e.target.value);if(isFinite(s))go(lastView.startsWith('v-side')||lastView==='v-along'?lastView:'v-sideLake',s)}});
$('ve').addEventListener('change',e=>{ve=+e.target.value;if(window._setVE)_setVE()});
// ---------------- info ----------------
function showInfo(e){if(!e)return;let h='';const kv=rows=>'<dl class="kv">'+rows.filter(r=>r[1]).map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('')+'</dl>';
  const I=d=>d==null||d>=ENG.NEVER/2?'':RES.iso(d);
  if(e.k==='pier'){const v=e.piles,d=RES.SUP[e.id]||{};h=`<div class="sel-title">교각/교대 ${e.id}</div>`+kv([['Bored pile',v?`${v[0]}본 · Ø${v[1]} m · L ${(+v[2]).toFixed(1)} m`:''],['근거',v?v[3]:''],['기초 완료',I(d.pile)],['교각 완료',I(d.pier)]])}
  else if(e.k==='span'){const d=RES.SPAN[e.id]||{};h=`<div class="sel-title">경간 ${e.id}</div>`+kv([['거더 가설',I(d.girder)||'—'],['슬래브',I(d.deck)],['포장',I(d.pave)]])}
  else if(e.k==='tr'){const i=EL.filter(x=>x.k==='tr').indexOf(e),d=RES.TRE[i];h=`<div class="sel-title">${e.id}</div>`+kv([['설치',I(d.a)],['해체',I(d.b)]])}
  else if(e.k==='zone'){const S=(EZS.find(z=>z.id===e.zid)||{st:{}}).st;h=`<div class="sel-title">${e.id} 성토부</div>`+kv([['wall','가물막이'],['exc','불량토 굴착'],['gravel','부직포·쇄석'],['gi','지반개량'],['fill','성토'],['prefill','Preload'],['armor','사석 피복'],['wallrm','가물막이 철거'],['pave','포장 기층']].filter(([k])=>S[k]).map(([k,n])=>[n,`${S[k][0].slice(2).replace(/-/g,'.')} ~ ${S[k][1].slice(2).replace(/-/g,'.')}`]))}
  else h=`<div class="sel-title">${e.id}</div>`;
  if(RESF&&MODE!=='plan'&&(e.k==='pier'||e.k==='span')){const RB=cmpData().R,P=e.k==='pier'?RB.SUP[e.id]:RB.SPAN[e.id],F=e.k==='pier'?RESF.SUP[e.id]:RESF.SPAN[e.id];
    const keys=e.k==='pier'?[['pile','기초'],['pier','교각']]:[['girder','거더'],['deck','슬래브'],['pave','포장']];const dd=MS(PRJ.dataDate);
    h+=kv(keys.filter(([k])=>F&&F[k]!=null&&F[k]<ENG.NEVER/2).map(([k,n])=>{const f=RES.iso(F[k]),d=P&&P[k]!=null?F[k]-P[k]:0;
      return [`${n} ${MS(f)<=dd?'실적':'예상'}`,`${f}${d?` <span class="${d>0?'neg':'pos'}">(${d>0?'+':''}${d}일)</span>`:''}`]}))}
  $('readout').innerHTML=h}
// ---------------- schedule panel ----------------
const ZN={'SUCAT-IC':'Sucat IC','SUCAT-SLIP':'Sucat Slip Road','ALA-IC':'Alabang IC & Ramp','ALA-SLIP':'Alabang Slip Road'};
const STAGE=[['wall','가물막이 설치'],['dewater','배수'],['exc','불량토 굴착'],['gravel','부직포·쇄석'],['gi','지반개량'],['fill','성토'],['armor','사석 피복'],['prefill','Preload 성토'],['preload','Preload 방치'],['prerm','Preload 제거'],['wallrm','가물막이 철거'],['pave','포장 기층']];
let cur_t=0;const frac=(S,k)=>S[k]?Math.max(0,Math.min(1,(cur_t-S[k][0])/(S[k][1]-S[k][0]))):0;
function setK(id,n,N){$('k_'+id).innerHTML=`${n.toLocaleString()} <small>/ ${N.toLocaleString()}</small>`;$('m_'+id).style.width=(100*n/N).toFixed(1)+'%'}
function update(t){cur_t=t;const ds=iso(t);if(window._setDay)_setDay((t-D0)/DAY+0.5);
  $('date').textContent=ds.replace(/-/g,'.');$('asofDate').textContent=ds.replace(/-/g,'.');
  let np=0;for(const d of PL){if(d<=ds)np++;else break}setK('pile',np,PL.length);
  setK('pier',M.piers.filter(p=>p.pier&&ds>=p.pier).length,M.piers.length);
  const G=M.spans.filter(s=>s.girder);setK('gird',G.filter(s=>ds>=s.girder).length,G.length);setK('deck',M.spans.filter(s=>s.deck&&ds>=s.deck).length,M.spans.length);
  if(PROG&&MODE!=='plan'){const c=ENG.curve(SCHED.tasks,PROG,PRJ.dataDate,[t+DAY])[0],cm=cmpData();c.plan=ENG.curve(cm.sched.tasks,null,PRJ.dataDate,[t+DAY],cm.frozen)[0].plan;$('l_all').textContent=t<=MS(PRJ.dataDate)+DAY?'실적 공정률 (작업기간 가중)':'예상 공정률 (실적기반)';
    $('k_all').innerHTML=`${c.act.toFixed(1)} <small>% · ${esc(cm.b.name.split(' ')[0])} ${c.plan.toFixed(1)}%</small>`;$('m_all').style.width=c.act+'%'}
  else{let w=0;for(const x of durW)w+=Math.max(0,Math.min(x.b,t)-x.a);const pa=w/totW;$('l_all').textContent='계획 공정률 (작업기간 가중)';$('k_all').innerHTML=`${(100*pa).toFixed(1)} <small>%</small>`;$('m_all').style.width=(100*pa)+'%'}
  $('zones').innerHTML=EZ.map(z=>{const S=z.S;let lbl='착공 전',cls='none',f=0;
    if(S.pave&&t>S.pave[1]){lbl='완료';cls='done';f=1}else for(const[k,name]of STAGE)if(S[k]&&t>=S[k][0]){lbl=name+(t<=S[k][1]?` ${Math.round(100*frac(S,k))}%`:'');cls='run'}
    const all=Object.values(S);const a=Math.min(...all.map(v=>v[0])),b=Math.max(...all.map(v=>v[1]));f=Math.max(0,Math.min(1,(t-a)/(b-a)));
    return `<div class="zrow"><div class="l"><div class="nm">${ZN[z.id]}</div><div class="zbar"><i style="width:${(100*f).toFixed(0)}%"></i></div></div><span class="pill ${cls}">${lbl}</span></div>`}).join('');
  const act=leaves.filter(r=>ds>=r.s&&ds<=r.f);const byP={};act.forEach(r=>(byP[r.p]=byP[r.p]||[]).push(r));const nm=id=>(TL.gantt.find(x=>x.id===id)||{name:''}).name;
  $('nact').textContent=act.length+'건';
  $('active').innerHTML=act.length?Object.entries(byP).map(([p,rs])=>`<div class="g">${nm(+p)}</div>`+rs.map(r=>`<div class="a"><span>${r.name}</span><span>~ ${r.f.slice(2).replace(/-/g,'.')}</span></div>`).join('')).join(''):'<div class="empty">이 날짜에 진행 중인 activity가 없습니다.</div>';
  const st=COMM;$('phase').textContent=`${MODE==='plan'?'계획':t<=MS(PRJ.dataDate)+DAY?'실적':'예상'} · ${t<st?'착공 준비':t>=MS(MODE!=='plan'&&VF?VF.finish:TL.finish)?'준공':'시공 중'} · D${t<st?'-':'+'}${Math.abs(Math.round((t-st)/DAY))}`;$('phase').title=`착공 ${iso(st).replace(/-/g,'.')} 기준`;
  drawNow(t);drawProfile(ds,t);if($('follow').checked)followFront(ds)}
let lastFollow=0;
function followFront(ds){const now=performance.now();if(now-lastFollow<1200)return;lastFollow=now;let best=null;
  for(const s of M.spans){if(s.s0==null||s.ramp)continue;for(const k of ['girder','deck']){const d=s[k];if(d&&d<=ds&&(!best||d>best.d))best={d,s:(s.s0+s.s1)/2}}}
  if(!best)return;$('sta').value=fmt(best.s).slice(0,-4);go(lastView.startsWith('v-side')||lastView==='v-along'?lastView:'v-sideLake',best.s,1.0)}
// ---------------- profile ----------------
const PV=$('prof');const S0=4100,S1=8560,ZMIN=-75,ZMAX=19,ZB=-2,UP=0.66;let PW=800,PH=220,px,pz;
const css=v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim();
function profScales(){PW=PV.clientWidth||800;PH=PV.clientHeight||220;const L=44,Rr=8,T=8,B=22,Hh=PH-T-B;px=s=>L+(PW-L-Rr)*(s-S0)/(S1-S0);pz=z=>z>=ZB?T+Hh*UP*(ZMAX-z)/(ZMAX-ZB):T+Hh*UP+Hh*(1-UP)*(ZB-z)/(ZB-ZMIN);return{L,R:Rr,T,B}}
const spanState=(s,ds)=>s.pave&&ds>=s.pave?'pave':s.deck&&ds>=s.deck?'deck':s.girder&&ds>=s.girder?'girder':null;
const SC={girder:'#ffa833',deck:'#b4b7b3',pave:'#3a3d42'};
function drawProfile(ds,t){const P=M.profile;const m=profScales();const dark=document.documentElement.dataset.theme==='dark';let s='';
  s+=`<rect x="${px(S0)}" y="${pz(1.57)}" width="${px(S1)-px(S0)}" height="${pz(ZB)-pz(1.57)}" fill="${dark?'#16343f':'#d9f2f8'}"/><rect x="${px(S0)}" y="${pz(ZB)}" width="${px(S1)-px(S0)}" height="${pz(ZMIN)-pz(ZB)}" fill="${dark?'#2a2723':'#f2eee8'}"/>`;
  for(const z of [0,5,10,15,-25,-50,-75])s+=`<line x1="${m.L}" x2="${PW-m.R}" y1="${pz(z)}" y2="${pz(z)}" stroke="${css('--color-divider-default')}"/><text x="${m.L-6}" y="${pz(z)+4}" text-anchor="end">${z}</text>`;
  for(let k=4500;k<=8500;k+=500)s+=`<text x="${px(k)}" y="${PH-6}" text-anchor="middle">${Math.floor(k/1000)}+${String(k%1000).padStart(3,'0')}</text>`;
  s+=`<polyline fill="none" stroke="${css('--color-text-hint')}" stroke-width="1" stroke-dasharray="4 3" points="${P.fg.map(([a,b])=>px(a).toFixed(1)+','+pz(b).toFixed(1)).join(' ')}"/>`;
  {const z=EZ.find(q=>q.id==='SUCAT-IC'),S=z.S;cur_t=t;const f=frac(S,'fill');let col=null,hb=.1;
   if(S.gravel&&t>=S.gravel[0]){hb=.75*frac(S,'gravel');col='#c9b48a'}if(f>0)col='#968c76';if(S.pave&&t>=S.pave[0])col='#3a3d42';
   if(S.wall&&t>=S.wall[0]&&!(S.wallrm&&t>S.wallrm[1]))s+=`<line x1="${px(4160)}" x2="${px(4160)}" y1="${pz(3.2)}" y2="${pz(ZB-6)}" stroke="#4fc3f7" stroke-width="2"/>`;
   if(col){const pts=P.fg.filter(([a])=>a>=4160&&a<=4915.53).map(([a,b])=>[a,f>0?-1.9+(b+1.9)*f:hb]);s+=`<polygon fill="${col}" points="${px(4160)},${pz(ZB)} ${pts.map(([a,b])=>px(a).toFixed(1)+','+pz(b).toFixed(1)).join(' ')} ${px(4915.53)},${pz(ZB)}"/>`}}
  const w=Math.max(1.5,(px(40)-px(0))*0.18);
  for(const p of P.piers){if(!(p.pile&&ds>=p.pile))continue;const x=px(p.s);
    if(p.pv)s+=`<rect x="${x-w*.6}" y="${pz(ZB)}" width="${w*1.2}" height="${pz(ZB-p.pv)-pz(ZB)}" fill="#8a5f45"/>`;
    s+=`<rect x="${x-w*1.4}" y="${pz(2.6)}" width="${w*2.8}" height="${pz(ZB)-pz(2.6)}" fill="#80827e"/>`;
    if(p.pier&&ds>=p.pier)s+=`<rect x="${x-w/2}" y="${pz(p.z-2.3)}" width="${w}" height="${pz(2.6)-pz(p.z-2.3)}" fill="#acafab"/>`}
  for(const sp of P.spans){const st=spanState(sp,ds);if(!st)continue;const a=atSta(sp.s0).fg,b=atSta(sp.s1).fg,top=st==='girder'?.35:0;
    s+=`<polygon fill="${SC[st]}" stroke="${dark?'#15171c':'#ffffff'}" stroke-width=".5" points="${px(sp.s0)},${pz(a-top)} ${px(sp.s1)},${pz(b-top)} ${px(sp.s1)},${pz(b-2.3)} ${px(sp.s0)},${pz(a-2.3)}"/>`}
  s+=`<g id="pcur"></g>`;
  PV.innerHTML=`<svg width="${PW}" height="${PH}" viewBox="0 0 ${PW} ${PH}" role="img" aria-label="본선 종단면도">${s}</svg>`;drawCursor()}
function drawCursor(){const g=document.getElementById('pcur');if(!g||!px)return;const x=px(viewSta);const c=css('--color-action-primary');g.innerHTML=`<line x1="${x}" x2="${x}" y1="${pz(ZMAX)}" y2="${pz(ZMIN)}" stroke="${c}" stroke-width="1.5"/><text x="${x+4}" y="${pz(ZMAX)+12}" style="fill:${c};font-weight:600">${fmt(viewSta).slice(0,-4)}</text>`}
PV.addEventListener('click',e=>{const r=PV.getBoundingClientRect();const m=profScales();const s=S0+(e.clientX-r.left-m.L)/(PW-m.L-m.R)*(S1-S0);if(s<4160||s>8525.53)return;
  $('sta').value=fmt(s).slice(0,-4);go(lastView.startsWith('v-side')||lastView==='v-along'?lastView:'v-sideLake',s);$('sec-viewer').scrollIntoView({behavior:'smooth'})});
// ---------------- gantt ----------------
const Gd=$('gantt');let open=new Set();let gx=null;
function defaultOpen(){const ids=new Set(TL.gantt.map(r=>r.id)),par={};for(const r of TL.gantt)par[r.id]=r.p;open=new Set();
  const m=MAP||Object.fromEntries(REFS.map(r=>[r.ref,r.ref]));
  for(const r of REFS){if(r.grp==='가설·기타')continue;let p=par[m[r.ref]];const chain=[];while(p!=null&&ids.has(p)){chain.push(p);p=par[p]}const top=chain[chain.length-1];if(top!=null)open.add(top)}}
const isCrit=id=>!!(CPM&&CPM.byId[id]&&CPM.byId[id].crit);
function rowsVisible(){if($('cpOnly').checked){const nm={};for(const r of TL.gantt)nm[r.id]=r.name;return TL.gantt.filter(r=>!r.sum&&isCrit(r.id)).sort((a,b)=>a.s.localeCompare(b.s)||a.id-b.id).map(r=>({...r,d:0,name:nm[r.p]?`${r.name} · ${nm[r.p]}`:r.name}))}
  const ids=new Set(TL.gantt.map(r=>r.id));const out=[];const walk=r=>{out.push(r);if(r.sum&&open.has(r.id))for(const c of TL.gantt.filter(x=>x.p===r.id))walk(c)};
  for(const r of TL.gantt.filter(x=>!ids.has(x.p)))walk(r);return out}
function drawGantt(){const FTI={};if(PROG)for(const x of PROG.tasks)FTI[x.id]=x;const GW=Math.max(640,Gd.clientWidth||900),LW=300,RH=28,BW=GW-LW-10;const rs=rowsVisible();const H=rs.length*RH+28;gx=ms=>LW+BW*(ms-t0)/(t1-t0);
  const cCrit=css('--color-status-danger'),cBar=css('--color-border-strong'),cSum=css('--color-text-secondary'),cAct=css('--color-action-primary'),cLine=css('--color-divider-default');
  let s=`<svg width="${GW}" height="${H}" viewBox="0 0 ${GW} ${H}" role="img" aria-label="공정표">`;
  for(let y=2027;y<=2030;y++){const x=gx(MS(y+'-01-01'));s+=`<line x1="${x}" x2="${x}" y1="18" y2="${H}" stroke="${cLine}"/><text class="yr" x="${x+4}" y="12">${y}</text>`}
  rs.forEach((r,i)=>{const y=24+i*RH,a=gx(MS(r.s)),b=Math.max(a+2,gx(MS(r.f)+DAY)),ind=r.d*16,cr=!r.sum&&isCrit(r.id),cd=CPM&&CPM.byId[r.id];let lab=(r.sum?(open.has(r.id)?'▾ ':'▸ '):'')+r.name;
    const on=cur_t>=MS(r.s)&&cur_t<=MS(r.f)+DAY;
    s+=`<g class="row" data-id="${r.id}" data-s="${r.s}"><rect class="bg" x="0" y="${y-2}" width="${GW}" height="${RH}" fill="transparent" rx="4"/><text x="${8+ind}" y="${y+16}" ${r.sum?'font-weight="600"':''}>${lab.length>34-ind/8?lab.slice(0,33-ind/8)+'…':lab}</text>`+
    (PROG&&MODE!=='plan'&&FTI[r.id]?(()=>{const f=FTI[r.id],fs=f.start.slice(0,10),ff=f.finish.slice(0,10),fa=gx(MS(fs)),fb=Math.max(fa+2,gx(MS(ff)+DAY)),late=(MS(ff)-MS(r.f))/DAY>TOL,o=PROG.byId[r.id];
      return `<rect x="${fa}" y="${y+(r.sum?18:21)}" width="${fb-fa}" height="4" rx="2" fill="${late?cCrit:cAct}" ${o&&o.state==='todo'?'fill-opacity=".45"':''}/>`})():'')+
    (r.ms?`<path d="M${a} ${y+5} l7 7 l-7 7 l-7 -7z" fill="${cr?cCrit:cAct}"/>`:`<rect class="bar" x="${a}" y="${y+(r.sum?8:5)}" width="${b-a}" height="${r.sum?8:14}" rx="3" fill="${r.sum?cSum:cr?cCrit:on?cAct:cBar}" ${cr&&!on?'fill-opacity=".75"':''}/>`)+`<title>${r.name}: 계획 ${r.s} → ${r.f}${cd?` · 여유 ${fmtD(cd.tf)}일${cd.crit?' (주공정)':''}`:''}${PROG&&PROG.byId[r.id]?` · 실적·예상 ${PROG.byId[r.id].es} → ${PROG.byId[r.id].ef}${PROG.byId[r.id].dfin?` (${PROG.byId[r.id].dfin>0?'+':''}${PROG.byId[r.id].dfin}일)`:''}`:''}</title></g>`});
  s+=`<line id="nowline" y1="18" y2="${H}" stroke="${css('--color-text-strong')}" stroke-width="1.5" stroke-dasharray="5 3"/></svg>`;Gd.innerHTML=s;drawNow(cur);
  Gd.querySelectorAll('.row').forEach(g=>g.addEventListener('click',e=>{const id=+g.dataset.id;const r=TL.gantt.find(x=>x.id===id);
    if(e.target.classList.contains('bar')||!r||!r.sum){setT(MS(g.dataset.s));return}open.has(id)?open.delete(id):open.add(id);drawGantt()}))}
function drawNow(t){const l=document.getElementById('nowline');if(l&&gx){l.setAttribute('x1',gx(t));l.setAttribute('x2',gx(t))}}
// ---------------- transport ----------------
const sl=$('slider');let cur=COMM+(MS('2028-10-01')-MS('2026-06-01')),timer=null,lastGantt=0;
function setT(ms){cur=Math.max(t0,Math.min(t1,ms));sl.value=Math.round((cur-t0)/DAY);update(cur);const n=performance.now();if(n-lastGantt>400){lastGantt=n;drawGantt()}}
sl.addEventListener('input',()=>setT(t0+sl.value*DAY));
const pb=$('play');function stop(){clearInterval(timer);timer=null;pb.innerHTML=ICON_PLAY+'<span>재생</span>';drawGantt()}
pb.addEventListener('click',()=>{if(timer){stop();return}if(cur>=t1)setT(t0);pb.innerHTML=ICON_STOP+'<span>정지</span>';timer=setInterval(()=>{if(cur>=t1){stop();return}setT(cur+(+$('speed').value)*DAY)},100)});
$('today').addEventListener('click',()=>{stop();setT(Date.now())});
$('back').addEventListener('click',()=>setT(cur-30*DAY));$('fwd').addEventListener('click',()=>setT(cur+30*DAY));
function drawTicks(){sl.max=NDAYS;const y0=new Date(t0).getUTCFullYear(),y1=new Date(t1).getUTCFullYear();const tk=[];for(let y=y0+1;y<=y1;y++)tk.push([y+'-01-01',String(y)]);tk.push([iso(COMM),'착공'],[(MODE!=='plan'&&VF?VF.finish:TL.finish),MODE!=='plan'&&VF?'예상 준공':'준공']);if(PROG)tk.push([PRJ.dataDate,'기준일']);
  $('ticks').innerHTML=tk.map(([d,l])=>`<span class="${l.length<4?'ms':''}" style="left:${(100*(MS(d)-t0)/(t1-t0)).toFixed(2)}%">${l}</span>`).join('')}
drawTicks();
// re-run the whole 4D view from a (new or edited) schedule — used by upload/edit stages
const fmtD=v=>{const r=Math.round(v*10)/10;return Number.isInteger(r)?String(r):r.toFixed(1)};
const dot=s=>s?s.replace(/-/g,'.'):'–';
const sgn=n=>(n>0?'+':n<0?'−':'')+Math.abs(n).toLocaleString();
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// ---------------- schedule header / warnings ----------------
function renderSchedInfo(){const m=SCHED.meta;const custom=!!MAP;
  $('schedBadge').textContent=custom?('업로드: '+(m.file||m.name)).slice(0,42):'General Schedule re3';$('schedBadge').title=`${m.name} · ${m.format} · ${m.file||''}`;
  $('schedDesc').textContent=`${custom?m.file||m.name:'General Schedule of LLRN Project (re3)'} 기준 계획 공정을 위성지도 위 3D 모델로 재생합니다. (공정 날짜는 브라우저에서 공정표로부터 계산)`;
  const w=RES.warn;let h='';
  if(custom)h+=`<b>업로드한 공정표를 사용 중입니다</b> — ${esc(m.file||m.name)} (${esc(m.format)}, activity ${m.tasks}개). 이 브라우저에 저장되어 다음에 열 때도 유지됩니다. <a href="#" id="toR5">기본 공정표(re3)로 되돌리기</a>`;
  if(w.length)h+=(h?'<br>':'')+`<b>공정표에서 찾지 못한 항목 ${w.length}개</b> — 해당 구조물은 3D에 나타나지 않습니다: ${esc(w.slice(0,8).join(', '))}${w.length>8?' 외':''}. [공정표 불러오기]에서 연결을 확인해 주세요.`;
  $('schedAlert').hidden=!h;$('schedMsg').innerHTML=h;const a=document.getElementById('toR5');if(a)a.addEventListener('click',e=>{e.preventDefault();resetToR5()})}
// ---------------- contract time (착공·준공·여유) ----------------
function renderContract(){const start=iso(COMM),months=+CON.months||CFG.contract.months;
  const end=ENG.addMonths(start,months),plan=TL.finish,fl=Math.round((MS(end)-MS(plan))/DAY);
  const planM=((MS(plan)+DAY-MS(start))/DAY/30.4375);
  $('cStart').textContent=dot(start);{const cm=SCHED.tasks.find(x=>x.id===CFGA.commence);const nm=cm?' ('+String(cm.name).trim()+')':'';$('cStartSrc').textContent=SHIFT.abs?`기준선 ${typeof blName==='function'?blName():''} (착공일 고정)`:SHIFT.delta?`공정표 원본 ${dot(SHIFT.old)}에서 ${SHIFT.delta>0?'+':''}${SHIFT.delta}작업일 이동 · 전체 activity 동일 이동${SHIFT.snapped?' · 휴일이라 다음 작업일로 조정':''}`:`공정표 착공 마일스톤${nm}`;$('cStartSrc').title=$('cStartSrc').textContent}
  $('cMonths').textContent=months+'개월';$('cMonthsSub').textContent=`${Math.round((MS(end)-MS(start))/DAY).toLocaleString()}일`;
  $('cEnd').textContent=dot(end);$('cPlan').textContent=dot(plan);$('cPlanSub').textContent=`착공 후 ${planM.toFixed(1)}개월 · 공정표 최종 activity`;
  const v=$('cFloat');v.textContent=sgn(fl)+'일';v.className='v '+(fl<0?'neg':'pos');if(fl===0)v.textContent='0일 (일치)';
  $('cFloatSub').textContent=fl<0?`계약 대비 ${(-fl).toLocaleString()}일 초과 (${(-fl/30.4375).toFixed(1)}개월)`:(fl?`계약 대비 ${fl.toLocaleString()}일 여유`:'계획 준공일 = 계약 준공일');$('cFloatSub').title=$('cFloatSub').textContent;
  $('cStartIn').value=start;$('cMonthsIn').value=months}
$('cEdit').addEventListener('click',()=>{const on=$('cStartIn').hidden;$('cStartIn').disabled=!!SHIFT.abs;$('cStartIn').title=SHIFT.abs?'수정 기준선(Rev.1 이후)은 실적이 들어 있어 착공일을 옮길 수 없습니다':'';['cStartIn','cMonthsIn'].forEach(i=>$(i).hidden=!on);['cStart','cMonths'].forEach(i=>$(i).hidden=on);
  $('cEdit').setAttribute('aria-pressed',String(on));if(on)$('cStartIn').focus()});
function saveCon(){try{localStorage.setItem(CKEY,JSON.stringify(CON))}catch(e){}renderContract();if(window._redrawCP)_redrawCP()}
$('cStartIn').addEventListener('change',e=>{const v=e.target.value;if(!v||SHIFT.abs)return;const was=COMM;CON.start=v!==SHIFT.old?v:undefined;
  try{localStorage.setItem(CKEY,JSON.stringify(CON))}catch(_){}
  const keep=cur-was;applySchedule(BASE,MAP);setT(COMM+keep);if(window._redrawCP)_redrawCP()});
$('cMonthsIn').addEventListener('change',e=>{const v=Math.round(+e.target.value);CON.months=v>0&&v!==CFG.contract.months?v:undefined;saveCon()});
// ---------------- critical path card ----------------
function renderCP(){const B=$('cpBody');if(!CPM){B.innerHTML='<div class="empty">activity 관계 정보가 없어 주공정을 계산할 수 없습니다.</div>';$('cpSub').textContent='';return}
  const T={};for(const x of SCHED.tasks)T[x.id]=x;const U={};for(const x of SCHED.tasks)U[String(x.uid)]=x;const ctx=IMP.context(SCHED.tasks);
  const ch=CPM.chain,crit=Object.entries(CPM.byId).filter(([,v])=>v.crit).map(([k])=>+k);
  const near=Object.entries(CPM.byId).filter(([,v])=>!v.crit&&v.tf<=30).map(([k,v])=>[+k,v]).sort((a,b)=>a[1].tf-b[1].tf);
  const parent=id=>{const p=ctx.path[id]||[];return p.slice(Math.min(2,Math.max(0,p.length-1))).join(' › ')};const phase=id=>{const p=ctx.path[id]||[];return p[2]||p[p.length-1]||''};
  const rel=(a,b)=>{const l=(T[b].preds||[]).find(([p])=>String(p)===String(T[a].uid));if(!l)return'';const g=+l[2]||0;return l[1]+(g?(g>0?'+':'')+fmtD(g)+'일':'')};
  // phases: consecutive chain activities under the same parent summary
  const ph=[];for(const id of ch){const p=phase(id);if(ph.length&&ph[ph.length-1].p===p)ph[ph.length-1].ids.push(id);else ph.push({p,ids:[id]})}
  const start=iso(COMM),months=+CON.months||CFG.contract.months,end=ENG.addMonths(start,months),fl=Math.round((MS(end)-MS(TL.finish))/DAY);
  $('cpSub').textContent=`계산 기준: 공정표 activity 관계(FS·SS·FF·SF, lag) + 캘린더 "${SCHED.cal.name||'기본'}" (${['일','월','화','수','목','금','토'].filter((d,i)=>CPM.work[i]).join('·')} 근무)`;
  let h=`<div class="cp-stats">
    <div class="st"><div class="l">주공정 activity</div><div class="v">${crit.length}<small style="font-size:13px;font-weight:400;color:var(--color-text-muted)"> / ${CPM.total}</small></div></div>
    <div class="st"><div class="l">준주공정 (여유 30 근무일 이하)</div><div class="v">${near.length}</div></div>
    <div class="st"><div class="l">주공정 종점 = 계획 준공</div><div class="v">${dot(CPM.finish)}</div></div>
    <div class="st"><div class="l">계약 준공 대비</div><div class="v" style="color:${fl<0?'var(--color-status-danger)':'var(--color-status-success)'}">${sgn(fl)}일</div></div></div>`;
  h+=`<div class="cp-flow" aria-label="주공정 흐름">`+ph.map((g,i)=>{const a=T[g.ids[0]],b=T[g.ids[g.ids.length-1]];
    return (i?'<span class="ar" aria-hidden="true">→</span>':'')+`<div class="ph"><b>${esc(g.p||'—')}</b><span>${dot(a.start.slice(0,10)).slice(2)} ~ ${dot(b.finish.slice(0,10)).slice(2)} · ${g.ids.length}개</span></div>`}).join('')+`</div>`;
  h+=`<div class="tbl-wrap"><table class="tbl"><thead><tr><th style="width:44px">순서</th><th>Activity</th><th>소속</th><th>시작</th><th>완료</th><th style="text-align:right">기간(근무일)</th><th>선행 관계</th><th style="text-align:right">여유(근무일)</th></tr></thead><tbody>`+
    ch.map((id,i)=>{const x=T[id],c=CPM.byId[id];return `<tr class="clk" data-s="${x.start.slice(0,10)}"><td class="n">${i+1}</td><td>${esc(String(x.name).trim())}${x.milestone?' <span class="pill run">마일스톤</span>':''}</td><td class="grp">${esc(parent(id))}</td><td class="d">${dot(x.start.slice(0,10))}</td><td class="d">${dot(x.finish.slice(0,10))}</td><td class="n">${fmtD(+x.dur||0)}일</td><td class="d">${i?rel(ch[i-1],id):'—'}</td><td class="n">${fmtD(c.tf)}일</td></tr>`}).join('')+`</tbody></table></div>`;
  const off=crit.filter(id=>!ch.includes(id));
  if(off.length)h+=`<p class="cp-note">여유 0일이지만 위 경로에 포함되지 않은 activity ${off.length}개: ${off.map(id=>esc(String(T[id].name).trim())).join(', ')}</p>`;
  h+=`<details class="near"><summary>준주공정 — 여유 30 근무일 이하 ${near.length}개</summary>${near.length?`<div class="tbl-wrap" style="margin-top:8px"><table class="tbl"><thead><tr><th>Activity</th><th>소속</th><th>시작</th><th>완료</th><th style="text-align:right">여유(근무일)</th></tr></thead><tbody>`+
    near.map(([id,c])=>{const x=T[id];return `<tr class="clk" data-s="${x.start.slice(0,10)}"><td>${esc(String(x.name).trim())}</td><td class="grp">${esc(parent(id))}</td><td class="d">${dot(x.start.slice(0,10))}</td><td class="d">${dot(x.finish.slice(0,10))}</td><td class="n">${fmtD(c.tf)}일</td></tr>`}).join('')+`</tbody></table></div>`:'<div class="empty">해당 activity가 없습니다.</div>'}</details>`;
  const fc=CPM.fileCrit;
  h+=`<p class="cp-note">검증: 관계 계산으로 공정표 일정 ${CPM.reproduced}/${CPM.total}개 재현${fc.n?` · 파일에 기록된 주공정 표시와 ${fc.agree}/${fc.n}개 일치`:''}${CPM.ignored?` · 공정표 밖 activity를 가리키는 관계 ${CPM.ignored}개 제외`:''}${CPM.loops?` · 순환 관계 ${CPM.loops}개 발견`:''}. 행을 클릭하면 해당 일자로 이동합니다.</p>`;
  B.innerHTML=h;B.querySelectorAll('tr.clk').forEach(r=>r.addEventListener('click',()=>{setT(MS(r.dataset.s));$('sec-viewer').scrollIntoView({behavior:'smooth'})}))}
window._redrawCP=renderCP;
$('cpOnly').addEventListener('change',drawGantt);
// ---------------- apply a schedule (initial, uploaded, or reset) ----------------
function applySchedule(sched,map,opts){deriveSchedule(sched,map,opts);recalcActual();defaultOpen();renderSchedInfo();renderContract();renderCP();drawTicks();setT(cur);drawGantt();return RES}
function resetToR5(){if(typeof blToR0==='function'&&!blToR0())return;try{localStorage.removeItem(SKEY)}catch(e){}applySchedule(SCHED0,null);closeImp()}
// ---------------- import dialog ----------------
let IMPD=null,lastFocus=null;
const GRP_ORDER=['교량','성토','가설·기타'];
function openImp(mode){lastFocus=document.activeElement;$('impScrim').hidden=false;showStep(1);$('impReset').hidden=!MAP;impModeInit(mode);setTimeout(()=>$('drop').focus(),0)}
function closeImp(){$('impScrim').hidden=true;$('impErr').hidden=true;$('impFile').value='';if(lastFocus&&lastFocus.focus)lastFocus.focus()}
function showStep(n){$('impStep1').hidden=n!==1;$('impStep2').hidden=n!==2;$('impBack').hidden=n!==2;$('impApply').disabled=n!==2}
$('openImport').addEventListener('click',()=>openImp());$('impClose').addEventListener('click',closeImp);$('impCancel').addEventListener('click',closeImp);$('impBack').addEventListener('click',()=>showStep(1));
$('impReset').addEventListener('click',resetToR5);
$('impScrim').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeImp()}
  if(e.key==='Tab'){const f=[...$('impDlg').querySelectorAll('button,select,input,label[for],[tabindex]:not([tabindex="-1"])')].filter(x=>!x.disabled&&x.offsetParent);if(!f.length)return;
    const a=f[0],b=f[f.length-1];if(e.shiftKey&&document.activeElement===a){e.preventDefault();b.focus()}else if(!e.shiftKey&&document.activeElement===b){e.preventDefault();a.focus()}}});
$('drop').tabIndex=0;$('drop').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('impFile').click()}});
['dragenter','dragover'].forEach(k=>$('drop').addEventListener(k,e=>{e.preventDefault();$('drop').classList.add('over')}));
['dragleave','drop'].forEach(k=>$('drop').addEventListener(k,e=>{e.preventDefault();$('drop').classList.remove('over')}));
$('drop').addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)loadFile(f)});
$('impFile').addEventListener('change',e=>{const f=e.target.files[0];if(f)loadFile(f)});
async function loadFile(f){$('impErr').hidden=true;
  try{const sc=await IMP.readFile(f);const m=IMP.autoMatch(REFS,SCHED0.tasks,sc.tasks);IMPD={sc,map:m.map,score:m.score};renderImp();showStep(2)}
  catch(err){$('impErr').hidden=false;$('impErr').textContent=err.message||String(err)}}
function confOf(s,linked){return !linked?['bad','미연결']:s>=0.9?['done','일치']:s>=0.75?['run','유사']:['warn','확인 필요']}
function renderImp(){const{sc}=IMPD,m=sc.meta,cal=sc.cal;const cp=ENG.cpm(sc.tasks,cal);
  const wd=['일','월','화','수','목','금','토'].filter((d,i)=>cal.work[i]).join('·');
  $('impSum').innerHTML=[['파일',m.file],['형식',m.format],['프로젝트',m.name],['activity (관계)',`${m.tasks.toLocaleString()}개 (${m.nRel.toLocaleString()}개)`],
    ['기간',`${dot(m.start)} ~ ${dot(m.finish)}`],['캘린더',`${cal.name||'기본'} · ${wd} · 예외일 ${cal.exceptions.length}개${m.taskCals?` · 별도 캘린더 activity ${m.taskCals}개`:''}`],
    ['주공정 (파일 / 계산)',`${m.fileCrit}개 / ${cp?Object.values(cp.byId).filter(v=>v.crit).length:'–'}개`],['일정 재현 (관계 계산)',cp?`${cp.reproduced}/${cp.total}`:'–']]
    .map(([l,v])=>`<div class="st"><div class="l">${l}</div><div class="v" title="${esc(v)}">${esc(v)}</div></div>`).join('');
  const ctx=IMP.context(sc.tasks);const cand=sc.tasks.filter(x=>!x.summary&&x.start&&x.finish&&x.name&&String(x.name).trim());
  const byId={};for(const x of sc.tasks)byId[x.id]=x;
  const lab=x=>{const p=ctx.path[x.id]||[];return `${x.id} · ${String(x.name).trim()}${p.length?' — '+p[p.length-1]:''} (${x.start.slice(2,10).replace(/-/g,'.')}~${x.finish.slice(2,10).replace(/-/g,'.')})`};
  // the reference may be a summary (e.g. "PIER 12"), so summaries are offered too
  const pool=sc.tasks.filter(x=>x.start&&x.finish&&x.name&&String(x.name).trim()&&x.lvl>0);
  IMPD.opts='<option value="">— 연결 안 함 —</option>'+pool.map(x=>`<option value="${x.id}">${esc(lab(x))}</option>`).join('');
  const groups=[...new Set(REFS.map(r=>r.grp))];let h='';
  for(const g of groups){h+=`<tr class="sec"><td colspan="4">${g}</td></tr>`;
    for(const r of REFS.filter(x=>x.grp===g)){const c=IMPD.map[r.ref],[cls,txt]=confOf(IMPD.score[r.ref],c!=null),x=c!=null?byId[c]:null;
      h+=`<tr data-ref="${r.ref}" data-ok="${cls==='done'||cls==='run'?1:0}"><td><b>${esc(r.role)}</b></td><td>${esc(r.name)}<span class="sub">${esc(r.path[r.path.length-1]||'')} · ${dot(r.s).slice(2)}~${dot(r.f).slice(2)}</span></td>
        <td class="pick"><span class="cur">${x?esc(lab(x)):'— 연결 안 함 —'}</span> <button class="btn" type="button" style="height:28px;margin-left:6px">변경</button></td><td><span class="pill ${cls}">${txt}</span></td></tr>`}}
  $('impRows').innerHTML=h;
  $('impRows').querySelectorAll('tr[data-ref]').forEach(tr=>{const r=+tr.dataset.ref,td=tr.querySelector('td.pick');
    td.querySelector('button').addEventListener('click',()=>{td.innerHTML=`<select class="select" aria-label="연결 activity">${IMPD.opts}</select>`;const sel=td.querySelector('select');sel.value=IMPD.map[r]==null?'':String(IMPD.map[r]);sel.focus();
      sel.addEventListener('change',()=>{IMPD.map[r]=sel.value===''?null:+sel.value;IMPD.score[r]=sel.value===''?0:1;const p=tr.querySelector('.pill');const[c,t]=sel.value===''?['bad','미연결']:['done','직접 지정'];p.className='pill '+c;p.textContent=t;tr.dataset.ok=sel.value===''?0:1;impStat()})})});
  $('impOnly').checked=REFS.length>100;impStat();filterImp();renderImpActs()}
function impStat(){const v=Object.values(IMPD.map),n=v.filter(x=>x!=null).length,need=[...$('impRows').querySelectorAll('tr[data-ref]')].filter(t=>t.dataset.ok!=='1').length;
  $('impStat').textContent=`${REFS.length}개 항목 중 ${n}개 연결 · 확인 필요 ${need}개`}
function filterImp(){const only=$('impOnly').checked;$('impRows').querySelectorAll('tr[data-ref]').forEach(t=>t.hidden=only&&t.dataset.ok==='1');
  $('impRows').querySelectorAll('tr.sec').forEach(s=>{let n=s.nextElementSibling,any=false;while(n&&!n.classList.contains('sec')){if(!n.hidden)any=true;n=n.nextElementSibling}s.hidden=!any})}
$('impOnly').addEventListener('change',filterImp);
$('impApply').addEventListener('click',()=>{if(!IMPD)return;const sc=IMPD.sc,map={...IMPD.map};
  impCarryActuals();   // actuals whose activity ID is not in the new file follow the user's choice (or stay unlinked)
  if($('impMode').value==='add'){try{addRevisionFromUpload(sc,map)}catch(err){$('impErr').hidden=false;$('impErr').textContent='새 기준선을 만들지 못했습니다: '+(err.message||err);showStep(1);return}closeImp();return}
  if(typeof blToR0==='function'&&!blToR0())return;
  const prev=[SCHED,MAP];try{applySchedule(sc,map)}catch(err){try{applySchedule(prev[0],prev[1])}catch(_){}$('impErr').hidden=false;$('impErr').textContent='적용하지 못했습니다: '+(err.message||err);showStep(1);return}
  try{localStorage.setItem(SKEY,JSON.stringify({sched:sc,map}))}catch(e){}
  closeImp()});
/*@@ACTUAL@@*/
window._redraw=()=>{drawGantt();drawProfile(iso(cur),cur);if(PROG)drawSCurve()};
new ResizeObserver(()=>window._redraw()).observe($('content'));
window.__app={setT,go,applySchedule,resetToR5,get sched(){return SCHED},get cpm(){return CPM},get map(){return MAP},get res(){return RES},get ready(){return !!model}};
defaultOpen();renderSchedInfo();renderContract();renderCP();
$('asmN').textContent=(CFG.assumptions||[]).length;$('asmList').innerHTML=(CFG.assumptions||[]).map(x=>`<li style="margin-bottom:4px">${esc(x)}</li>`).join('');
setT(cur);drawGantt();go('v-ic',undefined,0);
recalcActual();restoreDraft();
})();
