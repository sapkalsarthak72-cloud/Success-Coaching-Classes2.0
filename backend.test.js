const { loadPortal } = require('./mock-gas');
const path = require('path');
const ctx = loadPortal(path.join(__dirname, '..', 'src', 'backend'));
const vm = require('vm');
const run = (code) => vm.runInContext(code, ctx);

let pass = 0, fail = 0;
function ok(cond, name, extra) { if (cond) { pass++; } else { fail++; console.log('  FAIL:', name, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ''); } }
function call(action, token, payload) { return ctx.api(action, token, payload || {}); }
function must(action, token, payload) { const r = call(action, token, payload); if (!r.ok) { fail++; console.log('  FAIL (expected ok):', action, r.error, r.code); return null; } pass++; return r.data; }
function denied(action, token, payload, code, name) { const r = call(action, token, payload); ok(!r.ok && (!code || r.code === code), (name || action) + ' should be rejected' + (code ? ' with ' + code : ''), r); return r; }

console.log('== setup');
const msg = run('setupPortal()');
ok(/Admin account created/.test(msg), 'setup creates admin', msg);
const adminPw = /Password: (\S+)/.exec(msg)[1];
ok(ctx._store.ss.getSheets().length === 13, '13 sheets created', ctx._store.ss.getSheets().map(s => s.name));
ok(!!run('PropertiesService').getScriptProperties().getProperty('FOLDER_RECEIPTS'), 'drive folders created');
run('setupPortal()'); // idempotent
ok(run('Db.count("Settings")') === 11, 'settings not duplicated');

console.log('== auth');
denied('auth.login', null, { username: 'admin', password: 'wrong' }, 'LOGIN', 'wrong pw');
const adm = must('auth.login', null, { username: 'ADMIN', password: adminPw });
const A = adm.token;
ok(adm.user.role === 'ADMIN', 'admin role');
denied('students.list', null, {}, 'AUTH', 'no token');
denied('students.list', 'x'.repeat(64), {}, 'AUTH', 'bad token');
for (let i = 0; i < 5; i++) call('auth.login', null, { username: 'lockme', password: 'x' });
denied('auth.login', null, { username: 'lockme', password: 'x' }, 'LOCKED', 'lockout');

console.log('== teachers / batches / registration');
const t1 = must('teachers.create', A, { name: 'Ravi Kumar', subject: 'Mathematics', phone: '9876543210', password: 'Teach1234' });
ok(t1.teacherId === 'TCH001', 'teacher id', t1);
const t2 = must('teachers.create', A, { name: 'Sita Rao', subject: 'Science', phone: '9876543211' });
ok(!!t2.password, 'generated password returned');
denied('teachers.create', A, { name: 'X', subject: 'Y', phone: '123' }, 'VALIDATION', 'bad phone');
must('batches.create', A, { batch: '10-a-math', class: '10', subject: 'Mathematics', teacher: 'TCH001', schedule: 'Mon/Wed/Fri 5 PM' });
must('batches.create', A, { batch: '10-A-SCI', class: '10', subject: 'Science', teacher: 'TCH002', schedule: 'Tue-Thu 4:30 PM - 6 PM' });
denied('batches.create', A, { batch: '10-A-MATH', class: '10', subject: 'x', teacher: 'TCH001', schedule: 'Mon 5 PM' }, 'CONFLICT', 'dup batch');
denied('batches.create', A, { batch: '9-A', class: '10', subject: 'x', teacher: 'TCH001', schedule: 'Mon 5 PM' }, 'VALIDATION', 'batch not starting with class');
denied('batches.create', A, { batch: '7-A', class: '7', subject: 'x', teacher: 'TCH001', schedule: 'Mon 5 PM' }, 'VALIDATION', 'class 7 not allowed');
denied('batches.create', A, { batch: '10-B', class: '10', subject: 'x', teacher: 'TCH001', schedule: 'sometime' }, 'VALIDATION', 'bad schedule');

