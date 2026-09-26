/**
 * ============================================================================
 *  Users.gs — accounts (Users sheet), registration approvals, (de)activation.
 *  Students.gs / Teachers.gs own the profile data; this owns the login data.
 * ============================================================================
 */
var Users = {
  byId: function (id) {
    var u = Db.get(SHEET.USERS, 'UserID', String(id || ''));
    if (!u) throw AppError('User not found.', 'NOT_FOUND');
    return u;
  },

  /** Creates a Users row (caller must hold the lock). Returns the new UserID. */
  create: function (role, username, password, status) {
    var uname = String(username).trim();
    if (Db.first(SHEET.USERS, function (u) { return U.lc(u.Username) === U.lc(uname); })) throw AppError('That username is already taken.', 'CONFLICT');
    var id = Seq.next('USER', 'USR', 5, SHEET.USERS, 'UserID');
    var now = U.now();
    Db.insert(SHEET.USERS, { UserID: id, Username: uname, AuthData: Auth.make(password), Role: role, Status: status, NotifSeenAt: now, CreatedAt: now, UpdatedAt: now });
    return id;
  },

  /** The Students/Teachers row belonging to a user. */
  profile: function (user) {
    if (user.Role === ROLE.STUDENT) {
      return { kind: 'student', sheet: SHEET.STUDENTS, row: Db.first(SHEET.STUDENTS, function (s) { return s.UserID === user.UserID; }) };
    }
    if (user.Role === ROLE.TEACHER) {
      return { kind: 'teacher', sheet: SHEET.TEACHERS, row: Db.first(SHEET.TEACHERS, function (t) { return t.UserID === user.UserID; }) };
    }
    return { kind: 'admin', sheet: null, row: null };
  },

  pending: function (ctx) {
    var students = Db.where(SHEET.STUDENTS, function (s) { return s.Status === STATUS.PENDING; })
      .sort(function (a, b) { return U.cmp(a.CreatedAt, b.CreatedAt); })
      .map(function (s) { return { userId: s.UserID, studentId: s.StudentID, name: s.Name, class: String(s.Class), phone: s.Phone, createdAt: s.CreatedAt }; });
    var teachers = Db.where(SHEET.TEACHERS, function (t) { return t.Status === STATUS.PENDING; })
      .sort(function (a, b) { return U.cmp(a.CreatedAt, b.CreatedAt); })
      .map(function (t) { return { userId: t.UserID, teacherId: t.TeacherID, name: t.Name, subject: t.Subject, phone: t.Phone, createdAt: t.CreatedAt }; });
    return { students: students, teachers: teachers, total: students.length + teachers.length };
  },

  approve: function (ctx, p) {
    return U.withLock(function () {
      var u = Users.byId(p.userId);
      if (u.Status !== STATUS.PENDING) throw AppError('This registration is no longer pending.');
      var prof = Users.profile(u), now = U.now();
      if (!prof.row) throw AppError('Profile not found for this account.', 'NOT_FOUND');
      var patch = { Status: STATUS.ACTIVE, UpdatedAt: now };
      if (prof.kind === 'student' && Array.isArray(p.batches) && p.batches.length) {
        patch.Batch = Batches.validateForClass(p.batches, prof.row.Class).join(', ');
      }
      Db.update(SHEET.USERS, u, { Status: STATUS.ACTIVE, NotifSeenAt: now, UpdatedAt: now });
      Db.update(prof.sheet, prof.row, patch);
      Auth.unrevoke(u.UserID);
      return { done: true };
    });
  },

  reject: function (ctx, p) {
    return U.withLock(function () {
      var u = Users.byId(p.userId);
      if (u.Status !== STATUS.PENDING) throw AppError('This registration is no longer pending.');
      var prof = Users.profile(u), now = U.now();
      Db.update(SHEET.USERS, u, { Status: STATUS.REJECTED, UpdatedAt: now });
      if (prof.row) Db.update(prof.sheet, prof.row, { Status: STATUS.REJECTED, UpdatedAt: now });
      return { done: true };
    });
  },

  /** Activate / deactivate a student or teacher account. */
  setStatus: function (ctx, p) {
    var status = U.oneOf(String(p.status || '').toUpperCase(), [STATUS.ACTIVE, STATUS.INACTIVE], 'status');
    return U.withLock(function () {
      var u = Users.byId(p.userId);
      if (u.Role === ROLE.ADMIN) throw AppError('Admin accounts cannot be changed here.', 'FORBIDDEN');
      if (u.UserID === ctx.userId) throw AppError('You cannot change your own account.', 'FORBIDDEN');
      if (u.Status === STATUS.PENDING) throw AppError('This registration is still pending. Please approve or reject it.');
      var prof = Users.profile(u), now = U.now();
      Db.update(SHEET.USERS, u, { Status: status, UpdatedAt: now });
      if (prof.row) Db.update(prof.sheet, prof.row, { Status: status, UpdatedAt: now });
      if (status === STATUS.INACTIVE) Auth.revoke(u.UserID); else Auth.unrevoke(u.UserID);
      return { done: true, status: status };
    });
  },

  /** Admin sets a new password for a student/teacher. Returns the password if it was generated. */
  resetPassword: function (ctx, p) {
    var generated = !p.password;
    var pw = generated ? U.randomPassword(10) : Auth.validPassword(p.password);
    return U.withLock(function () {
      var u = Users.byId(p.userId);
      if (u.Role === ROLE.ADMIN) throw AppError('Admin passwords cannot be reset here.', 'FORBIDDEN');
      Db.update(SHEET.USERS, u, { AuthData: Auth.make(pw), UpdatedAt: U.now() });
      Auth.revoke(u.UserID);
      return generated ? { password: pw, username: u.Username } : { done: true, username: u.Username };
    });
  }
};
