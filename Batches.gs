/**
 * ============================================================================
 *  Batches.gs — batches (class + subject + teacher + schedule) and the
 *  timetable, which is derived from the batch schedule text.
 * ============================================================================
 */
var Batches = {
  norm: function (name) { return String(name === null || name === undefined ? '' : name).trim().toUpperCase().replace(/\s+/g, '-'); },

  /** Validates that every batch exists and belongs to `cls`. Returns normalised names. */
  validateForClass: function (list, cls) {
    var out = [];
    U.uniq((Array.isArray(list) ? list : U.csv(list)).map(Batches.norm).filter(Boolean)).forEach(function (n) {
      var b = Db.get(SHEET.BATCHES, 'Batch', n);
      if (!b) throw AppError('Batch "' + n + '" does not exist.');
      if (String(b.Class) !== String(cls)) throw AppError('Batch "' + n + '" belongs to Class ' + b.Class + ', not Class ' + cls + '.');
      out.push(b.Batch);
    });
    return out;
  },

  counts: function () {
    var m = {};
    Db.all(SHEET.STUDENTS).forEach(function (s) {
      if (s.Status !== STATUS.ACTIVE) return;
      U.csv(s.Batch).forEach(function (b) { b = b.toUpperCase(); m[b] = (m[b] || 0) + 1; });
    });
    return m;
  },

  view: function (b, counts, teachers) {
    var sch = U.parseSchedule(b.Schedule);
    var t = teachers[b.Teacher];
    return {
      batch: b.Batch, class: String(b.Class), subject: b.Subject, teacherId: b.Teacher,
      teacherName: t ? t.Name : '', schedule: b.Schedule, days: sch.days, time: sch.time,
      startMin: sch.startMin, status: b.Status, students: counts[b.Batch] || 0
    };
  },

  /** Admin: all batches (filters). Teacher: own. Student: own. */
  list: function (ctx, p) {
    var teachers = U.indexBy(Db.all(SHEET.TEACHERS), 'TeacherID');
    var counts = Batches.counts();
    var readable = Access.readableBatchNames(ctx);
    var q = U.lc(p.q).trim(), cls = String(p.class || ''), status = String(p.status || '');
    var rows = Db.where(SHEET.BATCHES, function (b) {
      if (readable !== null && readable.indexOf(b.Batch) < 0) return false;
      if (ctx.role === ROLE.STUDENT && b.Status !== STATUS.ACTIVE) return false;
      if (cls && String(b.Class) !== cls) return false;
      if (status && b.Status !== status) return false;
      if (p.activeOnly && b.Status !== STATUS.ACTIVE) return false;
      if (q) {
        var t = teachers[b.Teacher];
        if (U.lc(b.Batch).indexOf(q) < 0 && U.lc(b.Subject).indexOf(q) < 0 && !(t && U.lc(t.Name).indexOf(q) >= 0)) return false;
      }
      return true;
    });
    rows.sort(function (a, b) { return U.cmp(String(a.Class).length + '|' + a.Class + a.Batch, String(b.Class).length + '|' + b.Class + b.Batch); });
    var items = rows.map(function (b) { return Batches.view(b, counts, teachers); });
    return { items: items, total: items.length };
  },

  roster: function (ctx, p) {
    var b = Access.requireBatch(ctx, p.batch);
    if (ctx.role === ROLE.STUDENT) throw AppError('You do not have access to this information.', 'FORBIDDEN');
    var items = Students.inBatch(b.Batch).map(function (s) { return { studentId: s.StudentID, name: s.Name, phone: s.Phone, class: String(s.Class) }; });
    return { batch: b.Batch, subject: b.Subject, items: items, total: items.length };
  },

  _fields: function (p, isNew) {
    var v = {};
    v.subject = U.text(p.subject, 'Subject', { max: 60 });
    var t = Db.get(SHEET.TEACHERS, 'TeacherID', String(p.teacher || '').trim());
    if (!t || t.Status !== STATUS.ACTIVE) throw AppError('Please choose an active teacher.');
    v.teacher = t.TeacherID;
    v.schedule = U.text(p.schedule, 'Schedule', { max: 80 });
    if (!U.parseSchedule(v.schedule).ok) throw AppError('Schedule must include the days, e.g. "Mon/Wed/Fri 5 PM" or "Mon-Sat 4:30 PM".');
    return v;
  },

  create: function (ctx, p) {
    var cls = Settings.validClass(p.class);
    var name = Batches.norm(p.batch);
    if (!/^[A-Z0-9][A-Z0-9-]{1,23}$/.test(name)) throw AppError('Batch name can only use letters, numbers and hyphens (max 24), e.g. 10-A-MATH.');
    if (name.indexOf(cls) !== 0) throw AppError('Batch name must start with the class number, e.g. ' + cls + '-A-MATH.');
    if (name === 'ALL' || /^CLASS_/.test(name)) throw AppError('That batch name is reserved.');
    var v = Batches._fields(p, true);
    return U.withLock(function () {
      if (Db.get(SHEET.BATCHES, 'Batch', name)) throw AppError('A batch with this name already exists.', 'CONFLICT');
      Db.insert(SHEET.BATCHES, { Batch: name, Class: cls, Subject: v.subject, Teacher: v.teacher, Schedule: v.schedule, Status: STATUS.ACTIVE });
      return { batch: name };
    });
  },

  update: function (ctx, p) {
    var v = Batches._fields(p, false);
    return U.withLock(function () {
      var b = Db.get(SHEET.BATCHES, 'Batch', Batches.norm(p.batch));
      if (!b) throw AppError('Batch not found.', 'NOT_FOUND');
      Db.update(SHEET.BATCHES, b, { Subject: v.subject, Teacher: v.teacher, Schedule: v.schedule });
      return { batch: b.Batch };
    });
  },

  setStatus: function (ctx, p) {
    var status = U.oneOf(String(p.status || '').toUpperCase(), [STATUS.ACTIVE, STATUS.INACTIVE], 'status');
    return U.withLock(function () {
      var b = Db.get(SHEET.BATCHES, 'Batch', Batches.norm(p.batch));
      if (!b) throw AppError('Batch not found.', 'NOT_FOUND');
      Db.update(SHEET.BATCHES, b, { Status: status });
      return { batch: b.Batch, status: status };
    });
  }
};

var Timetable = {
  /** Weekly timetable derived from the batch schedules the user may see. */
  get: function (ctx) {
    var res = Batches.list(ctx, { activeOnly: true });
    var items = res.items.filter(function (b) { return b.days.length > 0; });
    return { items: items, today: U.weekday(U.today()) };
  }
};