const reg = must('auth.registerStudent', null, { name: 'Aarav Sharma', class: '10', phone: '9123456780', password: 'Student123' });
ok(reg.id === 'STU0001' && reg.status === 'PENDING', 'student registered pending', reg);
denied('auth.login', null, { username: 'STU0001', password: 'Student123' }, 'PENDING', 'pending login blocked');
denied('auth.registerStudent', null, { name: 'Aarav Sharma', class: '10', phone: '9123456780', password: 'Student123' }, 'CONFLICT', 'duplicate registration');
denied('auth.registerStudent', null, { name: 'Bad Class', class: '12', phone: '9123456781', password: 'Student123' }, 'VALIDATION', 'class 12');
denied('auth.registerStudent', null, { name: 'Weak Pw', class: '9', phone: '9123456782', password: 'short' }, 'VALIDATION', 'weak password');
const reg2 = must('auth.registerStudent', null, { name: 'Diya Patil', class: '10', phone: '9123456783', password: 'Student123' });
const rt = must('auth.registerTeacher', null, { name: 'New Teacher', subject: 'English', phone: '9000000001', password: 'Teacher123' });
const pend = must('users.pending', A);
ok(pend.students.length === 2 && pend.teachers.length === 1, 'pending list', pend);
must('users.approve', A, { userId: pend.students[0].userId, batches: ['10-A-MATH', '10-A-SCI'] });
must('users.approve', A, { userId: pend.students[1].userId, batches: ['10-a-math'] });
denied('users.approve', A, { userId: pend.students[0].userId }, 'VALIDATION', 'double approve');
must('users.reject', A, { userId: pend.teachers[0].userId });
denied('auth.login', null, { username: rt.id, password: 'Teacher123' }, 'INACTIVE', 'rejected teacher');
denied('users.approve', A, { userId: pend.students[0].userId, batches: ['9-X'] }, null, 'bad batch');

const S1 = must('auth.login', null, { username: 'stu0001', password: 'Student123' }).token;
const S2 = must('auth.login', null, { username: 'STU0002', password: 'Student123' }).token;
const T1 = must('auth.login', null, { username: 'TCH001', password: 'Teach1234' }).token;
const T2 = must('auth.login', null, { username: 'TCH002', password: t2.password }).token;

console.log('== permissions');
denied('teachers.list', T1, {}, 'FORBIDDEN', 'teacher lists teachers');
denied('teachers.list', S1, {}, 'FORBIDDEN', 'student lists teachers');
denied('students.list', S1, {}, 'FORBIDDEN', 'student lists students');
denied('fees.assign', T1, {}, 'FORBIDDEN', 'teacher assigns fee');
denied('payments.record', T1, {}, 'FORBIDDEN', 'teacher records payment');
denied('payments.list', S1, {}, 'FORBIDDEN', 'student payments list');
denied('fees.student', S1, { studentId: 'STU0002' }, 'FORBIDDEN', 'student reads other fees');
denied('settings.save', T1, {}, 'FORBIDDEN', 'teacher settings');
denied('users.setStatus', T1, {}, 'FORBIDDEN', 'teacher user admin');
denied('attendance.save', S1, { batch: '10-A-MATH', date: ctx.U.today(), records: [] }, 'FORBIDDEN', 'student marks attendance');
denied('attendance.sheet', T2, { batch: '10-A-MATH', date: ctx.U.today() }, 'FORBIDDEN', 'teacher2 opens teacher1 batch');
denied('attendance.save', T2, { batch: '10-A-MATH', date: ctx.U.today(), records: [] }, 'FORBIDDEN', 'teacher2 saves teacher1 batch');
denied('results.save', T2, { batch: '10-A-MATH', exam: 'X', maxMarks: 10, entries: [] }, 'FORBIDDEN', 'teacher2 results');
denied('assignments.save', T2, { batch: '10-A-MATH', title: 'Sneaky', dueDate: ctx.U.today() }, 'FORBIDDEN', 'teacher2 assignment');
denied('students.get', T2, { studentId: 'STU0002' }, 'FORBIDDEN', 'teacher2 reads student outside batches');
ok(must('students.get', T1, { studentId: 'STU0002' }).studentId === 'STU0002', 'teacher1 reads own student');
ok(must('students.list', T2, {}).total === 1, 'teacher2 sees only own batch students (STU0001 in SCI)');
ok(must('students.list', T1, {}).total === 2, 'teacher1 sees 2 students');
denied('batches.roster', S1, { batch: '10-A-MATH' }, 'FORBIDDEN', 'student roster');

