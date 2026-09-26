#!/usr/bin/env python3
"""Builds the two deliverables:
   dist/quick-install/  -> Code.gs + Index.html (+ appsscript.json)  : only 2 files to paste
   dist/modular/        -> every module as its own file (for clasp / developers)
"""
import os, re, shutil, json
ROOT=os.path.dirname(os.path.abspath(__file__)); SRC=os.path.join(ROOT,'src'); DIST=os.path.join(ROOT,'dist')
ORDER=['Config','Utils','Db','Settings','Auth','Users','Students','Teachers','Batches','Attendance','Notifications','Content','Fees','Receipts','Results','Dashboard','Dashboard_','Api','Setup','TestData']
ORDER=[o for o in ORDER if os.path.exists(os.path.join(SRC,'backend',o+'.gs'))]
MANIFEST={"timeZone":"Asia/Kolkata","dependencies":{},"exceptionLogging":"STACKDRIVER","runtimeVersion":"V8","webapp":{"executeAs":"USER_DEPLOYING","access":"ANYONE_ANONYMOUS"}}
shutil.rmtree(DIST,ignore_errors=True)
q=os.path.join(DIST,'quick-install'); m=os.path.join(DIST,'modular'); os.makedirs(q); os.makedirs(m)
# modular
for f in os.listdir(os.path.join(SRC,'backend')): shutil.copy(os.path.join(SRC,'backend',f),m)
for f in os.listdir(os.path.join(SRC,'frontend')): shutil.copy(os.path.join(SRC,'frontend',f),m)
# quick: single Code.gs
parts=[]
for o in ORDER:
    body=open(os.path.join(SRC,'backend',o+'.gs')).read()
    parts.append('// ' + '='*70 + '\n// FILE: '+o+'.gs\n// ' + '='*70 + '\n'+body.strip()+'\n')
open(os.path.join(q,'Code.gs'),'w').write('\n'.join(parts))
# quick: single Index.html with everything inlined
idx=open(os.path.join(SRC,'frontend','Index.html')).read()
idx=re.sub(r"<\?!= include\('([A-Za-z_]+)'\) \?>",lambda mo:open(os.path.join(SRC,'frontend',mo.group(1)+'.html')).read().strip(),idx)
assert "include(" not in idx
open(os.path.join(q,'Index.html'),'w').write(idx)
for d in (q,m): json.dump(MANIFEST,open(os.path.join(d,'appsscript.json'),'w'),indent=2)
print('quick:',{f:os.path.getsize(os.path.join(q,f)) for f in os.listdir(q)})
print('modular files:',len(os.listdir(m)))
