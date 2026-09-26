/**
 * ============================================================================
 *  Teachers.gs — teacher profiles (Teachers sheet). Admin only.
 * ============================================================================
 */
var Teachers = {
  view: function (t, batchCount) {
    return {
      teacherId: t.TeacherID, userId: t.UserID, name: t.Name, subject: t.Subject,
      phone: t.Phone, status: t.Status, batches: batchCount || 0, createdAt: t.CreatedAt
    };
  },

  list: function (ctx, p) {
    var q = U.lc(p.q).trim(), status = String(p.status || '');
    var counts = {};
    Db.all(SHEET.BATCHES).forEach(function (b) { if (b.Status === STATUS.ACTIVE) counts[b.Teacher] = (counts[b.Teacher] || 0) + 1; });
    var rows = Db.where(SHEET.TEACHERS, function (t) {
      if (status && t.Status !== status) return false;
      if (q && U.lc(t.Name).indexOf(q) < 0 && U.lc(t.TeacherID).indexOf(q) < 0 && U.lc(t.Subject).indexOf(q) < 0) return false;
      return true;
    });
    rows.sort(function (a, b) { return U.cmp(U.lc(a.Name), U.lc(b.Name)); });
    var page = U.paginate(rows, p);
    page.items = page.items.map(function (t) { return Teachers.view(t, counts[t.TeacherID]); });
    return page;
  },

  create: function (ctx, p) {
    var name = U.text(p.name, 'Full name', { min: 2, max: 80 });
    var subject = U.text(p.subject, 'Subject', { max: 60 });
    var phone = U.phone(p.phone, 'Phone number');
    var generated = !p.password;
    var pw = generated ? U.randomPassword(10) : Auth.validPassword(p.password);
    return U.withLock(function () {
      var teacherId = Seq.next('TEACHER', 'TCH', 3, SHEET.TEACHERS, 'TeacherID');
      var userId = Users.create(ROLE.TEACHER, teacherId, pw, STATUS.ACTIVE);
      var now = U.now();
      Db.insert(SHEET.TEACHERS, { TeacherID: teacherId, UserID: userId, Name: name, Subject: subject, Phone: phone, Status: STATUS.ACTIVE, CreatedAt: now, UpdatedAt: now });
      var out = { teacherId: teacherId, username: teacherId };
      if (generated) out.password = pw;
      return out;
    });
  },

  update: function (ctx, p) {
    var name = U.text(p.name, 'Full name', { min: 2, max: 80 });
    var subject = U.text(p.subject, 'Subject', { max: 60 });
    var phone = U.phone(p.phone, 'Phone number');
    return U.withLock(function () {
      var t = Db.get(SHEET.TEACHERS, 'TeacherID', p.teacherId);
      if (!t) throw AppError('Teacher not found.', 'NOT_FOUND');
      Db.update(SHEET.TEACHERS, t, { Name: name, Subject: subject, Phone: phone, UpdatedAt: U.now() });
      return Teachers.view(t);
    });
  }
};
