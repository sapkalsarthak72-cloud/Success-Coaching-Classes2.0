/**
 * ============================================================================
 *  Auth.gs — login, sessions, registration, password handling + Access helpers
 *
 *  SECURITY MODEL (see README "Security notes")
 *   - Web app runs as the owner and is open to everyone, so the portal does
 *     its OWN authentication. Every API call carries a random 64-char session
 *     token that is validated on the server (never trusted from the browser).
 *   - Passwords are stored as salted + peppered, iterated SHA-256 hashes
 *     (Apps Script has no bcrypt/argon2). AuthData = v1$iterations$salt$hash
 *   - Sessions live in CacheService (max 6 hours, sliding).
 *   - 5 wrong passwords lock that username for 15 minutes.
 * ============================================================================
 */
var Auth = (function () {
  function props() { return PropertiesService.getScriptProperties(); }
  function cache() { return CacheService.getScriptCache(); }

  function hash(password, salt, iterations) {
    var pep = props().getProperty('PEPPER') || '';
    var saltBytes = Utilities.newBlob(salt + '|' + pep).getBytes();
    var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + password + '|' + pep, Utilities.Charset.UTF_8);
    for (var i = 0; i < iterations; i++) {
      bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes.concat(saltBytes));
    }
    return Utilities.base64Encode(bytes);
  }

  function safeEqual(a, b) {
    if (a.length !== b.length) return false;
    var r = 0;
    for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
  }

  function make(password) {
    var salt = U.token().substr(0, 16);
    return 'v1$' + CFG.HASH_ITERATIONS + '$' + salt + '$' + hash(password, salt, CFG.HASH_ITERATIONS);
  }

  function verify(password, authData) {
    var p = String(authData || '').split('$');
    if (p.length !== 4 || p[0] !== 'v1') return false;
    return safeEqual(hash(password, p[2], parseInt(p[1], 10) || CFG.HASH_ITERATIONS), p[3]);
  }

  function validPassword(pw) {
    pw = String(pw === null || pw === undefined ? '' : pw);
    if (pw.length < 8) throw AppError('Password must be at least 8 characters long.');
    if (pw.length > 72) throw AppError('Password must be at most 72 characters long.');
    if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) throw AppError('Password must contain at least one letter and one number.');
    return pw;
  }

  function profileFor(user) {
    var out = { name: 'Administrator', studentId: '', teacherId: '' };
    if (user.Role === ROLE.STUDENT) {
      var s = Db.first(SHEET.STUDENTS, function (r) { return r.UserID === user.UserID; });
      if (!s) throw AppError('Your student profile could not be found. Please contact the institute.', 'INACTIVE');
      out.name = s.Name; out.studentId = s.StudentID; out.status = s.Status;
    } else if (user.Role === ROLE.TEACHER) {
      var t = Db.first(SHEET.TEACHERS, function (r) { return r.UserID === user.UserID; });
      if (!t) throw AppError('Your teacher profile could not be found. Please contact the institute.', 'INACTIVE');
      out.name = t.Name; out.teacherId = t.TeacherID; out.status = t.Status;
    }
    return out;
  }

  function ctxFromSession(token, s) {
    return { token: token, userId: s.uid, role: s.role, username: s.un, name: s.name, studentId: s.sid || '', teacherId: s.tid || '' };
  }

  function throttleRegistration() {
    var c = cache(), n = Number(c.get('reg:hour') || 0);
    if (n >= CFG.REGISTER_MAX_PER_HOUR) throw AppError('Too many registrations right now. Please try again later.', 'LOCKED');
    c.put('reg:hour', String(n + 1), 3600);
  }

  return {
    make: make,
    verify: verify,
    validPassword: validPassword,

    login: function (p) {
      var username = U.text(p.username, 'Username / ID', { max: 60 }).toLowerCase();
      var password = String(p.password === null || p.password === undefined ? '' : p.password);
      if (!password) throw AppError('Please enter your password.');
      var c = cache(), failKey = 'fail:' + username, fails = Number(c.get(failKey) || 0);
      if (fails >= CFG.LOGIN_MAX_FAILS) throw AppError('Too many failed attempts. Please wait 15 minutes and try again.', 'LOCKED');

      var user = Db.first(SHEET.USERS, function (u) { return U.lc(u.Username) === username; });
      var ok = false;
      if (user) ok = verify(password, user.AuthData);
      else hash(password, 'dummysalt0000000', CFG.HASH_ITERATIONS); // keep timing similar
      if (!ok) {
        c.put(failKey, String(fails + 1), CFG.LOGIN_LOCK_SEC);
        throw AppError('Incorrect username or password.', 'LOGIN');
      }
      if (user.Status === STATUS.PENDING) throw AppError('Your registration is waiting for approval by the institute. Please try again later.', 'PENDING');
      if (user.Status !== STATUS.ACTIVE) throw AppError('This account is not active. Please contact the institute.', 'INACTIVE');
      var prof = profileFor(user);
      if (prof.status && prof.status !== STATUS.ACTIVE) throw AppError('This account is not active. Please contact the institute.', 'INACTIVE');

      c.remove(failKey);
      var now = Date.now();
      var sess = { uid: user.UserID, role: user.Role, un: user.Username, name: prof.name, sid: prof.studentId, tid: prof.teacherId, iat: now, last: now };
      var token = U.token();
      c.put('sess:' + token, JSON.stringify(sess), CFG.SESSION_TTL_SEC);
      var ctx = ctxFromSession(token, sess);
      return { token: token, user: Auth.profile(ctx), info: Settings.publicInfo() };
    },

    logout: function (ctx) {
      cache().remove('sess:' + ctx.token);
      return { done: true };
    },

    /** Validates a token and returns the request context. Throws code AUTH if invalid. */
    resolve: function (token) {
      var bad = function () { return AppError('Your session has expired. Please log in again.', 'AUTH'); };
      if (!token || typeof token !== 'string' || token.length !== 64) throw bad();
      var c = cache(), raw = c.get('sess:' + token);
      if (!raw) throw bad();
      var s;
      try { s = JSON.parse(raw); } catch (e) { throw bad(); }
      var rev = c.get('revoked:' + s.uid);
      if (rev && Number(rev) > s.iat) { c.remove('sess:' + token); throw bad(); }
      var now = Date.now();
      if (now - s.last > CFG.SESSION_RENEW_SEC * 1000) {
        s.last = now;
        c.put('sess:' + token, JSON.stringify(s), CFG.SESSION_TTL_SEC);
      }
      return ctxFromSession(token, s);
    },

    /** Invalidate every existing session of a user (deactivation, password reset). */
    revoke: function (userId) { cache().put('revoked:' + userId, String(Date.now()), CFG.SESSION_TTL_SEC); },
    unrevoke: function (userId) { cache().remove('revoked:' + userId); },

    /** Safe (client-visible) description of the logged-in user. */
    profile: function (ctx) {
      var out = { userId: ctx.userId, username: ctx.username, role: ctx.role, name: ctx.name, studentId: ctx.studentId, teacherId: ctx.teacherId, class: '', batches: [], unread: 0 };
      if (ctx.role === ROLE.STUDENT) {
        var s = Db.get(SHEET.STUDENTS, 'StudentID', ctx.studentId);
        if (s) { out.class = String(s.Class); out.batches = U.csv(s.Batch); }
      } else if (ctx.role === ROLE.TEACHER) {
        out.batches = Access.teacherBatches(ctx).map(function (b) { return b.Batch; });
      }
      out.unread = Notifications.unreadCount(ctx);
      return out;
    },

    me: function (ctx) { return { user: Auth.profile(ctx), info: Settings.publicInfo() }; },

    changePassword: function (ctx, p) {
      var oldPw = String(p.oldPassword || ''), newPw = validPassword(p.newPassword);
      if (oldPw === newPw) throw AppError('The new password must be different from the current password.');
      return U.withLock(function () {
        var user = Db.get(SHEET.USERS, 'UserID', ctx.userId);
        if (!user || !verify(oldPw, user.AuthData)) throw AppError('Your current password is incorrect.');
        Db.update(SHEET.USERS, user, { AuthData: make(newPw), UpdatedAt: U.now() });
        return { done: true };
      });
    },

    registerStudent: function (p) {
      if (String(Settings.get('StudentRegistration', 'ON')).toUpperCase() !== 'ON') throw AppError('Student registration is currently closed. Please contact the institute.');
      throttleRegistration();
      var name = U.text(p.name, 'Full name', { min: 2, max: 80 });
      var cls = Settings.validClass(p.class);
      var phone = U.phone(p.phone, 'Phone number');
      var pw = validPassword(p.password);
      return U.withLock(function () {
        var dup = Db.first(SHEET.STUDENTS, function (s) { return U.lc(s.Name) === U.lc(name) && String(s.Phone) === phone && s.Status !== STATUS.REJECTED; });
        if (dup) throw AppError('A registration with these details already exists. If you registered earlier, please wait for approval or contact the institute.', 'CONFLICT');
        var studentId = Seq.next('STUDENT', 'STU', 4, SHEET.STUDENTS, 'StudentID');
        if (Db.first(SHEET.USERS, function (u) { return U.lc(u.Username) === U.lc(studentId); })) throw AppError('Could not create the account. Please try again.', 'CONFLICT');
        var userId = Users.create(ROLE.STUDENT, studentId, pw, STATUS.PENDING);
        var now = U.now();
        Db.insert(SHEET.STUDENTS, { StudentID: studentId, UserID: userId, Name: name, Class: cls, Batch: '', Phone: phone, Status: STATUS.PENDING, CreatedAt: now, UpdatedAt: now });
        return { id: studentId, username: studentId, status: STATUS.PENDING };
      });
    },

    registerTeacher: function (p) {
      if (String(Settings.get('TeacherRegistration', 'ON')).toUpperCase() !== 'ON') throw AppError('Teacher registration is currently closed. Please contact the institute.');
      throttleRegistration();
      var name = U.text(p.name, 'Full name', { min: 2, max: 80 });
      var subject = U.text(p.subject, 'Subject', { max: 60 });
      var phone = U.phone(p.phone, 'Phone number');
      var pw = validPassword(p.password);
      return U.withLock(function () {
        var dup = Db.first(SHEET.TEACHERS, function (t) { return U.lc(t.Name) === U.lc(name) && String(t.Phone) === phone && t.Status !== STATUS.REJECTED; });
        if (dup) throw AppError('A registration with these details already exists. If you registered earlier, please wait for approval or contact the institute.', 'CONFLICT');
        var teacherId = Seq.next('TEACHER', 'TCH', 3, SHEET.TEACHERS, 'TeacherID');
        var userId = Users.create(ROLE.TEACHER, teacherId, pw, STATUS.PENDING);
        var now = U.now();
        Db.insert(SHEET.TEACHERS, { TeacherID: teacherId, UserID: userId, Name: name, Subject: subject, Phone: phone, Status: STATUS.PENDING, CreatedAt: now, UpdatedAt: now });
        return { id: teacherId, username: teacherId, status: STATUS.PENDING };
      });
    }
  };
})();