console.log('== attendance');
const today = ctx.U.today();
const sheet = must('attendance.sheet', T1, { batch: '10-A-MATH', date: today });
ok(sheet.students.length === 2 && sheet.students.every(s => s.status === 'PRESENT'), 'default present', sheet);
must('attendance.save', T1, { batch: '10-A-MATH', date: today, records: [{ studentId: 'STU0001', status: 'ABSENT', remark: 'Fever | =x' }, { studentId: 'STU0002', status: 'PRESENT' }] });
const sheet2 = must('attendance.sheet', T1, { batch: '10-A-MATH', date: today });
ok(sheet2.exists && sheet2.students.find(s => s.studentId === 'STU0001').status === 'ABSENT', 'saved absent', sheet2);
ok(sheet2.students.find(s => s.studentId === 'STU0001').remark.indexOf('|') < 0, 'remark sanitised');
must('attendance.save', T1, { batch: '10-A-MATH', date: today, records: [{ studentId: 'STU0001', status: 'PRESENT' }] }); // update in place
ok(run('Db.count("Attendance")') === 1, 'upsert keeps 1 row');
denied('attendance.save', T1, { batch: '10-A-MATH', date: ctx.U.addDays(today, 1), records: [] }, 'VALIDATION', 'future date');
denied('attendance.save', T1, { batch: '10-A-MATH', date: ctx.U.addDays(today, -40), records: [] }, 'VALIDATION', 'too old for teacher');
must('attendance.save', A, { batch: '10-A-MATH', date: ctx.U.addDays(today, -40), records: [{ studentId: 'STU0001', status: 'ABSENT' }] });
denied('attendance.save', T1, { batch: '10-A-MATH', date: today, records: [{ studentId: 'STU9999', status: 'PRESENT' }] }, 'VALIDATION', 'foreign student');
denied('attendance.save', T1, { batch: '10-A-MATH', date: today, records: [{ studentId: 'STU0001', status: 'LATE' }] }, 'VALIDATION', 'bad status');
const my = must('attendance.my', S1, {});
ok(my.overall.total === 2 && my.overall.present === 1 && my.overall.percent === 50, 'student attendance %', my.overall);
ok(must('attendance.report', T1, { batch: '10-A-MATH', from: ctx.U.addDays(today, -60), to: today }).students.length === 2, 'report');
ok(must('attendance.overview', A, { date: today }).totals.marked === 1, 'overview');

console.log('== content (assignments/materials/events)');
const pdf = Buffer.from('%PDF-1.4 hello world test').toString('base64');
denied('assignments.save', T1, { batch: '10-A-MATH', title: 'HW 1', dueDate: today, file: { name: 'evil.exe', data: pdf } }, 'VALIDATION', 'bad ext');
denied('assignments.save', T1, { batch: '10-A-MATH', title: 'HW 1', dueDate: today, file: { name: 'fake.pdf', data: Buffer.from('not a pdf').toString('base64') } }, 'VALIDATION', 'bad signature');
denied('assignments.save', T1, { batch: '10-A-MATH', title: 'HW 1', issueDate: today, dueDate: ctx.U.addDays(today, -1) }, 'VALIDATION', 'due before issue');
const asg = must('assignments.save', T1, { batch: '10-A-MATH', title: 'Algebra worksheet', description: 'Do all', dueDate: ctx.U.addDays(today, 3), file: { name: 'ws.pdf', data: pdf } });
ok(asg.assignmentId === 'ASG0001', 'assignment id', asg);
const sl = must('assignments.list', S1, {});
ok(sl.total === 1 && sl.items[0].hasFile, 'student sees assignment', sl);
ok(must('assignments.list', S2, {}).total === 1, 'student2 (math only) sees it');
ok(must('assignments.list', T2, {}).total === 0, 'teacher2 does not see it');
const dl = must('assignments.file', S1, { assignmentId: 'ASG0001' });
ok(dl.name === 'ws.pdf' && Buffer.from(dl.data, 'base64').toString().startsWith('%PDF'), 'download works', dl.name);
denied('assignments.file', T2, { assignmentId: 'ASG0001' }, 'FORBIDDEN', 'teacher2 downloads');
must('assignments.setStatus', T1, { assignmentId: 'ASG0001', status: 'ARCHIVED' });
ok(must('assignments.list', S1, {}).total === 0, 'archived hidden from student');
denied('assignments.file', S1, { assignmentId: 'ASG0001' }, 'FORBIDDEN', 'archived download');
must('materials.save', T1, { batch: '10-A-MATH', title: 'Formulas', file: { name: 'f.pdf', data: pdf } });
denied('materials.save', T1, { batch: '10-A-MATH', title: 'No file' }, 'VALIDATION', 'material needs file');
ok(must('materials.list', S1, {}).total === 1, 'student sees material');
denied('events.save', T1, { title: 'Holiday', eventType: 'Holiday', date: today, target: 'ALL' }, 'FORBIDDEN', 'teacher event to ALL');
denied('events.save', T2, { title: 'Test', eventType: 'Test', date: today, target: '10-A-MATH' }, 'FORBIDDEN', 'teacher2 event other batch');
must('events.save', T1, { title: 'Unit Test', eventType: 'Test', date: ctx.U.addDays(today, 2), target: '10-A-MATH' });
must('events.save', A, { title: 'Diwali Holiday', eventType: 'Holiday', date: ctx.U.addDays(today, 5), target: 'ALL' });
ok(must('events.list', S2, {}).total === 2, 'student2 sees 2 events');
ok(must('events.list', T2, {}).total === 1, 'teacher2 sees only ALL event');

