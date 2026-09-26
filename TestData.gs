/**
 * ============================================================================
 *  TestData.gs — safe demo data generator.
 *
 *  Everything created here is clearly marked and separable from real data:
 *    - IDs start with "TEST-"  (TEST-S001, TEST-T1, TEST-ASG001, ...)
 *    - batch names contain "-TEST-" (e.g. 10-TEST-MATH)
 *    - names end with "(TEST)"
 *    - created-by is "TEST-SYSTEM"
 *  All test accounts use the password:  Test@1234
 *  "Remove TEST data" deletes exactly these rows and nothing else.
 * ============================================================================
 */
function loadTestData() {
  Setup.assertOwner();
  var ui = Setup.ui();
  if (ui) {
    var r = ui.alert('Load TEST data', 'This adds 5 teachers, 36 students, batches, attendance, assignments, results, fees and payments ' +
      'clearly marked as TEST. You can remove them any time from the same menu.\n\nContinue?', ui.ButtonSet.YES_NO);
    if (r !== ui.Button.YES) return;
  }
  var msg = TestData.load();
  Setup.say(ui, 'TEST data', msg);
  return msg;
}

function clearTestData() {
  Setup.assertOwner();
  var ui = Setup.ui();
  if (ui) {
    var r = ui.alert('Remove TEST data', 'This permanently deletes all rows marked TEST (IDs starting with "TEST-"). Real data is not touched.\n\nContinue?', ui.ButtonSet.YES_NO);
    if (r !== ui.Button.YES) return;
  }
  var msg = TestData.clear();
  Setup.say(ui, 'TEST data', msg);
  return msg;
}

