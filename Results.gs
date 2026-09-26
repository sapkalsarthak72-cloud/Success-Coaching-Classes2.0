/**
 * ============================================================================
 *  Results.gs — exam marks. One row per student per exam per subject.
 *  Percentage and Grade are calculated by the server (never typed by hand).
 * ============================================================================
 */
var Results = {
  _pct: function (marks, max) { return max ? U.round2(marks * 100 / max) : 0; },

  view: function (r, students) {
    var s = students ? students[r.StudentID] : null;
    return {
      exam: r.Exam, batch: r.Batch, subject: r.Subject, studentId: r.StudentID, studentName: s ? s.Name : '',
      class: s ? String(s.Class) : '', marks: U.num(r.Marks), maxMarks: U.num(r.MaxMarks),
      percentage: U.num(r.Percentage), grade: r.Grade, remarks: r.Remarks, updatedAt: r.UpdatedAt
    };
  },

  _examRows: function (batch, exam) {
    return Db.where(SHEET.RESULTS, function (r) { return r.Batch === batch && U.lc(r.Exam) === U.lc(exam); });
  },

  /** Teacher/admin: roster with any marks already entered for an exam. */
  sheet: function (ctx, p) {
    var b = Access.requireBatch(ctx, p.batch);
    if (ctx.role === ROLE.STUDENT) throw AppError('You do not have access to this information.', 'FORBIDDEN');
    var exam = String(p.exam || '').trim();
    var have = {}, max = '';
    if (exam) Results._examRows(b.Batch, exam).forEach(function (r) { have[r.StudentID] = r; max = U.num(r.MaxMarks); });
    var students = Students.inBatch(b.Batch).map(function (s) {
      var r = have[s.StudentID];
      return { studentId: s.StudentID, name: s.Name, marks: r ? U.num(r.Marks) : '', remarks: r ? r.Remarks : '' };
    });
    return { batch: b.Batch, subject: b.Subject, exam: exam, maxMarks: max, exists: Object.keys(have).length > 0, students: students };
  },

  exams: function (ctx, p) {
    var b = Access.requireBatch(ctx, p.batch);
    if (ctx.role === ROLE.STUDENT) throw AppError('You do not have access to this information.', 'FORBIDDEN');
    var m = {};
    Db.where(SHEET.RESULTS, function (r) { return r.Batch === b.Batch; }).forEach(function (r) {
      var k = U.lc(r.Exam);
      m[k] = m[k] || { exam: r.Exam, maxMarks: U.num(r.MaxMarks), students: 0, updatedAt: '' };
      m[k].students++;
      if (r.UpdatedAt > m[k].updatedAt) m[k].updatedAt = r.UpdatedAt;
    });
    var items = Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b2) { return U.cmp(b2.updatedAt, a.updatedAt); });
    return { batch: b.Batch, items: items };
  },

  save: function (ctx, p) {
    var b = Access.requireBatch(ctx, p.batch, { write: true });
    var exam = U.text(p.exam, 'Exam name', { min: 2, max: 60 });
    var max = U.money(p.maxMarks, 'Maximum marks', { positive: true, max: 1000 });
    var entries = Array.isArray(p.entries) ? p.entries : [];
    return U.withLock(function () {
      var roster = {};
      Students.inBatch(b.Batch).forEach(function (s) { roster[s.StudentID] = true; });
      var existing = Results._examRows(b.Batch, exam), have = {};
      existing.forEach(function (r) { have[r.StudentID] = r; });
      var final = {};
      existing.forEach(function (r) { final[r.StudentID] = { marks: U.num(r.Marks), remarks: r.Remarks }; });
      entries.forEach(function (en) {
        var id = String(en.studentId || '').trim();
        if (!roster[id]) throw AppError('Student ' + id + ' is not in this batch.');
        if (en.marks === '' || en.marks === null || en.marks === undefined) { return; }
        var marks = U.money(en.marks, 'Marks');
        var remarks = U.text(en.remarks, 'Remarks', { required: false, max: 80 });
        final[id] = { marks: marks, remarks: remarks };
      });
      var now = U.now(), who = ctx.role === ROLE.ADMIN ? 'ADMIN' : ctx.teacherId, inserts = [], updates = [];
      Object.keys(final).forEach(function (id) {
        var f = final[id];
        if (f.marks > max) throw AppError('Marks (' + f.marks + ') cannot be more than the maximum marks (' + max + ') for ' + id + '.');
        var pct = Results._pct(f.marks, max), grade = U.gradeFor(pct);
        if (have[id]) updates.push([have[id], { Marks: f.marks, MaxMarks: max, Percentage: pct, Grade: grade, Remarks: f.remarks, EnteredBy: who, UpdatedAt: now }]);
        else inserts.push({ Exam: exam, Batch: b.Batch, Subject: b.Subject, StudentID: id, Marks: f.marks, MaxMarks: max, Percentage: pct, Grade: grade, Remarks: f.remarks, EnteredBy: who, UpdatedAt: now });
      });
      if (!inserts.length && !updates.length) throw AppError('Please enter marks for at least one student.');
      if (updates.length) Db.updateMany(SHEET.RESULTS, updates);
      if (inserts.length) Db.insert(SHEET.RESULTS, inserts);
      if (!existing.length && p.notify !== false) Notifications.push(b.Batch, 'Results published: ' + exam, b.Subject, who);
      return { saved: inserts.length + updates.length, created: inserts.length, updated: updates.length };
    });
  },

  /** Student: own results grouped by exam with total / percentage / grade. */
  my: function (ctx) {
    var me = ctx.studentId, groups = {};
    Db.where(SHEET.RESULTS, function (r) { return r.StudentID === me; }).forEach(function (r) {
      var k = U.lc(r.Exam) + '|' + r.Batch.split('-')[0];
      var g = groups[k] = groups[k] || { exam: r.Exam, subjects: [], total: 0, maxTotal: 0, updatedAt: '' };
      g.subjects.push({ subject: r.Subject, marks: U.num(r.Marks), maxMarks: U.num(r.MaxMarks), percentage: U.num(r.Percentage), grade: r.Grade, remarks: r.Remarks });
      g.total += U.num(r.Marks); g.maxTotal += U.num(r.MaxMarks);
      if (r.UpdatedAt > g.updatedAt) g.updatedAt = r.UpdatedAt;
    });
    var items = Object.keys(groups).map(function (k) {
      var g = groups[k];
      g.total = U.round2(g.total); g.maxTotal = U.round2(g.maxTotal);
      g.percentage = Results._pct(g.total, g.maxTotal); g.grade = U.gradeFor(g.percentage);
      g.date = String(g.updatedAt).substr(0, 10);
      g.subjects.sort(function (a, b) { return U.cmp(a.subject, b.subject); });
      return g;
    }).sort(function (a, b) { return U.cmp(b.updatedAt, a.updatedAt); });
    return { items: items };
  },

  /** Admin: browse all results. */
  list: function (ctx, p) {
    var students = U.indexBy(Db.all(SHEET.STUDENTS), 'StudentID');
    var q = U.lc(p.q).trim(), exam = U.lc(p.exam).trim(), batch = String(p.batch || '').toUpperCase();
    var rows = Db.where(SHEET.RESULTS, function (r) {
      if (batch && r.Batch !== batch) return false;
      if (exam && U.lc(r.Exam).indexOf(exam) < 0) return false;
      if (q) {
        var s = students[r.StudentID];
        if (U.lc(r.StudentID).indexOf(q) < 0 && !(s && U.lc(s.Name).indexOf(q) >= 0)) return false;
      }
      return true;
    }).sort(function (a, b) { return U.cmp(b.UpdatedAt, a.UpdatedAt); });
    var page = U.paginate(rows, p);
    page.items = page.items.map(function (r) { return Results.view(r, students); });
    return page;
  },

  /** Admin: delete a whole exam of a batch, or one student's result in it. */
  remove: function (ctx, p) {
    var batch = Batches.norm(p.batch), exam = U.text(p.exam, 'Exam', { max: 60 }), sid = String(p.studentId || '').trim();
    return U.withLock(function () {
      var n = Db.deleteWhere(SHEET.RESULTS, function (r) {
        return r.Batch === batch && U.lc(r.Exam) === U.lc(exam) && (!sid || r.StudentID === sid);
      });
      if (!n) throw AppError('Nothing to delete.', 'NOT_FOUND');
      return { deleted: n };
    });
  }
};