console.log('== notifications');
function sleep(ms){ const e=Date.now()+ms; while(Date.now()<e){} }
const n1 = must('notifications.list', S2, {});
ok(n1.unread >= 3, 'student2 has unread (assignment, material, event...)', n1.unread);
sleep(5); must('notifications.markRead', S2, {}); sleep(5);
ok(must('notifications.list', S2, {}).unread === 0, 'mark read');
sleep(5);
must('notifications.create', A, { title: 'Class 10 notice', message: 'Bring ID cards', target: 'CLASS_10' });
must('notifications.create', A, { title: 'Personal', message: 'Meet principal', target: 'STU0001' });
ok(must('notifications.list', S2, {}).unread === 1, 'student2 gets class notice but not personal');
ok(must('notifications.list', S1, {}).items.some(n => n.title === 'Personal'), 'student1 gets personal');
denied('notifications.create', T1, { title: 'x', message: 'y', target: 'ALL' }, 'FORBIDDEN', 'teacher sends notification');

console.log('== results');
denied('results.save', T1, { batch: '10-A-MATH', exam: 'Unit Test 1', maxMarks: 20, entries: [{ studentId: 'STU0001', marks: 25 }] }, 'VALIDATION', 'marks > max');
denied('results.save', T1, { batch: '10-A-MATH', exam: 'Unit Test 1', maxMarks: 20, entries: [{ studentId: 'STU0001', marks: 'abc' }] }, 'VALIDATION', 'marks nan');
must('results.save', T1, { batch: '10-A-MATH', exam: 'Unit Test 1', maxMarks: 20, entries: [{ studentId: 'STU0001', marks: 18 }, { studentId: 'STU0002', marks: 9.5, remarks: 'Improve' }] });
must('results.save', T1, { batch: '10-A-MATH', exam: 'Unit Test 1', maxMarks: 20, entries: [{ studentId: 'STU0002', marks: 10 }] }); // update
ok(run('Db.count("Results")') === 2, 'results upsert');
const rs = must('results.my', S1, {});
ok(rs.items.length === 1 && rs.items[0].percentage === 90 && rs.items[0].grade === 'A+', 'student result calc', rs.items[0]);
denied('results.save', T1, { batch: '10-A-MATH', exam: 'Unit Test 1', maxMarks: 5, entries: [] }, 'VALIDATION', 'lowering max below existing marks');
ok(must('results.list', A, {}).total === 2, 'admin results list');

