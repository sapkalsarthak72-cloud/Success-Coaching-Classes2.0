/**
 * ============================================================================
 *  Students.gs — student profiles (Students sheet).
 *  A student's `Batch` cell holds a comma separated list, e.g. "10-A-MATH, 10-A-SCI".
 * ============================================================================
 */
var Students = {
  view: function (s) {
    return {
      studentId: s.StudentID, userId: s.UserID, name: s.Name, class: String(s.Class),
      batches: U.csv(s.Batch), phone: s.Phone, status: s.Status, createdAt: s.CreatedAt
    };
  },

  /** Active students enrolled in a batch. */
  inBatch: function (batch) {
    return Db.where(SHEET.STUDENTS, function (s) { return s.Status === STATUS.ACTIVE && U.hasId(s.Batch, batch); })
      .sort(function (a, b) { return U.cmp(U.lc(a.Name), U.lc(b.Name)); });
  },

  /** Paged, filtered list. Admin sees everyone; a teacher only students of their own batches. */
  list: function (ctx, p) {
    var mine = null;
    if (ctx.role === ROLE.TEACHER) mine = Access.teacherBatches(ctx).map(function (b) { return b.Batch; });
    var q = U.lc(p.q).trim(), cls = String(p.class || ''), batch = String(p.batch || '').toUpperCase(), status = String(p.status || '');
    var rows = Db.where(SHEET.STUDENTS, function (s) {
      if (mine !== null) {
        if (s.Status !== STATUS.ACTIVE) return false;
        if (!U.csv(s.Batch).some(function (b) { return mine.indexOf(b.toUpperCase()) >= 0; })) return false;
      }
      if (cls && String(s.Class) !== cls) return false;
      if (batch && !U.hasId(s.Batch, batch)) return false;
      if (status && s.Status !== status) return false;
      if (q && (U.lc(s.Name).indexOf(q) < 0 && U.lc(s.StudentID).indexOf(q) < 0 && String(s.Phone).indexOf(q) < 0)) return false;
      return true;
    });
    rows.sort(function (a, b) { return U.cmp(U.lc(a.Name), U.lc(b.Name)); });
    var page = U.paginate(rows, p);
    page.items = page.items.map(Students.view);
    return page;
  },

  get: function (ctx, p) {
    return Students.view(Access.requireStudent(ctx, p.studentId));
  },

  create: function (ctx, p) {
    var name = U.text(p.name, 'Full name', { min: 2, max: 80 });
    var cls = Settings.validClass(p.class);
    var phone = U.phone(p.phone, 'Phone number');
    var batches = Batches.validateForClass(p.batches || [], cls);
    var generated = !p.password;
    var pw = generated ? U.randomPassword(10) : Auth.validPassword(p.password);
    return U.withLock(function () {
      var studentId = Seq.next('STUDENT', 'STU', 4, SHEET.STUDENTS, 'StudentID');
      var userId = Users.create(ROLE.STUDENT, studentId, pw, STATUS.ACTIVE);
      var now = U.now();
      Db.insert(SHEET.STUDENTS, { StudentID: studentId, UserID: userId, Name: name, Class: cls, Batch: batches.join(', '), Phone: phone, Status: STATUS.ACTIVE, CreatedAt: now, UpdatedAt: now });
      var out = { studentId: studentId, username: studentId };
      if (generated) out.password = pw;
      return out;
    });
  },

  update: function (ctx, p) {
    var name = U.text(p.name, 'Full name', { min: 2, max: 80 });
    var cls = Settings.validClass(p.class);
    var phone = U.phone(p.phone, 'Phone number');
    var batches = Batches.validateForClass(p.batches || [], cls);
    return U.withLock(function () {
      var s = Db.get(SHEET.STUDENTS, 'StudentID', p.studentId);
      if (!s) throw AppError('Student not found.', 'NOT_FOUND');
      Db.update(SHEET.STUDENTS, s, { Name: name, Class: cls, Batch: batches.join(', '), Phone: phone, UpdatedAt: U.now() });
      return Students.view(s);
    });
  }
};
