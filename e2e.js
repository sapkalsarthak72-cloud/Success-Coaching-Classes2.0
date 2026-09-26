// E2E: runs the REAL built Index.html in headless Chromium; google.script.run is bridged to the Node-hosted backend mock.
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const { loadPortal } = require('./mock-gas');

const ctx = loadPortal(path.join(__dirname, '..', 'src', 'backend'));
const run = (c) => vm.runInContext(c, ctx);
const shots = path.join(__dirname, 'shots'); fs.mkdirSync(shots, { recursive: true });

const setup = run('setupPortal()');
const adminPw = /Password: (\S+)/.exec(setup)[1];
run('loadTestData()');
// A registration that is still pending, for the approvals screen.
ctx.api('auth.registerStudent', null, { name: 'Pending Pooja', class: '9', phone: '9111111111', password: 'Pending123' });
ctx.api('auth.registerTeacher', null, { name: 'Pending Teacher', subject: 'Chemistry', phone: '9222222222', password: 'Pending123' });

const html = fs.readFileSync(path.join(__dirname, '..', 'dist', 'quick-install', 'Index.html'), 'utf8').replace('<?= appTitle ?>', 'Success Coaching Classes');

let pass = 0, fail = 0, pageRef = null;
const dueStudent = run('Db.first("Fees", f => f.Remaining > 0 && f.StudentID.indexOf("TEST-") === 0).StudentID');
const errors = [];
async function step(name, fn) {
  try { await fn(); pass++; console.log('  ok  ', name); }
  catch (e) { fail++; console.log('  FAIL', name, '\n      ', String(e.message).split('\n')[0]); try { await pageRef.evaluate(() => document.querySelectorAll('.modal-back').forEach((x) => x.remove())); } catch (x) { /* ignore */ } }
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1360, height: 860 }, acceptDownloads: true });
  await context.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const page = await context.newPage(); pageRef = page;
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|fonts\./.test(m.text())) errors.push('console: ' + m.text()); });
  await page.exposeFunction('__api', (a, t, p) => JSON.parse(JSON.stringify(ctx.api(a, t, p))));
  await page.addInitScript(() => {
    function make(s, f) {
      return {
        withSuccessHandler: (fn) => make(fn, f), withFailureHandler: (fn) => make(s, fn),
        api: (a, t, p) => { window.__api(a, t, JSON.parse(JSON.stringify(p === undefined ? {} : p))).then((r) => s && s(r), (e) => f && f(e)); }
      };
    }
    window.google = { script: { run: make(null, null) } };
  });
  await page.route('http://portal.test/', (r) => r.fulfill({ contentType: 'text/html', body: html }));
  const shot = (n) => page.screenshot({ path: path.join(shots, n + '.png') });
  const toast = async (re) => { await page.locator('#toasts .toast', { hasText: re }).first().waitFor({ timeout: 6000 }); };
  const noBrokenPage = async () => {
    await page.waitForTimeout(150);
    const txt = await page.locator('#view').innerText();
    if (/could not be loaded|Could not load/i.test(txt)) throw new Error('page shows an error: ' + txt.slice(0, 160));
  };
  const login = async (u, p) => {
    await page.fill('#lg-user', u); await page.fill('#lg-pass', p); await page.click('#lg-btn');
    await page.locator('#page-title').waitFor({ timeout: 8000 });
  };
  const logout = async () => { await page.click('#user-chip'); await page.click('[data-menu=out]'); await page.locator('#login-form').waitFor(); };
  const navTo = async (route) => { await page.locator('.sidebar [data-nav="' + route + '"]').click(); await page.waitForTimeout(200); await page.locator('#view .skeleton').first().waitFor({ state: 'detached', timeout: 8000 }).catch(() => {}); };
  const overflowX = async () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

  await page.goto('http://portal.test/');

  console.log('== login screen');
  await step('login page renders with institute name', async () => {
    await page.locator('#login-form').waitFor();
    if (!(await page.locator('.auth-hero h1').innerText()).includes('SUCCESS COACHING')) throw new Error('hero title');
    await shot('01-login');
  });
  await step('wrong password shows friendly error', async () => {
    await page.fill('#lg-user', 'admin'); await page.fill('#lg-pass', 'nope-nope1'); await page.click('#lg-btn');
    await page.locator('#auth-err .alert.error').waitFor(); await page.fill('#lg-pass', '');
  });

  console.log('== admin');
  await step('admin logs in and sees dashboard', async () => {
    await login('admin', adminPw);
    await page.locator('.stat', { hasText: 'Active students' }).waitFor();
    await shot('02-admin-dashboard');
  });
  await step('every admin page loads without errors', async () => {
    const routes = await page.$$eval('.sidebar [data-nav]', (els) => els.map((e) => e.dataset.nav));
    if (routes.length < 14) throw new Error('nav items: ' + routes.length);
    for (const r of routes) { await navTo(r); await noBrokenPage(); await shot('admin-' + r); }
  });
  await step('pending approvals visible and approve works', async () => {
    await navTo('approvals');
    await page.locator('#view', { hasText: 'Pending Pooja' }).waitFor();
    await page.locator('#view tr', { hasText: 'Pending Teacher' }).locator('[data-act=ok]').click();
    await toast(/Teacher approved/);
    await page.locator('#view tr', { hasText: 'Pending Pooja' }).locator('[data-act=ok]').click();
    await page.locator('.modal').waitFor(); await page.click('.modal button[type=submit]'); await toast(/Student approved/);
  });
  await step('add student flow shows generated password', async () => {
    await navTo('students');
    await page.click('#add-student');
    await page.fill('.modal [name=name]', 'Ravi Playwright'); await page.selectOption('.modal [name=class]', '10'); await page.fill('.modal [name=phone]', '9876500001');
    await page.locator('.modal .check').first().click();
    await page.click('.modal button[type=submit]');
    await page.locator('.modal', { hasText: 'Password' }).waitFor(); await shot('03-student-created');
    await page.click('.modal [data-close]');
    await page.fill('.toolbar input[type=search]', 'Playwright'); await page.locator('#view tr', { hasText: 'Ravi Playwright' }).waitFor();
  });
  await step('batch creation validates and saves', async () => {
    await navTo('batches'); await page.click('#add-batch');
    await page.fill('.modal [name=batch]', '9-PW-CHEM'); await page.selectOption('.modal [name=class]', '9'); await page.fill('.modal [name=subject]', 'Chemistry');
    await page.selectOption('.modal [name=teacher]', { index: 1 }); await page.fill('.modal [name=schedule]', 'nonsense');
    await page.click('.modal button[type=submit]'); await page.locator('.modal .alert.error').waitFor();
    await page.fill('.modal [name=schedule]', 'Mon/Thu 3 PM'); await page.click('.modal button[type=submit]'); await toast(/Batch added/);
  });
  await step('admin takes attendance for a batch', async () => {
    await navTo('attendance');
    await page.locator('.att-row').first().waitFor();
    await page.locator('.att-row').first().locator('[data-set=ABSENT]').click();
    await page.locator('.att-row').first().locator('[data-remark]').fill('Fever');
    await shot('04-attendance-sheet');
    await page.click('#save-att'); await toast(/Attendance saved/);
    await page.click('[data-tab=report]'); await page.locator('#rep table').waitFor(); await shot('05-attendance-report');
    await page.click('[data-tab=overview]'); await page.locator('#ov table').waitFor();
  });
  await step('record a payment through the dialog and download receipt', async () => {
    await navTo('fees'); await page.click('#rec-pay');
    await page.fill('#pay-pick input', dueStudent); await page.locator('.picker-list button').first().click();
    await page.locator('.modal select[name=feeType] option', { hasText: 'Course Fee' }).first().waitFor({ state: 'attached' });
    await page.selectOption('.modal select[name=feeType]', { index: 1 });
    await page.fill('.modal [name=amount]', '1000'); await page.selectOption('.modal [name=paymentMode]', 'UPI');
    await page.click('.modal button[type=submit]');
    await page.locator('.modal', { hasText: 'Payment recorded' }).waitFor(); await shot('06-payment-recorded');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#rc-dl')]);
    if (!/Receipt_.*\.pdf/.test(dl.suggestedFilename())) throw new Error('bad filename ' + dl.suggestedFilename());
    await page.click('.modal [data-close]');
  });
  await step('assign fees to a class and view student fee dialog', async () => {
    await page.click('#asg-fee'); await page.selectOption('.modal [name=ttype]', 'CLASS');
    await page.selectOption('.modal [name=tval]', '9'); await page.fill('.modal [name=feeType]', 'Exam Fee'); await page.fill('.modal [name=totalFee]', '500');
    await page.click('.modal button[type=submit]'); await toast(/fee records? created/);
    await page.fill('#dl input[type=search]', dueStudent); await page.locator('#dl tbody tr').first().waitFor();
    await page.locator('#dl tbody tr').first().locator('[data-act=open]').click();
    await page.locator('.modal', { hasText: 'Payment history' }).waitFor(); await shot('07-student-fees'); await page.click('.modal [data-close]');
  });
  await step('settings save works', async () => {
    await navTo('settings'); await page.fill('[name=Phone]', '+91 99999 11111'); await page.click('#set-save'); await toast(/Settings saved/);
  });
  await step('admin can send a notification', async () => {
    await navTo('notifications'); await page.click('#send-n');
    await page.selectOption('.modal [name=target]', 'CLASS_10'); await page.fill('.modal [name=title]', 'Holiday tomorrow'); await page.fill('.modal [name=message]', 'No class tomorrow');
    await page.click('.modal button[type=submit]'); await toast(/Notification sent/);
  });
  await step('no horizontal overflow on desktop', async () => { if ((await overflowX()) > 1) throw new Error('overflow ' + (await overflowX())); });
  await logout();

  console.log('== teacher');
  await step('teacher logs in; sees only teacher navigation', async () => {
    await login('TEST-T1', 'Test@1234');
    const routes = await page.$$eval('.sidebar [data-nav]', (els) => els.map((e) => e.dataset.nav));
    if (routes.includes('fees') || routes.includes('settings') || routes.includes('teachers')) throw new Error('teacher sees admin routes: ' + routes);
    await shot('08-teacher-dashboard');
  });
  await step('every teacher page loads', async () => {
    const routes = await page.$$eval('.sidebar [data-nav]', (els) => els.map((e) => e.dataset.nav));
    for (const r of routes) { await navTo(r); await noBrokenPage(); }
  });
  await step('teacher creates an assignment with a PDF', async () => {
    await navTo('assignments'); await page.click('#add-c');
    await page.selectOption('.modal [name=batch]', { index: 1 }); await page.fill('.modal [name=title]', 'Playwright worksheet');
    const due = new Date(Date.now() + 5 * 864e5).toISOString().substr(0, 10); await page.fill('.modal [name=dueDate]', due);
    fs.writeFileSync('/tmp/ws.pdf', '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
    await page.setInputFiles('#f-file', '/tmp/ws.pdf'); await page.click('.modal button[type=submit]'); await toast(/published/);
    await page.locator('#view tr', { hasText: 'Playwright worksheet' }).waitFor();
  });
  await step('teacher rejects a non-PDF assignment file', async () => {
    await page.click('#add-c'); await page.selectOption('.modal [name=batch]', { index: 1 }); await page.fill('.modal [name=title]', 'Bad file');
    await page.fill('.modal [name=dueDate]', new Date(Date.now() + 864e5).toISOString().substr(0, 10));
    fs.writeFileSync('/tmp/bad.exe', 'MZ'); await page.setInputFiles('#f-file', '/tmp/bad.exe'); await page.click('.modal button[type=submit]');
    await page.locator('.modal .alert.error').waitFor(); await page.click('.modal [data-close]');
  });
  await step('teacher enters exam marks with live grade', async () => {
    await navTo('results'); await page.fill('#rs-exam', 'Playwright Test'); await page.fill('#rs-max', '20'); await page.click('#rs-open');
    await page.locator('.att-row [data-marks]').first().waitFor();
    await page.locator('.att-row [data-marks]').first().fill('18');
    await page.locator('.att-row [data-calc]', { hasText: 'A+' }).first().waitFor();
    await page.click('#rs-save'); await toast(/Results saved/); await shot('09-results-entry');
  });
  await step('teacher takes attendance from dashboard shortcut', async () => {
    await navTo('dashboard'); await page.locator('#view [data-go=attendance]').first().click();
    await page.locator('.att-row').first().waitFor(); await page.click('#save-att'); await toast(/Attendance saved/);
  });
  await logout();

  console.log('== student');
  await step('student logs in and sees only student pages', async () => {
    await login('TEST-S001', 'Test@1234');
    const routes = await page.$$eval('.sidebar [data-nav]', (els) => els.map((e) => e.dataset.nav));
    if (routes.includes('students') || routes.includes('settings') || routes.includes('approvals')) throw new Error('student sees staff routes: ' + routes);
    await page.locator('.donut').waitFor(); await shot('10-student-dashboard');
  });
  await step('every student page loads', async () => {
    const routes = await page.$$eval('.sidebar [data-nav]', (els) => els.map((e) => e.dataset.nav));
    for (const r of routes) { await navTo(r); await noBrokenPage(); await shot('student-' + r); }
  });
  await step('student downloads an assignment file and a receipt', async () => {
    await navTo('assignments');
    const btn = page.locator('[data-dl]').first();
    if (await btn.count()) { const [dl] = await Promise.all([page.waitForEvent('download'), btn.click()]); if (!dl.suggestedFilename().endsWith('.pdf')) throw new Error('assignment name'); }
    await navTo('fees'); const [d2] = await Promise.all([page.waitForEvent('download'), page.locator('#mf [data-act=rc]').first().click()]);
    if (!/Receipt_.*\.pdf/.test(d2.suggestedFilename())) throw new Error('receipt name');
  });
  await step('student notifications: unread badge, mark all read', async () => {
    await navTo('notifications'); await page.locator('#nl .list-item').first().waitFor();
    await page.click('#read-all'); await toast(/marked as read/);
    if (!(await page.locator('#bell-dot').evaluate((e) => e.classList.contains('hidden')))) throw new Error('badge still visible');
  });
  await step('student can change password', async () => {
    await page.click('#user-chip'); await page.click('[data-menu=pw]');
    await page.fill('.modal [name=oldPassword]', 'Test@1234'); await page.fill('.modal [name=newPassword]', 'Changed@5678'); await page.fill('.modal [name=confirm]', 'Changed@5678');
    await page.click('.modal button[type=submit]'); await toast(/Password changed/);
  });
  await logout();

  console.log('== registration + mobile');
  await step('student self-registration shows ID and pending message', async () => {
    await page.click('[data-reg=student]');
    await page.fill('#reg-form [name=name]', 'Mobile Mehul'); await page.selectOption('#reg-form [name=class]', '8'); await page.fill('#reg-form [name=phone]', '9333333333');
    await page.fill('#reg-form [name=password]', 'Mobile1234'); await page.fill('#reg-form [name=password2]', 'Mobile1234'); await page.click('#rg-btn');
    await page.locator('.auth-card', { hasText: 'Registration received' }).waitFor(); await shot('11-registered');
    await page.click('[data-login]');
  });
  await step('pending user cannot sign in', async () => {
    await page.fill('#lg-user', 'STU0001'); await page.fill('#lg-pass', 'Mobile1234'); await page.click('#lg-btn');
    await page.locator('#auth-err .alert.error').waitFor();
  });
  await step('mobile layout: bottom nav, no horizontal overflow on key pages', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login('TEST-S002', 'Test@1234');
    await page.locator('.bottom-nav').waitFor(); await shot('12-mobile-dashboard');
    for (const r of ['attendance', 'fees', 'results', 'timetable']) {
      await page.locator('.bottom-nav [data-nav="' + r + '"], .sidebar [data-nav="' + r + '"]').last().evaluate((e) => e.click()); await page.waitForTimeout(400);
      const o = await overflowX(); if (o > 2) throw new Error(r + ' overflows by ' + o + 'px');
    }
    await shot('13-mobile-fees');
    await logout();
    await login('TEST-T2', 'Test@1234'); await page.locator('.bottom-nav [data-nav=attendance]').click(); await page.locator('.att-row').first().waitFor(); await shot('14-mobile-attendance');
    if ((await overflowX()) > 2) throw new Error('mobile attendance overflow');
  });

  console.log('\nJS errors captured in browser: ' + errors.length); errors.slice(0, 10).forEach((e) => console.log('   ', e));
  console.log('RESULT: ' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail || errors.length ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
