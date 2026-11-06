#!/usr/bin/env python3
"""알라방 경로 조사 — 단일 HTML 조립. 사용: python route-survey/build.py [출력경로]"""
import re, base64, sys, os
H=os.path.dirname(os.path.abspath(__file__))
r=lambda p:open(os.path.join(H,p),encoding='utf-8').read()
data=r('data.js')
nodes=re.search(r'const NODES = \[.*?\n\];',data,re.S).group(0)
routes=re.search(r'const ROUTES = \{.*?\n\};',data,re.S).group(0)
js=r('script.js').replace('{{NODES}}',nodes).replace('{{ROUTES}}',routes).replace('{{PLANNER}}',r('planner.js'))
sym=open(os.path.join(H,'assets','gs-symbol.svg'),'rb').read()
t=(r('template.html').replace('{{LOGO_SVG}}',r('assets/gs-logo-onwhite-ko.svg').strip())
   .replace('{{LOGO_DARK_SVG}}',r('assets/gs-logo-oncolor-ko.svg').strip())
   .replace('{{SYMBOL_DATAURI}}','data:image/svg+xml;base64,'+base64.b64encode(sym).decode())
   .replace('{{SCRIPT}}',js))
left=re.findall(r'\{\{\w+\}\}',t); assert not left, left
p=sys.argv[1] if len(sys.argv)>1 else os.path.join(H,'..','dist','alabang_route_survey.html')
os.makedirs(os.path.dirname(os.path.abspath(p)),exist_ok=True)
open(p,'w',encoding='utf-8').write(t)
open(os.path.splitext(p)[0]+'.check.js','w',encoding='utf-8').write(js)
print(p,len(t))
