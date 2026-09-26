/**
 * ============================================================================
 *  Attendance.gs
 *
 *  DESIGN: one row per BATCH per DAY (not per student).
 *    Date | Batch | Present | Absent | PresentIDs | AbsentIDs | Remarks | MarkedBy | UpdatedAt
 *  With 2,000+ students a per-student row design would create ~1M rows per
 *  year and make every screen slow; this keeps the sheet at ~20k rows/year and
 *  still readable ("AbsentIDs: STU0004, STU0009").
 * ============================================================================
 */
var Attendance = (function () {
  function parseRemarks(str) {
    var m = {};
    String(str || '').split(' | ').forEach(function (part) {
      var i = part.indexOf('=');
      if (i > 0) m[part.substr(0, i).trim()] = part.substr(i + 1).trim();
    });
    return m;
  }

  function dayFor(batch, date) {
    return Db.first(SHEET.ATTENDANCE, function (r) { return r.Date === date && r.Batch === batch; });
  }

  function batchSubjects() {
    var m = {};
    Db.all(SHEET.BATCHES).forEach(function (b) { m[b.Batch] = b.Subject; });
    return m;
  }

  function pct(present, total) { return total ? Math.round(present * 1000 / total) / 10 : 0; }

  return {
    /** Roster with current status for a batch/date (defaults to PRESENT). */
    sheet: function (ctx, p) {
      var b = Access.requireBatch(ctx, p.batch);
      if (ctx.role === ROLE.STUDENT) throw AppError('You do not have access to this information.', 'FORBIDDEN');
      var date = U.date(p.date, 'Date');
      var day = dayFor(b.Batch, date);
      var absent = {}, remarks = {};
      if (day) {
        U.csv(day.AbsentIDs).forEach(function (id) { absent[id] = true; });
        remarks = parseRemarks(day.Remarks);
      }
      var students = Students.inBatch(b.Batch).map(function (s) {
        return { studentId: s.StudentID, name: s.Name, status: absent[s.StudentID] ? 'ABSENT' : 'PRESENT', remark: remarks[s.StudentID] || '' };
      });
      return { batch: b.Batch, subject: b.Subject, date: date, exists: !!day, students: students, markedBy: day ? day.MarkedBy : '', updatedAt: day ? day.UpdatedAt : '' };
    },

    save: function (ctx, p) {
      var b = Access.requireBatch(ctx, p.batch, { write: true });
      var date = U.date(p.date, 'Date');
      var today = U.today();
      if (date > today) throw AppError('You cannot mark attendance for a future date.');
      if (ctx.role === ROLE.TEACHER && U.daysBetween(date, today) > CFG.TEACHER_BACKDATE_DAYS) {
        throw AppError('Teachers can only edit attendance of the last ' + CFG.TEACHER_BACKDATE_DAYS + ' days. Please contact the admin.');
      }
      var records = Array.isArray(p.records) ? p.records : [];
      return U.withLock(function () {
        var roster = Students.inBatch(b.Batch);
        if (!roster.length) throw AppError('This batch has no active students yet.');
        var ids = {};
        roster.forEach(function (s) { ids[s.StudentID] = true; });
        var status = {}, remarks = {};
        records.forEach(function (r) {
          var id = String(r.studentId || '').trim();
          if (!ids[id]) throw AppError('Student ' + id + ' is not in this batch.');
          var st = String(r.status || '').toUpperCase();
          if (st !== 'PRESENT' && st !== 'ABSENT') throw AppError('Invalid attendance status.');
          status[id] = st;
          var rm = U.text(r.remark, 'Remark', { required: false, max: 60 }).replace(/[|=]/g, ' ').trim();
          if (rm && st === 'ABSENT') remarks[id] = rm;
        });
        var present = [], absent = [];
        roster.forEach(function (s) { (status[s.StudentID] === 'ABSENT' ? absent : present).push(s.StudentID); });
        var remarkStr = Object.keys(remarks).map(function (id) { return id + '=' + remarks[id]; }).join(' | ');
        var row = {
          Date: date, Batch: b.Batch, Present: present.length, Absent: absent.length,
          PresentIDs: present.join(', '), AbsentIDs: absent.join(', '), Remarks: remarkStr,
          MarkedBy: ctx.role === ROLE.ADMIN ? 'ADMIN' : ctx.teacherId, UpdatedAt: U.now()
        };
        var existing = dayFor(b.Batch, date);
        if (existing) Db.update(SHEET.ATTENDANCE, existing, row);
        else Db.insert(SHEET.ATTENDANCE, row);
        return { batch: b.Batch, date: date, present: present.length, absent: absent.length, updated: !!existing };
      });
    },

    /** Days on which attendance was taken for a batch in a month. */
    history: function (ctx, p) {
      var b = Access.requireBatch(ctx, p.batch);
      if (ctx.role === ROLE.STUDENT) throw AppError('You do not have access to this information.', 'FORBIDDEN');
      var month = p.month ? U.month(p.month) : U.thisMonth();
      var items = Db.where(SHEET.ATTENDANCE, function (r) { return r.Batch === b.Batch && String(r.Date).substr(0, 7) === month; })
        .sort(function (x, y) { return U.cmp(y.Date, x.Date); })
        .map(function (r) { return { date: r.Date, present: U.num(r.Present), absent: U.num(r.Absent), markedBy: r.MarkedBy }; });
      return { batch: b.Batch, month: month, items: items };
    },

    /** Per-student attendance percentage for a batch over a date range. */
    report: function (ctx, p) {
      var b = Access.requireBatch(ctx, p.batch);
      if (ctx.role === ROLE.STUDENT) throw AppError('You do not have access to this information.', 'FORBIDDEN');
      var from = p.from ? U.date(p.from, 'From date') : U.monthStart(U.thisMonth());
      var to = p.to ? U.date(p.to, 'To date') : U.today();
      if (from > to) throw AppError('The "from" date must be before the "to" date.');
      var days = Db.where(SHEET.ATTENDANCE, function (r) { return r.Batch === b.Batch && r.Date >= from && r.Date <= to; });
      var low = Settings.lowAttendance();
      var students = Students.inBatch(b.Batch).map(function (s) {
        var pr = 0, ab = 0;
        days.forEach(function (d) {
          if (U.hasId(d.PresentIDs, s.StudentID)) pr++;
          else if (U.hasId(d.AbsentIDs, s.StudentID)) ab++;
        });
        var percent = pct(pr, pr + ab);
        return { studentId: s.StudentID, name: s.Name, present: pr, absent: ab, total: pr + ab, percent: percent, low: (pr + ab) > 0 && percent < low };
      });
      return { batch: b.Batch, subject: b.Subject, from: from, to: to, sessions: days.length, students: students };
    },

    /** Student: own attendance, overall + per subject + day list for a month. */
    my: function (ctx, p) {
      var names = Access.studentBatchNames(ctx), me = ctx.studentId;
      var month = p.month ? U.month(p.month) : U.thisMonth();
      var subjects = batchSubjects();
      var by = {}, days = [], tp = 0, ta = 0;
      Db.where(SHEET.ATTENDANCE, function (r) { return names.indexOf(r.Batch) >= 0; }).forEach(function (r) {
        var st = U.hasId(r.PresentIDs, me) ? 'PRESENT' : (U.hasId(r.AbsentIDs, me) ? 'ABSENT' : '');
        if (!st) return;
        by[r.Batch] = by[r.Batch] || { batch: r.Batch, subject: subjects[r.Batch] || '', present: 0, absent: 0 };
        if (st === 'PRESENT') { by[r.Batch].present++; tp++; } else { by[r.Batch].absent++; ta++; }
        if (String(r.Date).substr(0, 7) === month) {
          days.push({ date: r.Date, batch: r.Batch, subject: subjects[r.Batch] || '', status: st, remark: st === 'ABSENT' ? (parseRemarks(r.Remarks)[me] || '') : '' });
        }
      });
      var byBatch = Object.keys(by).sort().map(function (k) {
        var x = by[k]; x.total = x.present + x.absent; x.percent = pct(x.present, x.total); return x;
      });
      days.sort(function (a, b) { return U.cmp(b.date + b.batch, a.date + a.batch); });
      return {
        month: month, threshold: Settings.lowAttendance(),
        overall: { present: tp, absent: ta, total: tp + ta, percent: pct(tp, tp + ta) },
        byBatch: byBatch, days: days
      };
    },

    /** Admin: which batches have attendance for a date. */
    overview: function (ctx, p) {
      var date = p.date ? U.date(p.date, 'Date') : U.today();
      var wd = U.weekday(date);
      var teachers = U.indexBy(Db.all(SHEET.TEACHERS), 'TeacherID');
      var marked = {};
      Db.where(SHEET.ATTENDANCE, function (r) { return r.Date === date; }).forEach(function (r) { marked[r.Batch] = r; });
      var tp = 0, ta = 0, nMarked = 0, nScheduled = 0;
      var items = Db.where(SHEET.BATCHES, function (b) { return b.Status === STATUS.ACTIVE; }).map(function (b) {
        var sch = U.parseSchedule(b.Schedule), m = marked[b.Batch];
        var scheduled = sch.days.indexOf(wd) >= 0;
        if (scheduled) nScheduled++;
        if (m) { nMarked++; tp += U.num(m.Present); ta += U.num(m.Absent); }
        return {
          batch: b.Batch, class: String(b.Class), subject: b.Subject, teacherName: teachers[b.Teacher] ? teachers[b.Teacher].Name : '',
          time: sch.time, scheduled: scheduled, marked: !!m, present: m ? U.num(m.Present) : 0, absent: m ? U.num(m.Absent) : 0
        };
      }).sort(function (a, b) { return (b.scheduled - a.scheduled) || U.cmp(a.batch, b.batch); });
      return { date: date, items: items, totals: { batches: items.length, scheduled: nScheduled, marked: nMarked, present: tp, absent: ta, percent: pct(tp, tp + ta) } };
    },

    /** Used by dashboards: batches of a set that still need attendance for `date`. */
    markedSet: function (date) {
      var m = {};
      Db.where(SHEET.ATTENDANCE, function (r) { return r.Date === date; }).forEach(function (r) { m[r.Batch] = r; });
      return m;
    }
  };
})();