var TestData = {
  isTestId: function (v) { return String(v).indexOf('TEST-') === 0; },
  isTestBatch: function (v) { return String(v).indexOf('-TEST-') >= 0; },

  load: function () {
    return U.withLock(function () {
      if (Db.first(SHEET.TEACHERS, function (t) { return t.TeacherID === 'TEST-T1'; })) return 'TEST data is already loaded. Remove it first to reload.';
      var seed = 12345;
      function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
      function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
      var today = U.today(), now = U.now(), authData = Auth.make('Test@1234');

      // ---- teachers + users
      var TEACH = [
        ['TEST-T1', 'Rahul Deshmukh', 'Mathematics'], ['TEST-T2', 'Sneha Patil', 'Science'], ['TEST-T3', 'Amit Joshi', 'English'],
        ['TEST-T4', 'Pooja Kulkarni', 'Social Science'], ['TEST-T5', 'Vikas Rathod', 'Hindi']
      ];
      var users = [], teachers = [];
      TEACH.forEach(function (t, i) {
        var uid = 'TEST-U-T' + (i + 1);
        users.push({ UserID: uid, Username: t[0], AuthData: authData, Role: ROLE.TEACHER, Status: STATUS.ACTIVE, NotifSeenAt: '2000-01-01 00:00:00', CreatedAt: now, UpdatedAt: now });
        teachers.push({ TeacherID: t[0], UserID: uid, Name: t[1] + ' (TEST)', Subject: t[2], Phone: '90000000' + U.pad(i + 1, 2), Status: STATUS.ACTIVE, CreatedAt: now, UpdatedAt: now });
      });

      // ---- batches
      var BT = [
        ['8', 'MATH', 'Mathematics', 'TEST-T1', 'Mon/Wed/Fri 4 PM'], ['9', 'MATH', 'Mathematics', 'TEST-T1', 'Mon/Wed/Fri 5 PM'], ['10', 'MATH', 'Mathematics', 'TEST-T1', 'Mon/Wed/Fri 6 PM'],
        ['8', 'SCI', 'Science', 'TEST-T2', 'Tue/Thu/Sat 4 PM'], ['9', 'SCI', 'Science', 'TEST-T2', 'Tue/Thu/Sat 5 PM'], ['10', 'SCI', 'Science', 'TEST-T2', 'Tue/Thu/Sat 6 PM'],
        ['8', 'ENG', 'English', 'TEST-T3', 'Mon/Wed 5 PM'], ['9', 'ENG', 'English', 'TEST-T3', 'Mon/Wed 6 PM'], ['10', 'ENG', 'English', 'TEST-T3', 'Mon/Wed 7 PM'],
        ['9', 'SST', 'Social Science', 'TEST-T4', 'Tue/Thu 7 PM'], ['10', 'SST', 'Social Science', 'TEST-T4', 'Tue/Thu 8 PM'],
        ['8', 'HIN', 'Hindi', 'TEST-T5', 'Fri 5 PM']
      ];
      var batches = BT.map(function (b) {
        return { Batch: b[0] + '-TEST-' + b[1], Class: b[0], Subject: b[2], Teacher: b[3], Schedule: b[4], Status: STATUS.ACTIVE };
      });
      var byClass = { '8': [], '9': [], '10': [] };
      batches.forEach(function (b) { byClass[b.Class].push(b.Batch); });

      // ---- students
      var FIRST = ['Aarav', 'Vivaan', 'Aditya', 'Sai', 'Arjun', 'Ishaan', 'Ananya', 'Diya', 'Saanvi', 'Aadhya', 'Pari', 'Myra'];
      var LAST = ['Sapkal', 'Wankhede', 'Thakre', 'Gawande'];
      var students = [], n = 0;
      ['8', '9', '10'].forEach(function (cls, ci) {
        for (var i = 0; i < 12; i++) {
          n++;
          var sid = 'TEST-S' + U.pad(n, 3), uid = 'TEST-U-S' + U.pad(n, 3);
          users.push({ UserID: uid, Username: sid, AuthData: authData, Role: ROLE.STUDENT, Status: STATUS.ACTIVE, NotifSeenAt: '2000-01-01 00:00:00', CreatedAt: now, UpdatedAt: now });
          students.push({ StudentID: sid, UserID: uid, Name: FIRST[i] + ' ' + LAST[(i + ci) % 4] + ' (TEST)', Class: cls, Batch: byClass[cls].join(', '), Phone: '98' + U.pad(Math.floor(rnd() * 1e8), 8), Status: STATUS.ACTIVE, CreatedAt: now, UpdatedAt: now });
        }
      });
      var roster = {};
      batches.forEach(function (b) { roster[b.Batch] = students.filter(function (s) { return U.hasId(s.Batch, b.Batch); }); });
      var teacherOf = U.indexBy(batches, 'Batch');

      // ---- attendance (last 14 days, only on scheduled weekdays, not today)
      var attendance = [];
      for (var d = 14; d >= 1; d--) {
        var date = U.addDays(today, -d), wd = U.weekday(date);
        batches.forEach(function (b) {
          if (U.parseSchedule(b.Schedule).days.indexOf(wd) < 0) return;
          var pr = [], ab = [], rem = [];
          roster[b.Batch].forEach(function (s) {
            if (rnd() < 0.1) { ab.push(s.StudentID); if (rnd() < 0.5) rem.push(s.StudentID + '=Sick'); } else pr.push(s.StudentID);
          });
          attendance.push({ Date: date, Batch: b.Batch, Present: pr.length, Absent: ab.length, PresentIDs: pr.join(', '), AbsentIDs: ab.join(', '), Remarks: rem.join(' | '), MarkedBy: b.Teacher, UpdatedAt: date + ' 19:00:00' });
        });
      }

      // ---- assignments / materials / results
      var assignments = [], materials = [], results = [], an = 0, mn = 0;
      batches.forEach(function (b) {
        [[-2, 5, 'Practice worksheet'], [-9, -1, 'Chapter test revision']].forEach(function (a) {
          an++;
          assignments.push({ AssignmentID: 'TEST-ASG' + U.pad(an, 3), Batch: b.Batch, Subject: b.Subject, Title: b.Subject + ' - ' + a[2] + ' (TEST)', Description: 'Sample assignment created by the test-data generator.', FileID: '', FileName: '', IssueDate: U.addDays(today, a[0]), DueDate: U.addDays(today, a[1]), Status: 'PUBLISHED', CreatedBy: b.Teacher, CreatedAt: now });
        });
        mn++;
        materials.push({ MaterialID: 'TEST-MAT' + U.pad(mn, 3), Batch: b.Batch, Subject: b.Subject, Title: b.Subject + ' notes (TEST sample - no file)', Description: 'Sample material without a file.', FileID: '', FileName: '', Date: U.addDays(today, -3), Status: 'PUBLISHED', CreatedBy: b.Teacher });
        [['Unit Test 1', 25, -20], ['Mid Term', 50, -6]].forEach(function (ex) {
          roster[b.Batch].forEach(function (s) {
            var marks = Math.round(ex[1] * (0.45 + rnd() * 0.5) * 2) / 2, pct = U.round2(marks * 100 / ex[1]);
            results.push({ Exam: ex[0], Batch: b.Batch, Subject: b.Subject, StudentID: s.StudentID, Marks: marks, MaxMarks: ex[1], Percentage: pct, Grade: U.gradeFor(pct), Remarks: '', EnteredBy: b.Teacher, UpdatedAt: U.addDays(today, ex[2]) + ' 18:00:00' });
          });
        });
      });

      // ---- events + notifications
      var events = [
        { EventID: 'TEST-EVT001', Title: 'Institute holiday (TEST)', Description: 'Sample holiday for everyone.', EventType: 'Holiday', Date: U.addDays(today, 7), Time: '', Target: 'ALL', CreatedBy: 'TEST-SYSTEM', CreatedAt: now },
        { EventID: 'TEST-EVT002', Title: 'Parent meeting - Class 10 (TEST)', Description: 'Sample parent meeting.', EventType: 'Parent Meeting', Date: U.addDays(today, 10), Time: '11:00 AM', Target: 'CLASS_10', CreatedBy: 'TEST-SYSTEM', CreatedAt: now },
        { EventID: 'TEST-EVT003', Title: 'Maths unit test (TEST)', Description: 'Chapters 1-3.', EventType: 'Test', Date: U.addDays(today, 3), Time: '5:00 PM', Target: '9-TEST-MATH', CreatedBy: 'TEST-SYSTEM', CreatedAt: now }
      ];
      var notifications = [
        { NotificationID: 'TEST-NTF001', Date: now, Target: 'ALL', Title: 'Welcome to the portal (TEST)', Message: 'This is a sample notification.', CreatedBy: 'TEST-SYSTEM' },
        { NotificationID: 'TEST-NTF002', Date: now, Target: 'CLASS_10', Title: 'Board exam tips (TEST)', Message: 'Sample message for Class 10.', CreatedBy: 'TEST-SYSTEM' },
        { NotificationID: 'TEST-NTF003', Date: now, Target: '9-TEST-MATH', Title: 'Bring your geometry box (TEST)', Message: 'Sample batch message.', CreatedBy: 'TEST-SYSTEM' }
      ];

      // ---- fees + payments
      var fees = [], payments = [], pn = 0, FEE = { '8': 24000, '9': 30000, '10': 36000 };
      students.forEach(function (s) {
        var total = FEE[s.Class], disc = pick([0, 0, 1000, 2000]), finalFee = total - disc, paid = 0;
        var parts = pick([0, 1, 1, 2, 3]);
        for (var k = 0; k < parts; k++) {
          var amt = k === 2 ? finalFee - paid : Math.round(finalFee * (0.3 + rnd() * 0.2) / 100) * 100;
          if (amt <= 0 || paid + amt > finalFee) break;
          pn++;
          payments.push({ PaymentID: 'TEST-PAY' + U.pad(pn, 4), StudentID: s.StudentID, FeeType: 'Course Fee ' + Settings.get('AcademicYear', '2026-27'), Amount: amt, Date: U.addDays(today, -(20 - k * 7)), PaymentMode: pick(PAYMENT_MODES), ReceiptNumber: 'TEST-R' + U.pad(pn, 4), PreviousBalance: finalFee - paid, RemainingBalance: finalFee - paid - amt, Notes: 'TEST payment', ReceiptFileID: '', CreatedBy: 'TEST-SYSTEM', CreatedAt: now });
          paid += amt;
        }
        var c = Fees.calc(total, disc, paid);
        fees.push({ StudentID: s.StudentID, FeeType: 'Course Fee ' + Settings.get('AcademicYear', '2026-27'), TotalFee: total, Discount: disc, FinalFee: c.FinalFee, Paid: paid, Remaining: c.Remaining, Status: c.Status, DueDate: U.addDays(today, k2(s)), UpdatedAt: now });
      });
      function k2(s) { return Number(s.StudentID.substr(-3)) % 3 === 0 ? -5 : 25; } // a few overdue

      Db.insert(SHEET.USERS, users);
      Db.insert(SHEET.TEACHERS, teachers);
      Db.insert(SHEET.BATCHES, batches);
      Db.insert(SHEET.STUDENTS, students);
      Db.insert(SHEET.ATTENDANCE, attendance);
      Db.insert(SHEET.ASSIGNMENTS, assignments);
      Db.insert(SHEET.MATERIALS, materials);
      Db.insert(SHEET.RESULTS, results);
      Db.insert(SHEET.EVENTS, events);
      Db.insert(SHEET.NOTIFICATIONS, notifications);
      Db.insert(SHEET.FEES, fees);
      if (payments.length) Db.insert(SHEET.PAYMENTS, payments);
      CacheService.getScriptCache().remove('dash:admin');
      return 'TEST data loaded: ' + teachers.length + ' teachers, ' + students.length + ' students, ' + batches.length + ' batches, ' +
        attendance.length + ' attendance days, ' + results.length + ' results, ' + payments.length + ' payments.\n\n' +
        'Log in with usernames TEST-T1 ... TEST-T5 (teachers) or TEST-S001 ... TEST-S036 (students).\nPassword for all: Test@1234';
    });
  },

  clear: function () {
    return U.withLock(function () {
      var isT = TestData.isTestId, isB = TestData.isTestBatch, total = 0;
      var del = function (sheet, fn) { total += Db.deleteWhere(sheet, fn); };
      del(SHEET.USERS, function (r) { return isT(r.UserID); });
      del(SHEET.STUDENTS, function (r) { return isT(r.StudentID); });
      del(SHEET.TEACHERS, function (r) { return isT(r.TeacherID); });
      del(SHEET.BATCHES, function (r) { return isB(r.Batch); });
      del(SHEET.ATTENDANCE, function (r) { return isB(r.Batch); });
      del(SHEET.ASSIGNMENTS, function (r) { return isT(r.AssignmentID) || isB(r.Batch); });
      del(SHEET.MATERIALS, function (r) { return isT(r.MaterialID) || isB(r.Batch); });
      del(SHEET.RESULTS, function (r) { return isB(r.Batch) || isT(r.StudentID); });
      del(SHEET.FEES, function (r) { return isT(r.StudentID); });
      del(SHEET.PAYMENTS, function (r) { return isT(r.PaymentID) || isT(r.StudentID); });
      del(SHEET.EVENTS, function (r) { return isT(r.EventID); });
      del(SHEET.NOTIFICATIONS, function (r) { return isT(r.NotificationID) || isT(r.CreatedBy); });
      CacheService.getScriptCache().remove('dash:admin');
      return 'TEST data removed (' + total + ' rows).';
    });
  }
};