console.log('== fees & payments');
const fa = must('fees.assign', A, { target: { type: 'CLASS', value: '10' }, feeType: 'Course Fee 2026-27', totalFee: 30000, discount: 5000, dueDate: ctx.U.addDays(today, 30) });
ok(fa.created === 2, 'fee assigned to class', fa);
const fa2 = must('fees.assign', A, { target: { type: 'CLASS', value: '10' }, feeType: 'course fee 2026-27', totalFee: 30000 });
ok(fa2.created === 0 && fa2.skipped === 2, 'duplicate fee skipped', fa2);
denied('fees.assign', A, { target: { type: 'CLASS', value: '10' }, feeType: 'Bad', totalFee: 100, discount: 200 }, 'VALIDATION', 'discount > total');
let fs = must('fees.student', A, { studentId: 'STU0001' });
ok(fs.fees[0].finalFee === 25000 && fs.fees[0].remaining === 25000, 'final fee = total - discount', fs.fees[0]);
const pay1 = must('payments.record', A, { studentId: 'STU0001', feeType: 'Course Fee 2026-27', amount: 10000, paymentMode: 'UPI', date: today });
ok(/^SCC-2627-000001$/.test(pay1.receiptNumber) && pay1.receiptReady && pay1.remaining === 15000, 'payment 1', pay1);
const pay2 = must('payments.record', A, { studentId: 'STU0001', feeType: 'Course Fee 2026-27', amount: 5000, paymentMode: 'CASH' });
ok(pay2.receiptNumber === 'SCC-2627-000002' && pay2.remaining === 10000, 'payment 2 (unique receipt)', pay2);
denied('payments.record', A, { studentId: 'STU0001', feeType: 'Course Fee 2026-27', amount: 10001, paymentMode: 'CASH' }, 'VALIDATION', 'overpayment');
denied('payments.record', A, { studentId: 'STU0001', feeType: 'Course Fee 2026-27', amount: -5, paymentMode: 'CASH' }, 'VALIDATION', 'negative');
denied('payments.record', A, { studentId: 'STU0001', feeType: 'Course Fee 2026-27', amount: 100, paymentMode: 'BITCOIN' }, 'VALIDATION', 'bad mode');
denied('payments.record', A, { studentId: 'STU0001', feeType: 'Nope', amount: 100, paymentMode: 'CASH' }, 'NOT_FOUND', 'no such fee');
denied('payments.record', A, { studentId: 'STU0001', feeType: 'Course Fee 2026-27', amount: 100, paymentMode: 'CASH', date: ctx.U.addDays(today, 2) }, 'VALIDATION', 'future payment');
const mine = must('fees.my', S1, {});
ok(mine.totals.paid === 15000 && mine.totals.remaining === 10000 && mine.payments.length === 2, 'student fee view', mine.totals);
ok(mine.payments[0].previousBalance !== undefined, 'payment has previous balance');
const rc = must('receipts.get', S1, { paymentId: mine.payments[0].paymentId });
ok(rc.mime === 'application/pdf' && rc.name.indexOf('SCC-2627') >= 0, 'student downloads own receipt', rc.name);
denied('receipts.get', S2, { paymentId: mine.payments[0].paymentId }, 'FORBIDDEN', 'student2 reads student1 receipt');
must('receipts.regenerate', A, { paymentId: mine.payments[0].paymentId });
const html = run('Receipts.html(Db.all("Payments")[0])');
['SUCCESS COACHING CLASSES', 'Receipt No', 'Previous Balance', 'Amount Paid', 'Remaining Balance', 'Payment Mode', 'Student ID', 'Rupees Ten Thousand Only'].forEach(k => ok(html.indexOf(k) >= 0, 'receipt has ' + k));
denied('fees.update', A, { studentId: 'STU0001', feeType: 'Course Fee 2026-27', totalFee: 12000, discount: 0 }, 'VALIDATION', 'fee below paid');
const fu = must('fees.update', A, { studentId: 'STU0001', feeType: 'Course Fee 2026-27', totalFee: 30000, discount: 10000 });
ok(fu.finalFee === 20000 && fu.remaining === 5000, 'fee update recalculates', fu);
denied('fees.remove', A, { studentId: 'STU0001', feeType: 'Course Fee 2026-27' }, 'VALIDATION', 'delete fee with payments');
must('payments.record', A, { studentId: 'STU0001', feeType: 'Course Fee 2026-27', amount: 5000, paymentMode: 'CARD' });
ok(must('fees.student', A, { studentId: 'STU0001' }).fees[0].status === 'PAID', 'fully paid status');
denied('payments.record', A, { studentId: 'STU0001', feeType: 'Course Fee 2026-27', amount: 1, paymentMode: 'CASH' }, 'VALIDATION', 'paying a paid fee');
const outs = must('fees.outstanding', A, { status: 'DUE' });
ok(outs.total === 1 && outs.totals.remaining === 25000, 'outstanding list', outs.totals);
ok(must('payments.list', A, { q: 'STU0001' }).total === 3, 'payment list');

