import os;H=os.path.dirname(os.path.abspath(__file__))
x=open(os.path.join(H,'xlsx.mini.min.js'),encoding='utf8').read()
s=open(os.path.join(H,'pretest_template.html'),encoding='utf8').read().replace('/*@@XLSX@@*/',x)
import sys;p=sys.argv[1] if len(sys.argv)>1 else os.path.join(H,'..','dist','LLRN_사전점검_파일저장.html');os.makedirs(os.path.dirname(os.path.abspath(p)),exist_ok=True);open(p,'w',encoding='utf8').write(s);print(p,len(s))
