import sys, json, re
from playwright.sync_api import sync_playwright

BASE='http://localhost:8765'
errors=[]
def run_role(p, name, user, pw, width, height, shots=True):
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':width,'height':height})
    page=ctx.new_page()
    page.route(re.compile(r'https://fonts\.(googleapis|gstatic)\.com/.*'), lambda r: r.abort())
    page.on('pageerror', lambda e: errors.append((name,'pageerror',str(e))))
    page.on('console', lambda m: errors.append((name,'console',m.text)) if m.type=='error' and 'fonts' not in m.text and 'ERR_FAILED' not in m.text else None)
    page.goto(BASE); page.wait_for_selector('#login-form')
    if shots: page.screenshot(path=f'/tmp/shots/{name}-login.png')
    page.fill('#lg-user',user); page.fill('#lg-pass',pw); page.click('#lg-btn')
    page.wait_for_selector('.shell', timeout=15000)
    routes=page.eval_on_selector_all('.nav a[data-nav]','els=>els.map(e=>e.dataset.nav)')
    for r in routes:
        page.evaluate(f"App.go('{r}')")
        page.wait_for_timeout(700)
        # wait for skeleton to go
        try: page.wait_for_function("!document.querySelector('#view .skeleton')", timeout=8000)
        except Exception as e: errors.append((name,'stuck-skeleton',r))
        txt=page.inner_text('#view')
        if 'could not be' in txt.lower() or 'went wrong' in txt.lower(): errors.append((name,'error-text',r+': '+txt[:150].replace('\n',' ')))
        if shots: page.screenshot(path=f'/tmp/shots/{name}-{r}.png', full_page=False)
    b.close()
    return routes

import os; os.makedirs('/tmp/shots',exist_ok=True)
with sync_playwright() as p:
    print('admin', run_role(p,'admin-d','admin','Admin@12345',1366,850))
    print('teacher', run_role(p,'teacher-d','TEST-T1','Test@1234',1366,850))
    print('student', run_role(p,'student-d','TEST-S001','Test@1234',1366,850))
    print('student-m', run_role(p,'student-m','TEST-S001','Test@1234',390,800))
    print('admin-m', run_role(p,'admin-m','admin','Admin@12345',390,800))
print('ERRORS:',len(errors))
for e in errors[:40]: print(e)