console.log('== user administration');
denied('users.setStatus', A, { userId: run('Db.get("Users","Username","admin").UserID'), status: 'INACTIVE' }, 'FORBIDDEN', 'cannot deactivate admin');
const uid2 = run('Db.get("Students","StudentID","STU0002").UserID');
must('users.setStatus', A, { userId: uid2, status: 'INACTIVE' });
denied('assignments.list', S2, {}, 'AUTH', 'deactivated user session revoked');
denied('auth.login', null, { username: 'STU0002', password: 'Student123' }, 'INACTIVE', 'inactive login');
must('users.setStatus', A, { userId: uid2, status: 'ACTIVE' });
const rp = must('users.resetPassword', A, { userId: uid2 });
ok(!!rp.password, 'reset returns password');
const S2b = must('auth.login', null, { username: 'STU0002', password: rp.password }).token;
must('auth.changePassword', S2b, { oldPassword: rp.password, newPassword: 'Brandnew99' });
denied('auth.changePassword', S2b, { oldPassword: 'wrong', newPassword: 'Another123' }, 'VALIDATION', 'wrong old pw');
must('auth.login', null, { username: 'STU0002', password: 'Brandnew99' });
must('auth.logout', S2b);
denied('auth.me', S2b, {}, 'AUTH', 'logged out token');

console.log('== settings');
const st = must('settings.save', A, { InstituteName: 'Success Coaching Classes', Address: '1 Main Rd', Phone: '+91 99999 99999', Email: 'a@b.co', ReceiptPrefix: 'SCC', AcademicYear: '2026-27', AllowedClasses: '8,9,10', StudentRegistration: 'OFF', TeacherRegistration: 'ON', LowAttendanceThreshold: 80 });
ok(st.StudentRegistration === 'OFF', 'settings saved');
denied('auth.registerStudent', null, { name: 'Late Comer', class: '9', phone: '9123456789', password: 'Student123' }, 'VALIDATION', 'registration closed');
ok(call('public.info').data.studentRegistration === false, 'public info reflects setting');
denied('settings.save', A, { InstituteName: '', AcademicYear: 'x' }, 'VALIDATION', 'invalid settings');
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5]).toString('base64');
must('settings.uploadLogo', A, { file: { name: 'logo.png', data: png } });
ok(call('public.info').data.logo.startsWith('data:image/png'), 'logo served');

console.log('== dashboards & timetable');
const da = must('dashboard.get', A, { fresh: true });
ok(da.stats.students === 2 && da.stats.teachers === 2 && da.stats.batches === 2, 'admin stats', da.stats);
const dt = must('dashboard.get', T1, {});
ok(dt.stats.batches === 1 && dt.role === 'TEACHER', 'teacher dash', dt.stats);
const ds = must('dashboard.get', S1, {});
ok(ds.role === 'STUDENT' && ds.fees.remaining === 0 && Array.isArray(ds.alerts), 'student dash', ds.fees);
ok(must('timetable.get', S1, {}).items.length === 2, 'student timetable');
ok(must('timetable.get', T1, {}).items.length === 1, 'teacher timetable');

console.log('== test data');
const td = run('loadTestData()');
ok(/TEST data loaded/.test(td), 'test data loaded', td);
ok(run('Db.count("Students")') === 2 + 36, 'students total');
const TS = must('auth.login', null, { username: 'test-s001', password: 'Test@1234' }).token;
const tsd = must('dashboard.get', TS, {});
ok(tsd.attendance.total > 0 && tsd.upcomingClasses.length > 0, 'test student dashboard has data', tsd.attendance);
const TT = must('auth.login', null, { username: 'TEST-T1', password: 'Test@1234' }).token;
ok(must('dashboard.get', TT, {}).stats.batches === 3, 'test teacher has 3 batches');
ok(/already loaded/.test(run('loadTestData()')), 'no double load');
must('dashboard.get', A, { fresh: true });
const tc = run('clearTestData()');
ok(/removed/.test(tc), 'test data removed', tc);
ok(run('Db.count("Students")') === 2 && run('Db.count("Teachers")') === 3 && run('Db.count("Batches")') === 2, 'real data intact after clear');
ok(run('Db.count("Fees")') === 2 && run('Db.count("Payments")') === 3, 'real fees intact');
ok(run('Db.count("Results")') === 2, 'real results intact');

console.log('== id / sequence sanity');
const s3 = must('students.create', A, { name: 'Manual Student', class: '9', phone: '9000000009', batches: [] });
ok(s3.studentId === 'STU0003' && !!s3.password, 'sequence continues after test data', s3);
ok(run('Db.first("Users", u => u.Username === "STU0003").AuthData').startsWith('v1$'), 'password stored hashed');
ok(JSON.stringify(call('students.list', A, {})).indexOf('AuthData') < 0, 'AuthData never returned');
denied('unknown.action', A, {}, 'NOT_FOUND');

console.log('\nRESULT: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
