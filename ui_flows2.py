import re
from playwright.sync_api import sync_playwright
BASE='http://localhost:8765'
fails=[]; errs=[]
def check(c,msg):
    if not c: fails.append(msg); print('  FAIL',msg)
    else: print('  ok  ',msg)
def newpage(b,w=1366,h=850):
    ctx=b.new_context(viewport={'width':w,'height':h}, accept_downloads=True); p=ctx.new_page()
    p.route(re.compile(r'https://fonts\..*'), lambda r: r.abort())
    p.on('pageerror', lambda e: errs.append(str(e)))
    p.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'ERR_FAILED' not in m.text and 'fonts' not in m.text else None)
    return p
def login(p,u,pw):
    p.goto(BASE); p.wait_for_selector('#login-form'); p.fill('#lg-user',u); p.fill('#lg-pass',pw); p.click('#lg-btn'); p.wait_for_selector('.shell')
def go(p,r):
    p.evaluate(f"App.go('{r}')"); p.wait_for_function("!document.querySelector('#view .skeleton')",timeout=8000)
PDF=b'%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF'
with sync_playwright() as pw:
    b=pw.chromium.launch()
    p=newpage(b); login(p,'TEST-T1','Test@1234'); go(p,'assignments')
    p.click('#add-c'); p.wait_for_selector('#modal-form')
    p.select_option('#modal-form [name=batch]','8-TEST-MATH'); p.fill('#modal-form [name=title]','Algebra drill UI test')
    p.fill('#modal-form [name=dueDate]','2026-10-30')
    p.set_input_files('#f-file',{'name':'evil.exe','mimeType':'application/octet-stream','buffer':b'MZ'})
    p.locator('.modal button[type=submit]').click(); p.wait_for_selector('.form-error .alert')
    check('not allowed' in p.inner_text('.form-error').lower() or 'allowed file types' in p.inner_text('.form-error').lower(),'wrong file type rejected in UI: '+p.inner_text('.form-error').strip()[:60])
    p.set_input_files('#f-file',{'name':'drill.pdf','mimeType':'application/pdf','buffer':PDF})
    p.screenshot(path='/tmp/shots/flow2-assignment-modal.png')
    p.locator('.modal button[type=submit]').click(); p.wait_for_selector('.toast'); check('published' in p.inner_text('#toasts'),'assignment published')
    p.wait_for_timeout(800); check('Algebra drill UI test' in p.inner_text('#view'),'assignment listed for teacher')
    # results
    go(p,'results'); p.select_option('#rs-batch','8-TEST-MATH'); p.fill('#rs-exam','Quiz UI'); p.fill('#rs-max','20'); p.click('#rs-open')
    p.wait_for_selector('#rs-sheet input[type=number]'); ins=p.locator('#rs-sheet input[type=number]')
    ins.nth(0).fill('18'); ins.nth(1).fill('9.5'); p.screenshot(path='/tmp/shots/flow2-results-sheet.png')
    p.locator('#rs-sheet .btn:not(.secondary)').last.click(); p.wait_for_function("document.querySelector('#toasts').innerText.toLowerCase().includes('result')",timeout=8000); check('esult' in p.inner_text('#toasts'),'results saved: '+p.inner_text('#toasts').strip()[:60])
    p.wait_for_timeout(1500)
    ex=p.evaluate("App.api('results.exams',{batch:'8-TEST-MATH'})"); check(any(e['exam']=='Quiz UI' and e['students']==2 for e in ex['items']),'results really stored for 2 students')
    p.context.close()
    # student sees assignment + downloads
    p=newpage(b); login(p,'TEST-S001','Test@1234'); go(p,'assignments'); p.screenshot(path='/tmp/shots/flow2-student-assign.png')
    check('Algebra drill UI test' in p.inner_text('#view'),'student sees new assignment')
    p.wait_for_selector('#view [data-dl]',timeout=8000); card=p.locator('#view [data-dl]').first
    if card.count():
        with p.expect_download(timeout=8000) as dl: card.click()
        check(dl.value.suggested_filename=='drill.pdf' or dl.value.suggested_filename.endswith('.pdf'),'student downloads assignment PDF: '+dl.value.suggested_filename)
    else: check(False,'no download button found on assignments page')
    go(p,'notifications'); check('Algebra drill' in p.inner_text('#view'),'student got notification for assignment')
    go(p,'results'); p.screenshot(path='/tmp/shots/flow2-student-results.png')
    p.context.close()
    # admin: settings, batch, timetable
    p=newpage(b); login(p,'admin','Admin@12345'); go(p,'batches'); p.click('#add-batch'); p.wait_for_selector('#modal-form')
    p.screenshot(path='/tmp/shots/flow2-batch-modal.png')
    names=p.eval_on_selector_all('#modal-form [name]','e=>e.map(x=>x.name)'); print('  batch fields:',names)
    p.fill('#modal-form [name=batch]','9-UI-PHY'); p.select_option('#modal-form [name=class]','9'); p.fill('#modal-form [name=subject]','Physics'); p.select_option('#modal-form [name=teacher]', index=1)
    p.fill('#modal-form [name=schedule]','Mon-Fri 3 PM'); p.locator('.modal button[type=submit]').click(); p.wait_for_selector('.toast'); check('added' in p.inner_text('#toasts').lower() or 'saved' in p.inner_text('#toasts').lower(),'batch created via UI')
    go(p,'timetable'); p.screenshot(path='/tmp/shots/flow2-timetable.png'); check('Physics' in p.inner_text('#view'),'timetable shows new batch')
    go(p,'settings'); p.fill('[name=InstituteName]','Success Coaching Classes Amravati'); p.click('#set-save'); p.wait_for_function("document.querySelector('#toasts').innerText.includes('ettings')"); check('aved' in p.inner_text('#toasts'),'settings saved: '+p.inner_text('#toasts').strip()[:50])
    go(p,'notifications'); p.click('#send-n'); p.wait_for_selector('#modal-form'); p.screenshot(path='/tmp/shots/flow2-notify-modal.png')
    p.context.close(); b.close()
print('\nFAILS:',fails); print('JS ERRORS:',errs[:10])
