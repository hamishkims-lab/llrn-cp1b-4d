// Rev.4b: geometry past END CP1B (STA 8+525.53) — the Alabang Ramp 3·4 continuation into CP2 (about 200 m, no piers in the
// CP1B drawings) — came from the reference 3D model. It is not CP1B scope and has no CP1B activity, so it gets rule code 20
// (never shown). Usage: node tools/patch_cp2_scope.js  (edits data/model.glb in place; safe to run twice)
const fs=require('fs'),path=require('path');const D=path.join(__dirname,'..','data');
const ST=require(path.join(D,'ST.json')),CL=require(path.join(D,'CL.json'));const EL=ST.elems;const END=8525.53,CUT=END+4.5;
const f=path.join(D,'model.glb'),b=fs.readFileSync(f);const jl=b.readUInt32LE(12);const J=JSON.parse(b.slice(20,20+jl));const B0=20+jl+8;
function sta(x,z){let best=null;for(let i=0;i<CL.length-1;i++){const a=CL[i],c=CL[i+1];const dx=c[1]-a[1],dz=c[2]-a[2],L2=dx*dx+dz*dz;const f=((x-a[1])*dx+(z-a[2])*dz)/L2;const ff=Math.max(0,Math.min(1,f));
  const d=Math.hypot(x-(a[1]+ff*dx),z-(a[2]+ff*dz));if(!best||d<best.d)best={d,s:a[0]+f*(c[0]-a[0])}}return best.s}
let n=0;J.meshes.forEach((m,mi)=>m.primitives.forEach(p=>{const pa=J.accessors[p.attributes.POSITION],pv=J.bufferViews[pa.bufferView];const ra=J.accessors[p.attributes._RA],rv=J.bufferViews[ra.bufferView];
  for(let v=0;v<pa.count;v++){const o=B0+(pv.byteOffset||0)+(pa.byteOffset||0)+v*(pv.byteStride||12);const ro=B0+(rv.byteOffset||0)+(ra.byteOffset||0)+v*(rv.byteStride||8);
    const e=b.readUInt16LE(ro),r=b.readUInt16LE(ro+2),el=EL[e];if(!(r===10&&el.id==='P91')&&!(r===13&&el.k==='zone'))continue;
    if(sta(b.readFloatLE(o),b.readFloatLE(o+8))>CUT){b.writeUInt16LE(20,ro+2);n++}}}));
fs.writeFileSync(f,b);console.log('vertices set to rule 20 (out of CP1B scope):',n);
