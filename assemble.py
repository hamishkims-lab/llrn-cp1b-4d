#!/usr/bin/env python3
"""LLRN CP1B 4D 공정관리 — 단일 HTML 조립 스크립트. 사용: python assemble.py [출력경로]"""
import json,base64,sys,os
H=os.path.dirname(os.path.abspath(__file__)); D=os.path.join(H,'data')
r=lambda p:open(os.path.join(H,p),encoding='utf8').read()
j=lambda n:open(os.path.join(D,n+'.json'),encoding='utf8').read()
glb=base64.b64encode(open(os.path.join(D,'model.glb'),'rb').read()).decode()
png=base64.b64encode(open(os.path.join(D,'overview.png'),'rb').read()).decode()
decl='\nconst GLB_B64="'+glb+'", '+', '.join(f'{n}={j(n)}' for n in ['APP','FR','SCHED0','REFS','CFG','ST','PROF','CL'])+', OVIMG="data:image/png;base64,'+png+'", OVB='+j('OVB')+';\n'
out=r('shell.html').replace('/*@@ENGINE@@*/',r('engine.js')).replace('/*@@IMPORTER@@*/',r('importer.js')).replace('/*@@SIMCORE@@*/',r('sim_core.js')).replace('/*@@APP@@*/',decl+r('app_main.js').replace('/*@@ACTUAL@@*/',r('app_actual.js')+'\n'+r('app_sim.js')))
p=sys.argv[1] if len(sys.argv)>1 else os.path.join(H,'dist','LLRN_CP1B_4D_공정관리.html')
os.makedirs(os.path.dirname(os.path.abspath(p)),exist_ok=True)
open(p,'w',encoding='utf8').write(out); print(p,len(out))
