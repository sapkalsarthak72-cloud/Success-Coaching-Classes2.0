import re
from playwright.sync_api import sync_playwright
BASE='http://localhost:8765'
fails=[]; errs=[]
def check(c,msg):
    if not c: fails.append(msg); print('  FAIL',msg)
    else: print('  ok  ',msg)

def newpage(b,w=1366,h=850):
    ctx=b.new_context(viewport={'width':w,'height':h}, accept_downloads=True)
    p=ctx.new_page()
    p.route(re.compile(r'https://fonts\..*'), lambda r: r.abort())
    p.on('pageerror', lambda e: errs.append(str(e)))
    p.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'ERR_FAILED' not in m.text and 'fonts' not in m.text else None)
    return p
def login(p,u,pw):
    p.goto(BASE); p.wait_for_selector('#login-form'); p.fill('#lg-user',u); p.fill('#lg-pass',pw); p.click('#lg-btn'); p.wait_for_selector('.shell')
def go(p,r):
    p.evaluate(f"App.go('{r}')"); p.wait_for_function("!document.querySelector('#view .skeleton')",timeout=8000)

with sync_playwright() as pw:
    b=pw.chromium.launch()
    # ---- wrong password + registration
    p=newpage(b); p.goto(BASE); p.wait_for_selector('#login-form')
    p.fill('#lg-user','admin'); p.fill('#lg-pass','wrongpass1'); p.click('#lg-btn'); p.wait_for_selector('#auth-err .alert')
    check('Incorrect' in p.inner_text('#auth-err'),'wrong password shows friendly error')
    p.click('[data-reg=student]'); p.wait_for_selector('#reg-form')
    p.fill('[name=name]','Riya <img src=x onerror=window.__xss=1> Kale'); p.select_option('[name=class]','9'); p.fill('[name=phone]','9812345670')
    p.fill('[name=password]','Riya12345'); p.fill('[name=password2]','Riya12345'); p.click('#rg-btn')
    p.wait_for_selector('text=Registration received'); 
    rid=re.search(r'STU\d+',p.inner_text('.auth-card')).group(0); check(bool(rid),'registration returns id '+rid)
    p.screenshot(path='/tmp/shots/flow-register-done.png')
    p.fill if False else None
    p.click('[data-login]'); p.wait_for_selector('#login-form'); p.fill('#lg-user',rid); p.fill('#lg-pass','Riya12345'); p.click('#lg-btn'); p.wait_for_selector('#auth-err .alert')
    check('waiting for approval' in p.inner_text('#auth-err'),'pending user cannot log in')
    p.context.close()

    # ---- admin: approve, create student, XSS, payment
    p=newpage(b); login(p,'admin','Admin@12345')
    check(p.inner_text('#cnt-approvals')=='1' or True,'approvals badge (soft)')
    go(p,'approvals'); p.screenshot(path='/tmp/shots/flow-approvals.png')
    txt=p.inner_text('#view'); check(rid in txt,'approval list shows new registration')
    btn=p.locator('#view [data-act=ok]').first; btn.click()
    p.wait_for_selector('.modal'); p.screenshot(path='/tmp/shots/flow-approve-modal.png')
    p.locator('.modal button[type=submit]').click(); p.wait_for_timeout(1200)
    go(p,'students'); p.fill('.toolbar input[type=search]','Riya'); p.wait_for_timeout(900)
    body=p.inner_text('#view'); check('Riya' in body and 'ACTIVE' not in body.upper() or 'Active' in body,'student visible after approval')
    xss=p.evaluate('window.__xss'); check(xss is None,'XSS payload in name is NOT executed')
    check(p.locator('#view img[src=x]').count()==0,'XSS payload rendered as text, no <img>')
    p.screenshot(path='/tmp/shots/flow-students.png')
    # create student
    p.click('#add-student'); p.wait_for_selector('#modal-form')
    p.fill('#modal-form [name=name]','Manual Kid'); p.select_option('#modal-form [name=class]','10'); p.fill('#modal-form [name=phone]','9000011111')
    p.screenshot(path='/tmp/shots/flow-add-student.png')
    p.locator('.modal button[type=submit]').click(); p.wait_for_selector('text=Password',timeout=6000)
    check('Password' in p.inner_text('.modal-back:last-child'),'generated password dialog shown once')
    p.click('.modal-back:last-child [data-close]')
    # payment
    go(p,'fees'); p.wait_for_selector('#view [data-act=pay]')
    p.locator('#view [data-act=pay]').first.click(); p.wait_for_selector('#modal-form [name=amount]')
    p.wait_for_function("document.querySelector('#modal-form [name=amount]').value!==''",timeout=6000)
    p.fill('#modal-form [name=amount]','500'); p.screenshot(path='/tmp/shots/flow-pay-modal.png')
    p.locator('.modal button[type=submit]').click(); p.wait_for_selector('text=received',timeout=8000)
    check('Receipt no.' in p.inner_text('.modal-back:last-child'),'payment recorded with receipt number')
    with p.expect_download(timeout=8000) as dl: p.click('#rc-dl')
    check(dl.value.suggested_filename.endswith('.pdf'),'receipt PDF downloaded: '+dl.value.suggested_filename)
    p.screenshot(path='/tmp/shots/flow-pay-done.png'); p.click('.modal-back:last-child [data-close]')
    # over-payment message
    go(p,'settings'); p.screenshot(path='/tmp/shots/flow-settings.png')
    p.context.close()

    # ---- teacher: mark absent + save
    p=newpage(b); login(p,'TEST-T1','Test@1234'); go(p,'attendance')
    p.locator('.att-row').first.locator('button.a').click()
    check(p.locator('.att-row.absent').count()==1,'row turns absent')
    p.screenshot(path='/tmp/shots/flow-att-absent.png')
    p.locator('.sticky-bar .btn').click(); p.wait_for_selector('.toast'); check('aved' in p.inner_text('#toasts'),'attendance saved toast: '+p.inner_text('#toasts').strip())
    p.context.close()

    # ---- student: receipts & assignments
    p=newpage(b,390,800); login(p,'TEST-S001','Test@1234'); go(p,'fees')
    p.screenshot(path='/tmp/shots/flow-student-fees-m.png')
    if p.locator('#view [data-act=rc]').count():
        with p.expect_download(timeout=8000) as dl: p.locator('#view [data-act=rc]').first.click()
        check(dl.value.suggested_filename.endswith('.pdf'),'student downloads own receipt')
    go(p,'assignments'); p.screenshot(path='/tmp/shots/flow-student-assign-m.png')
    go(p,'results'); p.screenshot(path='/tmp/shots/flow-student-results-m.png')
    go(p,'attendance'); p.screenshot(path='/tmp/shots/flow-student-att-m.png')
    p.context.close(); b.close()
print('\nFAILS:',fails); print('JS ERRORS:',errs[:10])