/* ============================================================================
 *  Access — resource-level authorization. Called by every module.
 *  The frontend hides buttons, but THESE checks are what actually protect data.
 * ========================================================================== */
var Access = {
  teacherBatches: function (ctx) {
    return Db.where(SHEET.BATCHES, function (b) { return b.Teacher === ctx.teacherId; });
  },
  studentRow: function (ctx) {
    var s = Db.get(SHEET.STUDENTS, 'StudentID', ctx.studentId);
    if (!s) throw AppError('Student profile not found.', 'NOT_FOUND');
    return s;
  },
  studentBatchNames: function (ctx) {
    return U.csv(Access.studentRow(ctx).Batch).map(function (b) { return b.toUpperCase(); });
  },

  /** Batch names the current user may READ content for. null = everything (admin). */
  readableBatchNames: function (ctx) {
    if (ctx.role === ROLE.ADMIN) return null;
    if (ctx.role === ROLE.TEACHER) return Access.teacherBatches(ctx).map(function (b) { return b.Batch; });
    return Access.studentBatchNames(ctx);
  },

  /** Returns the batch row or throws. opts.write = must be allowed to modify + batch active. */
  requireBatch: function (ctx, name, opts) {
    opts = opts || {};
    var key = String(name === null || name === undefined ? '' : name).trim().toUpperCase();
    if (!key) throw AppError('Please choose a batch.');
    var b = Db.get(SHEET.BATCHES, 'Batch', key);
    if (!b) throw AppError('Batch not found.', 'NOT_FOUND');
    if (ctx.role === ROLE.TEACHER) {
      if (b.Teacher !== ctx.teacherId) throw AppError('You do not have access to this batch.', 'FORBIDDEN');
    } else if (ctx.role === ROLE.STUDENT) {
      if (opts.write || Access.studentBatchNames(ctx).indexOf(b.Batch) < 0) throw AppError('You do not have access to this batch.', 'FORBIDDEN');
    } else if (ctx.role !== ROLE.ADMIN) {
      throw AppError('You do not have access to this batch.', 'FORBIDDEN');
    }
    if (opts.write && b.Status !== STATUS.ACTIVE) throw AppError('This batch is not active.');
    return b;
  },

  /** Returns the student row if the current user may see this student. */
  requireStudent: function (ctx, studentId) {
    var s = Db.get(SHEET.STUDENTS, 'StudentID', String(studentId || '').trim());
    if (!s) throw AppError('Student not found.', 'NOT_FOUND');
    if (ctx.role === ROLE.ADMIN) return s;
    if (ctx.role === ROLE.STUDENT) {
      if (s.StudentID !== ctx.studentId) throw AppError('You do not have access to this information.', 'FORBIDDEN');
      return s;
    }
    if (ctx.role === ROLE.TEACHER) {
      var mine = Access.teacherBatches(ctx).map(function (b) { return b.Batch; });
      var ok = U.csv(s.Batch).some(function (b) { return mine.indexOf(b.toUpperCase()) >= 0; });
      if (!ok) throw AppError('You do not have access to this student.', 'FORBIDDEN');
      return s;
    }
    throw AppError('You do not have access to this information.', 'FORBIDDEN');
  },

  /** Targets ('ALL', 'CLASS_10', '10-A-MATH', 'STU0001') that this user can see. null = all (admin). */
  visibleTargets: function (ctx) {
    if (ctx.role === ROLE.ADMIN) return null;
    if (ctx.role === ROLE.STUDENT) {
      var s = Access.studentRow(ctx);
      return ['ALL', 'CLASS_' + s.Class, s.StudentID].concat(U.csv(s.Batch).map(function (b) { return b.toUpperCase(); }));
    }
    var bs = Access.teacherBatches(ctx), t = ['ALL', ctx.teacherId];
    bs.forEach(function (b) { t.push(b.Batch); t.push('CLASS_' + b.Class); });
    return U.uniq(t);
  },

  /**
   * Validates & normalises a notification/event target for the current user.
   *  - admin: ALL, CLASS_x, any batch, (opts.allowStudent) a StudentID
   *  - teacher: only their own active batches
   */
  normalizeTarget: function (ctx, target, opts) {
    opts = opts || {};
    var s = String(target === null || target === undefined ? '' : target).trim().toUpperCase();
    if (!s) throw AppError('Please choose who this is for.');
    if (s === 'ALL') {
      if (ctx.role !== ROLE.ADMIN) throw AppError('Only the admin can send to everyone.', 'FORBIDDEN');
      return 'ALL';
    }
    var m = /^CLASS_(.+)$/.exec(s);
    if (m) {
      if (ctx.role !== ROLE.ADMIN) throw AppError('Only the admin can send to a whole class.', 'FORBIDDEN');
      return 'CLASS_' + Settings.validClass(m[1]);
    }
    var b = Db.get(SHEET.BATCHES, 'Batch', s);
    if (b) return Access.requireBatch(ctx, s, { write: true }).Batch;
    if (opts.allowStudent && ctx.role === ROLE.ADMIN && Db.get(SHEET.STUDENTS, 'StudentID', s)) return s;
    throw AppError('Please choose a valid target.');
  },

  /** Does a notification/event target apply to a set of visible targets? */
  targetVisible: function (target, visible) {
    return visible === null || visible.indexOf(String(target).toUpperCase()) >= 0;
  }
};
