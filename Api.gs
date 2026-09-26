/**
 * ============================================================================
 *  Api.gs — the ONLY entry points the browser can reach.
 *
 *    Frontend  ->  api(action, token, payload)  ->  route table (roles)
 *              ->  module (business rules + Access checks)  ->  Db (Sheets)
 *
 *  Every request: token is validated, the role is checked against the route
 *  table, then the module re-checks ownership (batch / student) itself.
 *  Errors never leak technical details: they are logged, and the user gets a
 *  friendly sentence.
 * ============================================================================
 */

/** Serves the single-page app. */
function doGet(e) {
  var name = 'Success Coaching Classes';
  try { name = Settings.get('InstituteName', name); } catch (err) {
    return HtmlService.createHtmlOutput(
      '<div style="font-family:Arial;max-width:520px;margin:15vh auto;text-align:center">' +
      '<h2>Portal not set up yet</h2><p>The administrator needs to run <b>Success Portal \u2192 Set up portal</b> ' +
      'from the Google Sheet menu first.</p></div>').setTitle(name);
  }
  var t = HtmlService.createTemplateFromFile('Index');
  t.appTitle = name;
  return t.evaluate()
    .setTitle(name + ' Portal')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Template helper: <?!= include('Styles') ?> */
function include(name) {
  if (!/^(Styles|Js_[A-Za-z]+)$/.test(String(name))) throw new Error('Invalid include');
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/** The single function called by google.script.run from the browser. */
function api(action, token, payload) {
  return Api.handle(String(action || ''), token, payload);
}

var Api = {
  handle: function (action, token, payload) {
    Db.resetMemo();
    var route = Api.routes()[action];
    if (!route) return { ok: false, error: 'Unknown request.', code: 'NOT_FOUND' };
    var ctx = null;
    try {
      if (!route.pub) {
        ctx = Auth.resolve(token);
        if (route.roles.indexOf(ctx.role) < 0) throw AppError('You do not have permission to do this.', 'FORBIDDEN');
      }
      var data = route.fn(ctx, (payload && typeof payload === 'object') ? payload : {});
      return { ok: true, data: data };
    } catch (e) {
      if (e && e.isAppError) return { ok: false, error: e.message, code: e.code };
      Log.error('api:' + action, e, { user: ctx ? ctx.userId : '' });
      return { ok: false, error: 'Something went wrong while ' + route.label + '. Please try again.', code: 'SERVER' };
    }
  },

  /** action -> { roles, fn(ctx,payload), label } (built lazily so file load order never matters). */
  routes: function () {
    if (Api._routes) return Api._routes;
    var A = [ROLE.ADMIN], T = [ROLE.TEACHER], S = [ROLE.STUDENT];
    var AT = A.concat(T), ALL = [ROLE.ADMIN, ROLE.TEACHER, ROLE.STUDENT];
    function r(roles, label, fn) { return { roles: roles, label: label, fn: fn }; }
    function pub(label, fn) { return { pub: true, roles: [], label: label, fn: fn }; }
    Api._routes = {
      // ---- public
      'public.info': pub('loading the page', function () { return Settings.publicInfo(); }),
      'auth.login': pub('signing in', function (c, p) { return Auth.login(p); }),
      'auth.registerStudent': pub('registering', function (c, p) { return Auth.registerStudent(p); }),
      'auth.registerTeacher': pub('registering', function (c, p) { return Auth.registerTeacher(p); }),
      // ---- session
      'auth.logout': r(ALL, 'signing out', Auth.logout),
      'auth.me': r(ALL, 'loading your profile', Auth.me),
      'auth.changePassword': r(ALL, 'changing the password', Auth.changePassword),
      // ---- accounts / approvals
      'users.pending': r(A, 'loading registrations', Users.pending),
      'users.approve': r(A, 'approving the registration', Users.approve),
      'users.reject': r(A, 'rejecting the registration', Users.reject),
      'users.setStatus': r(A, 'updating the account', Users.setStatus),
      'users.resetPassword': r(A, 'resetting the password', Users.resetPassword),
      // ---- people
      'students.list': r(AT, 'loading students', Students.list),
      'students.get': r(AT, 'loading the student', Students.get),
      'students.create': r(A, 'saving the student', Students.create),
      'students.update': r(A, 'saving the student', Students.update),
      'teachers.list': r(A, 'loading teachers', Teachers.list),
      'teachers.create': r(A, 'saving the teacher', Teachers.create),
      'teachers.update': r(A, 'saving the teacher', Teachers.update),
      'batches.list': r(ALL, 'loading batches', Batches.list),
      'batches.create': r(A, 'saving the batch', Batches.create),
      'batches.update': r(A, 'saving the batch', Batches.update),
      'batches.setStatus': r(A, 'updating the batch', Batches.setStatus),
      'batches.roster': r(AT, 'loading the batch students', Batches.roster),
      'timetable.get': r(ALL, 'loading the timetable', Timetable.get),
      // ---- attendance
      'attendance.sheet': r(AT, 'loading attendance', Attendance.sheet),
      'attendance.save': r(AT, 'saving attendance', Attendance.save),
      'attendance.history': r(AT, 'loading attendance history', Attendance.history),
      'attendance.report': r(AT, 'loading the attendance report', Attendance.report),
      'attendance.overview': r(A, 'loading attendance overview', Attendance.overview),
      'attendance.my': r(S, 'loading your attendance', Attendance.my),
      // ---- content
      'assignments.list': r(ALL, 'loading assignments', Assignments.list),
      'assignments.save': r(AT, 'saving the assignment', Assignments.save),
      'assignments.setStatus': r(AT, 'updating the assignment', Assignments.setStatus),
      'assignments.file': r(ALL, 'downloading the file', Assignments.file),
      'materials.list': r(ALL, 'loading study materials', Materials.list),
      'materials.save': r(AT, 'saving the study material', Materials.save),
      'materials.setStatus': r(AT, 'updating the study material', Materials.setStatus),
      'materials.file': r(ALL, 'downloading the file', Materials.file),
      'events.list': r(ALL, 'loading events', Events.list),
      'events.save': r(AT, 'saving the event', Events.save),
      'events.remove': r(AT, 'deleting the event', Events.remove),
      // ---- results
      'results.sheet': r(AT, 'loading results', Results.sheet),
      'results.exams': r(AT, 'loading exams', Results.exams),
      'results.save': r(AT, 'saving results', Results.save),
      'results.my': r(S, 'loading your results', Results.my),
      'results.list': r(A, 'loading results', Results.list),
      'results.remove': r(A, 'deleting results', Results.remove),
      // ---- fees / payments / receipts
      'fees.assign': r(A, 'assigning fees', Fees.assign),
      'fees.update': r(A, 'updating the fee', Fees.update),
      'fees.remove': r(A, 'deleting the fee', Fees.remove),
      'fees.outstanding': r(A, 'loading fees', Fees.outstanding),
      'fees.student': r(A, 'loading the student fees', Fees.student),
      'fees.my': r(S, 'loading your fees', Fees.my),
      'payments.record': r(A, 'recording the payment', Payments.record),
      'payments.list': r(A, 'loading payments', Payments.list),
      'receipts.get': r([ROLE.ADMIN, ROLE.STUDENT], 'opening the receipt', Receipts.get),
      'receipts.regenerate': r(A, 'generating the receipt', Receipts.regenerate),
      // ---- notifications / dashboard / settings
      'notifications.list': r(ALL, 'loading notifications', Notifications.list),
      'notifications.markRead': r(ALL, 'updating notifications', Notifications.markRead),
      'notifications.create': r(A, 'sending the notification', Notifications.create),
      'notifications.remove': r(A, 'deleting the notification', Notifications.remove),
      'dashboard.get': r(ALL, 'loading the dashboard', Dashboard.get),
      'settings.get': r(A, 'loading settings', Settings.full),
      'settings.save': r(A, 'saving settings', Settings.save),
      'settings.uploadLogo': r(A, 'uploading the logo', Settings.uploadLogo),
      'settings.removeLogo': r(A, 'removing the logo', Settings.removeLogo)
    };
    return Api._routes;
  }
};
