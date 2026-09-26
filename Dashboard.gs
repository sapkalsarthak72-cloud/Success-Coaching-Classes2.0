/**
 * ============================================================================
 *  Dashboard.gs — one request per dashboard (keeps Apps Script quota use low).
 *  The admin dashboard is cached for 60 seconds (pass {fresh:true} to refresh).
 * ============================================================================
 */
var Dashboard = {
  get: function (ctx, p) {
    if (ctx.role === ROLE.ADMIN) return Dashboard.admin(ctx, p);
    if (ctx.role === ROLE.TEACHER) return Dashboard.teacher(ctx, p);
    return Dashboard.student(ctx, p);
  },

  admin: function (ctx, p) {
    var cache = CacheService.getScriptCache();
    if (!p.fresh) {
      var c = cache.get('dash:admin');
      if (c) { try { return JSON.parse(c); } catch (e) { /* rebuild */ } }
    }
    var today = U.today(), month = today.substr(0, 7);
    var students = Db.all(SHEET.STUDENTS), teachers = Db.all(SHEET.TEACHERS);
    var att = Attendance.overview(ctx, { date: today });
    var due = 0, dueStudents = {};
    Db.all(SHEET.FEES).forEach(function (f) {
      var r = U.num(f.Remaining);
      if (r > 0) { due += r; dueStudents[f.StudentID] = true; }
    });
    var collected = 0;
    Db.all(SHEET.PAYMENTS).forEach(function (r) { if (String(r.Date).substr(0, 7) === month) collected += U.num(r.Amount); });
    var lookup = U.indexBy(students, 'StudentID');
    var recentPayments = Db.all(SHEET.PAYMENTS).slice().sort(function (a, b) { return U.cmp(b.Date + b.PaymentID, a.Date + a.PaymentID); })
      .slice(0, 5).map(function (r) { return Payments.view(r, lookup); });
    var out = {
      role: ROLE.ADMIN, today: today,
      stats: {
        students: students.filter(function (s) { return s.Status === STATUS.ACTIVE; }).length,
        teachers: teachers.filter(function (t) { return t.Status === STATUS.ACTIVE; }).length,
        batches: Db.where(SHEET.BATCHES, function (b) { return b.Status === STATUS.ACTIVE; }).length,
        pending: students.filter(function (s) { return s.Status === STATUS.PENDING; }).length + teachers.filter(function (t) { return t.Status === STATUS.PENDING; }).length,
        outstanding: U.round2(due), studentsWithDues: Object.keys(dueStudents).length, collectedThisMonth: U.round2(collected)
      },
      attendance: att.totals,
      pendingBatches: att.items.filter(function (b) { return b.scheduled && !b.marked; }).slice(0, 6),
      recentPayments: recentPayments,
      upcomingEvents: Events.list(ctx, { scope: 'upcoming', pageSize: 5 }).items,
      recentAssignments: Assignments.list(ctx, { pageSize: 5 }).items,
      recentNotifications: Notifications.list(ctx, { pageSize: 5 }).items,
      generatedAt: U.now()
    };
    U.cachePut('dash:admin', JSON.stringify(out), 60);
    return out;
  },

  teacher: function (ctx) {
    var today = U.today(), wd = U.weekday(today);
    var mine = Access.teacherBatches(ctx).filter(function (b) { return b.Status === STATUS.ACTIVE; });
    var marked = Attendance.markedSet(today), counts = Batches.counts();
    var names = mine.map(function (b) { return b.Batch; });
    var classes = mine.map(function (b) {
      var sch = U.parseSchedule(b.Schedule);
      return { batch: b.Batch, subject: b.Subject, class: String(b.Class), time: sch.time, startMin: sch.startMin, scheduled: sch.days.indexOf(wd) >= 0, students: counts[b.Batch] || 0, marked: !!marked[b.Batch] };
    });
    var todayClasses = classes.filter(function (c) { return c.scheduled; }).sort(function (a, b) { return a.startMin - b.startMin; });
    var studentSet = {};
    Db.all(SHEET.STUDENTS).forEach(function (s) {
      if (s.Status === STATUS.ACTIVE && U.csv(s.Batch).some(function (b) { return names.indexOf(b.toUpperCase()) >= 0; })) studentSet[s.StudentID] = true;
    });
    var seen = {}, recentResults = [];
    Db.where(SHEET.RESULTS, function (r) { return names.indexOf(r.Batch) >= 0; })
      .sort(function (a, b) { return U.cmp(b.UpdatedAt, a.UpdatedAt); })
      .forEach(function (r) {
        var k = r.Batch + '|' + U.lc(r.Exam);
        if (seen[k] || recentResults.length >= 5) return;
        seen[k] = true;
        recentResults.push({ batch: r.Batch, subject: r.Subject, exam: r.Exam, date: String(r.UpdatedAt).substr(0, 10) });
      });
    return {
      role: ROLE.TEACHER, today: today,
      stats: { batches: mine.length, students: Object.keys(studentSet).length, attendancePending: todayClasses.filter(function (c) { return !c.marked; }).length, classesToday: todayClasses.length },
      todayClasses: todayClasses, batches: classes,
      recentAssignments: Assignments.list(ctx, { pageSize: 5 }).items,
      recentMaterials: Materials.list(ctx, { pageSize: 5 }).items,
      upcomingEvents: Events.list(ctx, { scope: 'upcoming', pageSize: 5 }).items,
      recentResults: recentResults
    };
  },

  student: function (ctx) {
    var today = U.today();
    var att = Attendance.my(ctx, {});
    var bundle = Fees._studentBundle(ctx.studentId);
    var nextDue = '';
    bundle.fees.forEach(function (f) { if (f.remaining > 0 && f.dueDate && (!nextDue || f.dueDate < nextDue)) nextDue = f.dueDate; });

    // next class occurrences
    var labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], wd = U.weekday(today), upcoming = [];
    Batches.list(ctx, { activeOnly: true }).items.forEach(function (b) {
      for (var i = 0; i < 7; i++) {
        if (b.days.indexOf((wd + i) % 7) >= 0) {
          upcoming.push({ batch: b.batch, subject: b.subject, teacherName: b.teacherName, time: b.time, startMin: b.startMin, offset: i, when: i === 0 ? 'Today' : (i === 1 ? 'Tomorrow' : labels[(wd + i) % 7]) });
          break;
        }
      }
    });
    upcoming.sort(function (a, b) { return (a.offset - b.offset) || (a.startMin - b.startMin); });

    var asg = Assignments.list(ctx, { pageSize: 100 }).items;
    var open = asg.filter(function (a) { return !a.overdue; }).slice(0, 5);
    var overdue = asg.filter(function (a) { return a.overdue && a.daysLeft >= -7; }).length;
    var soon = asg.filter(function (a) { return !a.overdue && a.daysLeft <= 2; }).length;
    var notes = Notifications.list(ctx, { pageSize: 5 });

    var alerts = [];
    if (soon) alerts.push({ tone: 'warning', icon: 'clipboard', text: soon + (soon === 1 ? ' assignment is' : ' assignments are') + ' due within 2 days', go: 'assignments' });
    if (overdue) alerts.push({ tone: 'error', icon: 'alert', text: overdue + (overdue === 1 ? ' assignment' : ' assignments') + ' passed the due date in the last week', go: 'assignments' });
    if (att.overall.total > 0 && att.overall.percent < att.threshold) alerts.push({ tone: 'warning', icon: 'user-check', text: 'Your attendance is ' + att.overall.percent + '% \u2014 below ' + att.threshold + '%', go: 'attendance' });
    if (bundle.totals.remaining > 0) alerts.push({ tone: bundle.fees.some(function (f) { return f.overdue; }) ? 'error' : 'info', icon: 'credit-card', text: '\u20B9' + bundle.totals.remaining + ' fees remaining' + (nextDue ? ' (next due ' + U.prettyDate(nextDue) + ')' : ''), go: 'fees' });
    if (notes.unread) alerts.push({ tone: 'info', icon: 'bell', text: notes.unread + ' unread notification' + (notes.unread === 1 ? '' : 's'), go: 'notifications' });

    return {
      role: ROLE.STUDENT, today: today, name: ctx.name,
      attendance: att.overall, threshold: att.threshold,
      fees: { remaining: bundle.totals.remaining, finalFee: bundle.totals.finalFee, paid: bundle.totals.paid, nextDue: nextDue },
      upcomingClasses: upcoming.slice(0, 5), upcomingAssignments: open,
      recentResults: Results.my(ctx).items.slice(0, 3),
      recentMaterials: Materials.list(ctx, { pageSize: 5 }).items,
      notifications: notes.items, unread: notes.unread, alerts: alerts
    };
  }
};
