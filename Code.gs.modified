// ======================================================================
// FILE: Config.gs
// ======================================================================
/**
 * ============================================================================
 *  SUCCESS COACHING CLASSES PORTAL  —  Config.gs
 *  Constants, sheet schemas and default settings.
 *  Nothing here talks to Google services, so it is safe to load first.
 * ============================================================================
 */

var CFG = {
  SESSION_TTL_SEC: 21600,      // 6 hours (Apps Script CacheService maximum)
  SESSION_RENEW_SEC: 900,      // slide the session every 15 minutes of activity
  HASH_ITERATIONS: 300,        // password hashing rounds (see README: security notes)
  LOGIN_MAX_FAILS: 5,
  LOGIN_LOCK_SEC: 900,
  REGISTER_MAX_PER_HOUR: 40,
  MAX_FILE_BYTES: 10 * 1024 * 1024,
  MAX_LOGO_BYTES: 300 * 1024,
  PAGE_SIZE: 25,
  MAX_PAGE_SIZE: 100,
  TEACHER_BACKDATE_DAYS: 30,   // teachers may edit attendance up to N days back
  LOCK_WAIT_MS: 25000,
  CACHE_TTL_SEC: 300
};

var ROLE = { ADMIN: 'ADMIN', TEACHER: 'TEACHER', STUDENT: 'STUDENT' };
var STATUS = { ACTIVE: 'ACTIVE', PENDING: 'PENDING', INACTIVE: 'INACTIVE', REJECTED: 'REJECTED' };

var SHEET = {
  USERS: 'Users',
  STUDENTS: 'Students',
  TEACHERS: 'Teachers',
  BATCHES: 'Batches',
  ATTENDANCE: 'Attendance',
  ASSIGNMENTS: 'Assignments',
  MATERIALS: 'Materials',
  FEES: 'Fees',
  PAYMENTS: 'Payments',
  RESULTS: 'Results',
  NOTIFICATIONS: 'Notifications',
  EVENTS: 'Events',
  SETTINGS: 'Settings'
};

/** Column order of every sheet. Row 1 of each sheet is created from this. */
var SCHEMA = {
  Users: ['UserID', 'Username', 'AuthData', 'Role', 'Status', 'NotifSeenAt', 'CreatedAt', 'UpdatedAt'],
  Students: ['StudentID', 'UserID', 'Name', 'Class', 'Batch', 'Phone', 'Status', 'CreatedAt', 'UpdatedAt'],
  Teachers: ['TeacherID', 'UserID', 'Name', 'Subject', 'Phone', 'Status', 'CreatedAt', 'UpdatedAt'],
  Batches: ['Batch', 'Class', 'Subject', 'Teacher', 'Schedule', 'Status'],
  // One row per batch per day (see README "Attendance design")
  Attendance: ['Date', 'Batch', 'Present', 'Absent', 'PresentIDs', 'AbsentIDs', 'Remarks', 'MarkedBy', 'UpdatedAt'],
  Assignments: ['AssignmentID', 'Batch', 'Subject', 'Title', 'Description', 'FileID', 'FileName', 'IssueDate', 'DueDate', 'Status', 'CreatedBy', 'CreatedAt'],
  Materials: ['MaterialID', 'Batch', 'Subject', 'Title', 'Description', 'FileID', 'FileName', 'Date', 'Status', 'CreatedBy'],
  Fees: ['StudentID', 'FeeType', 'TotalFee', 'Discount', 'FinalFee', 'Paid', 'Remaining', 'Status', 'DueDate', 'UpdatedAt'],
  Payments: ['PaymentID', 'StudentID', 'FeeType', 'Amount', 'Date', 'PaymentMode', 'ReceiptNumber', 'PreviousBalance', 'RemainingBalance', 'Notes', 'ReceiptFileID', 'CreatedBy', 'CreatedAt'],
  Results: ['Exam', 'Batch', 'Subject', 'StudentID', 'Marks', 'MaxMarks', 'Percentage', 'Grade', 'Remarks', 'EnteredBy', 'UpdatedAt'],
  Notifications: ['NotificationID', 'Date', 'Target', 'Title', 'Message', 'CreatedBy'],
  Events: ['EventID', 'Title', 'Description', 'EventType', 'Date', 'Time', 'Target', 'CreatedBy', 'CreatedAt'],
  Settings: ['Key', 'Value', 'Description']
};

/** Columns stored as real numbers. Everything else is stored as plain text. */
var NUMERIC_COLS = {
  Attendance: ['Present', 'Absent'],
  Fees: ['TotalFee', 'Discount', 'FinalFee', 'Paid', 'Remaining'],
  Payments: ['Amount', 'PreviousBalance', 'RemainingBalance'],
  Results: ['Marks', 'MaxMarks', 'Percentage']
};

/** [Key, Value, Description] — written to the Settings sheet on first setup only. */
var DEFAULT_SETTINGS = [
  ['InstituteName', 'SUCCESS COACHING CLASSES', 'Name shown on login page, header and receipts'],
  ['Logo', '', 'Drive file ID of the logo (upload it from Settings in the portal)'],
  ['Address', 'Your institute address here', 'Printed on receipts'],
  ['Phone', '+91 00000 00000', 'Printed on receipts'],
  ['Email', 'info@example.com', 'Contact email'],
  ['ReceiptPrefix', 'SCC', 'Prefix of receipt numbers, e.g. SCC-2627-000001'],
  ['AcademicYear', '2026-27', 'Current academic year'],
  ['AllowedClasses', '8,9,10', 'Comma separated list of classes supported by the portal'],
  ['StudentRegistration', 'ON', 'ON = students may self-register (needs admin approval), OFF = closed'],
  ['TeacherRegistration', 'ON', 'ON = teachers may self-register (needs admin approval), OFF = closed'],
  ['LowAttendanceThreshold', '75', 'Attendance % below this is highlighted as low']
];

var PAYMENT_MODES = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE'];
var EVENT_TYPES = ['Test', 'Holiday', 'Special Class', 'Parent Meeting', 'Institute Event'];
var GRADE_SCALE = [
  { min: 90, grade: 'A+' }, { min: 80, grade: 'A' }, { min: 70, grade: 'B+' },
  { min: 60, grade: 'B' }, { min: 50, grade: 'C' }, { min: 40, grade: 'D' }, { min: 0, grade: 'F' }
];
var UPLOAD_KINDS = {
  assignment: ['pdf'],
  material: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png'],
  logo: ['png', 'jpg', 'jpeg']
};

// ======================================================================
// FILE: Utils.gs
// ======================================================================
/**
 * ============================================================================
 *  Utils.gs — small, dependency-free helpers used by every module.
 * ============================================================================
 */

/** Business/validation error. Its message is safe to show to the user. */
function AppError(message, code) {
  var e = new Error(message);
  e.name = 'AppError';
  e.code = code || 'VALIDATION';
  e.isAppError = true;
  return e;
}

/** Server-side logging. Technical details go here, never to the user. */
var Log = {
  error: function (where, err, extra) {
    try {
      console.error('[' + where + '] ' + (err && err.stack ? err.stack : String(err)) + (extra ? ' | ' + JSON.stringify(extra) : ''));
    } catch (e) { /* ignore */ }
  },
  info: function (msg) { try { console.log(msg); } catch (e) { /* ignore */ } }
};

var U = {
  _lockDepth: 0,

  /* ------------------------------------------------------------ time --- */
  tz: function () { return Session.getScriptTimeZone() || 'Asia/Kolkata'; },
  now: function () { return Utilities.formatDate(new Date(), U.tz(), 'yyyy-MM-dd HH:mm:ss'); },
  nowMs: function () { return Utilities.formatDate(new Date(), U.tz(), 'yyyy-MM-dd HH:mm:ss.SSS'); },
  today: function () { return Utilities.formatDate(new Date(), U.tz(), 'yyyy-MM-dd'); },
  thisMonth: function () { return U.today().substr(0, 7); },
  pad: function (n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; },

  /** 'yyyy-MM-dd' -> Date at 12:00 UTC (timezone / DST safe), or null. */
  parseDate: function (s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
    if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null;
    return d;
  },
  fmtDate: function (d) { return d.getUTCFullYear() + '-' + U.pad(d.getUTCMonth() + 1, 2) + '-' + U.pad(d.getUTCDate(), 2); },
  addDays: function (s, n) { var d = U.parseDate(s); d.setUTCDate(d.getUTCDate() + n); return U.fmtDate(d); },
  daysBetween: function (a, b) { return Math.round((U.parseDate(b) - U.parseDate(a)) / 86400000); },
  weekday: function (s) { return U.parseDate(s).getUTCDay(); },
  prettyDate: function (s) {
    var d = U.parseDate(String(s || '').substr(0, 10));
    if (!d) return String(s || '');
    var mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return d.getUTCDate() + ' ' + mo[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  },
  monthStart: function (ym) { return ym + '-01'; },
  monthEnd: function (ym) {
    var y = +ym.substr(0, 4), m = +ym.substr(5, 2);
    return U.fmtDate(new Date(Date.UTC(y, m, 0, 12)));
  },

  /** Normalise a cell value coming back from a sheet. */
  norm: function (v) {
    if (v === null || v === undefined) return '';
    if (Object.prototype.toString.call(v) === '[object Date]') {
      var s = Utilities.formatDate(v, U.tz(), 'yyyy-MM-dd HH:mm:ss');
      return s.substr(11) === '00:00:00' ? s.substr(0, 10) : s;
    }
    if (typeof v === 'string') return v.trim();
    return v;
  },

  /* ------------------------------------------------------ primitives --- */
  lc: function (v) { return String(v === null || v === undefined ? '' : v).toLowerCase(); },
  num: function (v) { var n = Number(v); return isNaN(n) ? 0 : n; },
  round2: function (n) { return Math.round((Number(n) + 1e-9) * 100) / 100; },
  csv: function (s) {
    return String(s === null || s === undefined ? '' : s).split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  },
  uniq: function (arr) { var seen = {}; return arr.filter(function (x) { if (seen[x]) return false; seen[x] = true; return true; }); },
  hasId: function (csvString, id) { return (',' + String(csvString || '').replace(/\s+/g, '') + ',').indexOf(',' + id + ',') >= 0; },
  indexBy: function (arr, key) { var m = {}; arr.forEach(function (x) { m[x[key]] = x; }); return m; },
  pick: function (obj, keys) { var o = {}; keys.forEach(function (k) { o[k] = obj[k]; }); return o; },
  cmp: function (a, b) { return a < b ? -1 : (a > b ? 1 : 0); },
  esc: function (s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  },
  initials: function (name) {
    var p = String(name || '').replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return 'SC';
    return (p[0].charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase();
  },

  token: function () { return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); },
  randomPassword: function (len) {
    len = len || 10;
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    var digits = '23456789';
    var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + String(Math.random()) + String(new Date().getTime()));
    var out = '';
    for (var i = 0; i < len - 2; i++) out += chars.charAt(Math.abs(bytes[i]) % chars.length);
    return out + digits.charAt(Math.abs(bytes[len]) % digits.length) + digits.charAt(Math.abs(bytes[len + 1]) % digits.length);
  },

  /* ------------------------------------------------------ validation --- */
  text: function (v, label, o) {
    o = o || {};
    var s = (v === null || v === undefined) ? '' : String(v);
    s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
    s = o.multiline ? s.replace(/[ \t]+/g, ' ') : s.replace(/\s+/g, ' ');
    if (!s) {
      if (o.required === false) return '';
      throw AppError(label + ' is required.');
    }
    if (o.min && s.length < o.min) throw AppError(label + ' must be at least ' + o.min + ' characters.');
    var max = o.max || 200;
    if (s.length > max) throw AppError(label + ' must be at most ' + max + ' characters.');
    return s;
  },
  date: function (v, label, o) {
    o = o || {};
    var s = String(v === null || v === undefined ? '' : v).trim();
    if (!s) {
      if (o.required === false) return '';
      throw AppError(label + ' is required.');
    }
    if (!U.parseDate(s)) throw AppError(label + ' is not a valid date.');
    return s;
  },
  month: function (v) {
    var s = String(v || '').trim();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) throw AppError('Invalid month.');
    return s;
  },
  phone: function (v, label) {
    var s = String(v || '').replace(/[\s\-()]/g, '');
    if (/^\+?91\d{10}$/.test(s)) s = s.slice(-10);   // drop country code only when a full 10-digit number follows
    if (!/^\d{10}$/.test(s)) throw AppError((label || 'Phone number') + ' must be a valid 10-digit number.');
    return s;
  },
  oneOf: function (v, list, label) {
    var s = String(v === null || v === undefined ? '' : v).trim();
    if (list.indexOf(s) < 0) throw AppError('Please choose a valid ' + label + '.');
    return s;
  },
  money: function (v, label, o) {
    o = o || {};
    var n = Number(v);
    if (v === '' || v === null || v === undefined || isNaN(n) || !isFinite(n)) throw AppError(label + ' must be a number.');
    n = U.round2(n);
    if (n < (o.min === undefined ? 0 : o.min)) throw AppError(label + ' cannot be less than ' + (o.min === undefined ? 0 : o.min) + '.');
    if (o.positive && n <= 0) throw AppError(label + ' must be greater than zero.');
    if (n > (o.max || 10000000)) throw AppError(label + ' is too large.');
    return n;
  },
  paginate: function (list, p) {
    p = p || {};
    var size = Math.min(Math.max(parseInt(p.pageSize, 10) || CFG.PAGE_SIZE, 1), CFG.MAX_PAGE_SIZE);
    var page = Math.max(parseInt(p.page, 10) || 1, 1);
    var total = list.length;
    var pages = Math.max(Math.ceil(total / size), 1);
    if (page > pages) page = pages;
    var start = (page - 1) * size;
    return { items: list.slice(start, start + size), total: total, page: page, pageSize: size, pages: pages };
  },

  /** Best-effort cache write: the cache is an optimisation, so a failure (e.g. value too big) is ignored. */
  cachePut: function (key, str, ttl) {
    try { if (str.length < 80000) CacheService.getScriptCache().put(key, str, ttl); } catch (e) { /* ignore */ }
  },

  /* --------------------------------------------------------- locking --- */
  /** Runs fn while holding the script lock (re-entrant, with fresh reads). */
  withLock: function (fn) {
    if (U._lockDepth > 0) return fn();
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(CFG.LOCK_WAIT_MS)) throw AppError('The system is busy right now. Please try again in a few seconds.', 'BUSY');
    U._lockDepth++;
    try {
      Db.resetMemo();
      return fn();
    } finally {
      U._lockDepth--;
      lock.releaseLock();
    }
  },

  /* --------------------------------------------------------- grades ---- */
  gradeFor: function (pct) {
    for (var i = 0; i < GRADE_SCALE.length; i++) if (pct >= GRADE_SCALE[i].min) return GRADE_SCALE[i].grade;
    return 'F';
  },

  /* ------------------------------------------------------- schedules --- */
  /**
   * Understands things like "Mon/Wed/Fri 5 PM", "Mon-Sat 4:30 PM - 6 PM", "Daily 7 AM".
   * Returns { ok, days:[0-6], time:'5:00 PM', startMin }.
   */
  parseSchedule: function (str) {
    var s = String(str || '').toLowerCase();
    var names = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    var days = [];
    var dayRe = /\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b(?:\s*(?:-|\u2013|to)\s*\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b)?/g;
    if (/\b(daily|everyday|every day)\b/.test(s)) days = [1, 2, 3, 4, 5, 6];
    else if (/\bweekdays?\b/.test(s)) days = [1, 2, 3, 4, 5];
    else {
      var m;
      while ((m = dayRe.exec(s)) !== null) {
        var a = names.indexOf(m[1]);
        if (m[2]) {
          var b = names.indexOf(m[2]), i = a, guard = 0;
          while (guard++ < 8) { days.push(i); if (i === b) break; i = (i + 1) % 7; }
        } else days.push(a);
      }
    }
    days = U.uniq(days).sort(function (x, y) { return x - y; });

    var rest = s.replace(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/g, ' ').replace(/\b(daily|everyday|every day|weekdays?)\b/g, ' ');
    var tm = /(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?(?:\s*(?:-|\u2013|to)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?)?/.exec(rest);
    var time = '', startMin = 24 * 60;
    if (tm) {
      var h1 = parseInt(tm[1], 10), m1 = tm[2] ? parseInt(tm[2], 10) : 0;
      var ap1 = tm[3] || tm[6] || '';
      if (h1 >= 1 && h1 <= 12 && m1 < 60) {
        if (!ap1) ap1 = h1 < 7 ? 'pm' : 'am';
        var f = function (h, mi, ap) { return h + ':' + U.pad(mi, 2) + ' ' + ap.toUpperCase(); };
        time = f(h1, m1, ap1);
        if (tm[4]) {
          var h2 = parseInt(tm[4], 10), m2 = tm[5] ? parseInt(tm[5], 10) : 0;
          var ap2 = tm[6] || ap1;
          if (h2 >= 1 && h2 <= 12 && m2 < 60) time += ' - ' + f(h2, m2, ap2);
        }
        startMin = ((h1 % 12) + (ap1 === 'pm' ? 12 : 0)) * 60 + m1;
      }
    }
    return { ok: days.length > 0, days: days, time: time, startMin: startMin };
  },

  /* ----------------------------------------------------- amount words --- */
  amountInWords: function (amount) {
    var ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    var tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    function two(n) { return n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : ''); }
    function three(n) {
      var h = Math.floor(n / 100), r = n % 100;
      return (h ? ones[h] + ' Hundred' + (r ? ' ' : '') : '') + (r ? two(r) : '');
    }
    function words(n) {
      if (n === 0) return 'Zero';
      var parts = [];
      var cr = Math.floor(n / 10000000); n = n % 10000000;
      var lk = Math.floor(n / 100000); n = n % 100000;
      var th = Math.floor(n / 1000); n = n % 1000;
      if (cr) parts.push(three(cr) + ' Crore');
      if (lk) parts.push(two(lk) + ' Lakh');
      if (th) parts.push(two(th) + ' Thousand');
      if (n) parts.push(three(n));
      return parts.join(' ');
    }
    var rupees = Math.floor(amount), paise = Math.round((amount - rupees) * 100);
    if (paise === 100) { rupees++; paise = 0; }
    var s = 'Rupees ' + words(rupees);
    if (paise) s += ' and ' + words(paise) + ' Paise';
    return s + ' Only';
  },

  safeFileName: function (name) {
    var s = String(name || 'file').replace(/[^A-Za-z0-9._ -]/g, '_').replace(/_{2,}/g, '_').trim();
    return s.length > 80 ? s.substr(s.length - 80) : s;
  }
};

// ======================================================================
// FILE: Db.gs
// ======================================================================
/**
 * ============================================================================
 *  Db.gs — REPOSITORY / DATA LAYER
 *
 *  The ONLY file (with Setup.gs and the Files helper) that talks to
 *  SpreadsheetApp. Business modules call Db.all / Db.insert / Db.update ...
 *  so that Google Sheets can later be replaced by SQL by re-implementing
 *  just this file.
 *
 *  Performance rules:
 *   - a sheet is read ONCE per request (memoised) with a single getValues()
 *   - inserts / bulk updates are written with a single setValues()
 *   - small, rarely-changing sheets (Batches, Settings) are also cached
 *     across requests for a few minutes.
 * ============================================================================
 */
var Db = (function () {
  var ssObj = null;
  var memo = {};   // sheetName -> { headers, rows[] }   (per request)
  var idx = {};    // 'sheet|key' -> { value: row }       (per request)
  var CACHED = { Batches: true, Settings: true };

  function spreadsheet() {
    if (ssObj) return ssObj;
    var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    ssObj = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
    if (!ssObj) throw AppError('The portal has not been set up yet. Please contact the administrator.', 'SETUP');
    return ssObj;
  }

  function sheet(name) {
    var sh = spreadsheet().getSheetByName(name);
    if (!sh) throw AppError('The portal database is not ready. Please contact the administrator.', 'SETUP');
    return sh;
  }

  function toArr(t, o) {
    return t.headers.map(function (h) {
      var v = o[h];
      return (v === undefined || v === null) ? '' : v;
    });
  }

  function formatsFor(name, headers) {
    var num = NUMERIC_COLS[name] || [];
    return headers.map(function (h) {
      if (num.indexOf(h) < 0) return '@';
      return (h === 'Present' || h === 'Absent') ? '0' : '0.00';
    });
  }

  function applyFormats(sh, name, headers, startRow, numRows) {
    if (numRows < 1) return;
    var f = formatsFor(name, headers), matrix = [];
    for (var i = 0; i < numRows; i++) matrix.push(f);
    sh.getRange(startRow, 1, numRows, headers.length).setNumberFormats(matrix);
  }

  function invalidate(name) {
    delete memo[name];
    Object.keys(idx).forEach(function (k) { if (k.indexOf(name + '|') === 0) delete idx[k]; });
    if (CACHED[name]) { try { CacheService.getScriptCache().remove('db:' + name); } catch (e) { /* ignore */ } }
  }

  function load(name) {
    if (memo[name]) return memo[name];
    var raw = null, cache = null;
    if (CACHED[name]) {
      cache = CacheService.getScriptCache();
      var c = cache.get('db:' + name);
      if (c) { try { raw = JSON.parse(c); } catch (e) { raw = null; } }
    }
    if (!raw) {
      var sh = sheet(name);
      var values = sh.getDataRange().getValues();
      var headers = values[0].map(function (h) { return String(h).trim(); });
      var body = values.slice(1).map(function (r) { return r.map(U.norm); });
      raw = { headers: headers, values: body };
      if (cache) U.cachePut('db:' + name, JSON.stringify(raw), CFG.CACHE_TTL_SEC);
    }
    var rows = [];
    raw.values.forEach(function (r, i) {
      var blank = true;
      for (var k = 0; k < r.length; k++) { if (r[k] !== '') { blank = false; break; } }
      if (blank) return;
      var o = { _row: i + 2 };
      for (var c2 = 0; c2 < raw.headers.length; c2++) o[raw.headers[c2]] = (r[c2] === undefined ? '' : r[c2]);
      rows.push(o);
    });
    memo[name] = { headers: raw.headers, rows: rows };
    return memo[name];
  }

  return {
    /** Forget everything read so far in this request (called at request start / lock start). */
    resetMemo: function () { memo = {}; idx = {}; },
    invalidate: invalidate,
    applyFormats: applyFormats,
    sheet: sheet,
    spreadsheet: spreadsheet,

    /** All rows of a sheet as objects (each has _row = sheet row number). Treat as READ-ONLY. */
    all: function (name) { return load(name).rows; },
    where: function (name, fn) { return load(name).rows.filter(fn); },
    first: function (name, fn) {
      var rows = load(name).rows;
      for (var i = 0; i < rows.length; i++) if (fn(rows[i])) return rows[i];
      return null;
    },
    /** Fast lookup by unique column value (index built once per request). */
    get: function (name, key, value) {
      var ik = name + '|' + key;
      if (!idx[ik]) {
        var m = {};
        load(name).rows.forEach(function (r) { var k = String(r[key]); if (!(k in m)) m[k] = r; });
        idx[ik] = m;
      }
      return idx[ik][String(value)] || null;
    },
    count: function (name) { return load(name).rows.length; },

    /** Append one object or an array of objects with a single write. Returns the new row objects. */
    insert: function (name, objs) {
      if (!Array.isArray(objs)) objs = [objs];
      if (!objs.length) return [];
      var t = load(name), sh = sheet(name);
      var start = sh.getLastRow() + 1, n = objs.length, needed = start + n - 1;
      if (needed > sh.getMaxRows()) {
        var add = needed - sh.getMaxRows() + 200, oldMax = sh.getMaxRows();
        sh.insertRowsAfter(oldMax, add);
        applyFormats(sh, name, t.headers, oldMax + 1, add);
      }
      var matrix = objs.map(function (o) { return toArr(t, o); });
      sh.getRange(start, 1, n, t.headers.length).setValues(matrix);
      var created = objs.map(function (o, i) {
        var row = { _row: start + i };
        t.headers.forEach(function (h) { row[h] = (o[h] === undefined || o[h] === null) ? '' : o[h]; });
        t.rows.push(row);
        return row;
      });
      Object.keys(idx).forEach(function (k) { if (k.indexOf(name + '|') === 0) delete idx[k]; });
      if (CACHED[name]) { try { CacheService.getScriptCache().remove('db:' + name); } catch (e) { /* ignore */ } }
      return created;
    },

    /** Update several rows. pairs = [[rowObject, {col: newValue, ...}], ...] */
    updateMany: function (name, pairs) {
      if (!pairs.length) return;
      var t = load(name), sh = sheet(name);
      pairs.forEach(function (p) {
        Object.keys(p[1]).forEach(function (k) {
          if (t.headers.indexOf(k) < 0) throw new Error('Unknown column "' + k + '" in sheet ' + name);
          p[0][k] = p[1][k];
        });
      });
      if (pairs.length <= 6) {
        pairs.forEach(function (p) { sh.getRange(p[0]._row, 1, 1, t.headers.length).setValues([toArr(t, p[0])]); });
      } else {
        var min = Infinity, max = 0, byRow = {};
        t.rows.forEach(function (r) { byRow[r._row] = r; });
        pairs.forEach(function (p) { min = Math.min(min, p[0]._row); max = Math.max(max, p[0]._row); });
        var blank = t.headers.map(function () { return ''; }), block = [];
        for (var r = min; r <= max; r++) block.push(byRow[r] ? toArr(t, byRow[r]) : blank);
        sh.getRange(min, 1, block.length, t.headers.length).setValues(block);
      }
      Object.keys(idx).forEach(function (k) { if (k.indexOf(name + '|') === 0) delete idx[k]; });
      if (CACHED[name]) { try { CacheService.getScriptCache().remove('db:' + name); } catch (e) { /* ignore */ } }
    },
    update: function (name, row, patch) { this.updateMany(name, [[row, patch]]); return row; },

    /** Delete every row matching fn (rewrites the data block once). Returns number removed. */
    deleteWhere: function (name, fn) {
      var t = load(name), sh = sheet(name), lastRow = sh.getLastRow();
      if (lastRow < 2) return 0;
      var keep = [], removed = 0;
      t.rows.forEach(function (o) { if (fn(o)) removed++; else keep.push(toArr(t, o)); });
      if (!removed) return 0;
      sh.getRange(2, 1, lastRow - 1, t.headers.length).clearContent();
      if (keep.length) sh.getRange(2, 1, keep.length, t.headers.length).setValues(keep);
      invalidate(name);
      return removed;
    }
  };
})();

/** Human-friendly ID generator (counters live in Script Properties, used under lock). */
var Seq = {
  /** Returns the next integer for `key`; scanFn() must return the highest number already in use. */
  raw: function (key, scanFn) {
    var props = PropertiesService.getScriptProperties();
    var k = 'SEQ_' + key, cur = props.getProperty(k), n;
    if (cur === null || cur === '') n = scanFn ? scanFn() : 0;
    else n = parseInt(cur, 10);
    n += 1;
    props.setProperty(k, String(n));
    return n;
  },
  /** e.g. Seq.next('STUDENT','STU',4,'Students','StudentID') -> "STU0001" */
  next: function (key, prefix, pad, sheetName, idField) {
    var n = Seq.raw(key, function () {
      var max = 0;
      Db.all(sheetName).forEach(function (r) {
        var id = String(r[idField]);
        var m = id.indexOf(prefix) === 0 ? id.match(/(\d+)$/) : null;
        if (m) max = Math.max(max, parseInt(m[1], 10));
      });
      return max;
    });
    return prefix + U.pad(n, pad);
  }
};

// ======================================================================
// FILE: Settings.gs
// ======================================================================
/**
 * ============================================================================
 *  Settings.gs — institute configuration (Settings sheet) + Google Drive files
 * ============================================================================
 */

var Settings = {
  map: function () {
    var m = {};
    Db.all(SHEET.SETTINGS).forEach(function (r) { m[r.Key] = r.Value; });
    return m;
  },
  get: function (key, def) {
    var v = Settings.map()[key];
    return (v === undefined || v === '' || v === null) ? (def === undefined ? '' : def) : v;
  },
  classes: function () {
    var c = U.csv(Settings.get('AllowedClasses', '8,9,10'));
    return c.length ? c : ['8', '9', '10'];
  },
  validClass: function (v) {
    var s = String(v === null || v === undefined ? '' : v).trim();
    if (Settings.classes().indexOf(s) < 0) throw AppError('Class must be one of: ' + Settings.classes().join(', ') + '.');
    return s;
  },
  lowAttendance: function () { return U.num(Settings.get('LowAttendanceThreshold', 75)) || 75; },

  /** Information the login page may show before anyone is authenticated. Cached. */
  publicInfo: function () {
    var cache = CacheService.getScriptCache();
    var c = cache.get('pubinfo');
    if (c) { try { return JSON.parse(c); } catch (e) { /* rebuild */ } }
    var m = Settings.map();
    var info = {
      name: m.InstituteName || 'Success Coaching Classes',
      address: m.Address || '',
      phone: m.Phone || '',
      email: m.Email || '',
      academicYear: m.AcademicYear || '',
      classes: Settings.classes(),
      studentRegistration: String(m.StudentRegistration || 'ON').toUpperCase() === 'ON',
      teacherRegistration: String(m.TeacherRegistration || 'ON').toUpperCase() === 'ON',
      logo: m.Logo ? Files.logoDataUri(m.Logo) : ''
    };
    U.cachePut('pubinfo', JSON.stringify(info), CFG.CACHE_TTL_SEC);
    return info;
  },

  /** Admin: all editable settings. */
  full: function (ctx) {
    var m = Settings.map();
    var out = {};
    ['InstituteName', 'Address', 'Phone', 'Email', 'ReceiptPrefix', 'AcademicYear', 'AllowedClasses',
      'StudentRegistration', 'TeacherRegistration', 'LowAttendanceThreshold'].forEach(function (k) { out[k] = m[k] || ''; });
    out.hasLogo = !!m.Logo;
    out.logo = m.Logo ? Files.logoDataUri(m.Logo) : '';
    return out;
  },

  save: function (ctx, p) {
    var v = {};
    v.InstituteName = U.text(p.InstituteName, 'Institute name', { max: 80 });
    v.Address = U.text(p.Address, 'Address', { max: 200, required: false });
    v.Phone = U.text(p.Phone, 'Phone', { max: 40, required: false });
    v.Email = U.text(p.Email, 'Email', { max: 80, required: false });
    if (v.Email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.Email)) throw AppError('Please enter a valid email address.');
    v.ReceiptPrefix = U.text(p.ReceiptPrefix, 'Receipt prefix', { max: 8 }).toUpperCase();
    if (!/^[A-Z0-9]{2,8}$/.test(v.ReceiptPrefix)) throw AppError('Receipt prefix must be 2-8 letters or digits.');
    v.AcademicYear = U.text(p.AcademicYear, 'Academic year', { max: 7 });
    if (!/^\d{4}-\d{2}$/.test(v.AcademicYear)) throw AppError('Academic year must look like 2026-27.');
    var classes = U.uniq(U.csv(p.AllowedClasses));
    if (!classes.length || classes.some(function (c) { return !/^[A-Za-z0-9]{1,3}$/.test(c); })) throw AppError('Classes must be a comma separated list, e.g. 8,9,10.');
    v.AllowedClasses = classes.join(',');
    v.StudentRegistration = U.oneOf(String(p.StudentRegistration || '').toUpperCase(), ['ON', 'OFF'], 'student registration option');
    v.TeacherRegistration = U.oneOf(String(p.TeacherRegistration || '').toUpperCase(), ['ON', 'OFF'], 'teacher registration option');
    var thr = Number(p.LowAttendanceThreshold);
    if (isNaN(thr) || thr < 1 || thr > 100) throw AppError('Low attendance threshold must be between 1 and 100.');
    v.LowAttendanceThreshold = String(Math.round(thr));

    return U.withLock(function () {
      Settings._write(v);
      return Settings.full(ctx);
    });
  },

  /** Insert or update Key/Value rows (caller holds the lock). */
  _write: function (values) {
    var pairs = [], inserts = [];
    Object.keys(values).forEach(function (k) {
      var row = Db.first(SHEET.SETTINGS, function (r) { return r.Key === k; });
      if (row) pairs.push([row, { Value: values[k] }]);
      else inserts.push({ Key: k, Value: values[k], Description: '' });
    });
    if (pairs.length) Db.updateMany(SHEET.SETTINGS, pairs);
    if (inserts.length) Db.insert(SHEET.SETTINGS, inserts);
    CacheService.getScriptCache().remove('pubinfo');
    CacheService.getScriptCache().remove('logo');
  },

  uploadLogo: function (ctx, p) {
    var f = Files.decode(p.file, 'logo', CFG.MAX_LOGO_BYTES);
    return U.withLock(function () {
      var saved = Files.store('INSTITUTE', f, 'logo');
      Settings._write({ Logo: saved.fileId });
      return Settings.full(ctx);
    });
  },

  removeLogo: function (ctx) {
    return U.withLock(function () {
      Settings._write({ Logo: '' });
      return Settings.full(ctx);
    });
  }
};

/* ============================================================================
 *  Files — Google Drive storage (assignments, materials, receipts, logo)
 * ========================================================================== */
var Files = {
  MIME: {
    pdf: 'application/pdf', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png'
  },
  FOLDER_NAMES: { ASSIGNMENTS: 'Assignments', MATERIALS: 'Study Materials', RECEIPTS: 'Receipts', INSTITUTE: 'Institute' },

  /** Creates the Drive folder tree once and remembers the IDs. Safe to re-run. */
  ensureFolders: function () {
    var props = PropertiesService.getScriptProperties();
    function ok(id) { if (!id) return false; try { return !DriveApp.getFolderById(id).isTrashed(); } catch (e) { return false; } }
    var rootId = props.getProperty('FOLDER_ROOT'), root;
    if (ok(rootId)) root = DriveApp.getFolderById(rootId);
    else { root = DriveApp.createFolder('SUCCESS COACHING CLASSES'); props.setProperty('FOLDER_ROOT', root.getId()); }
    Object.keys(Files.FOLDER_NAMES).forEach(function (k) {
      var id = props.getProperty('FOLDER_' + k);
      if (!ok(id)) props.setProperty('FOLDER_' + k, root.createFolder(Files.FOLDER_NAMES[k]).getId());
    });
    return root.getUrl();
  },
  folder: function (key) {
    var id = PropertiesService.getScriptProperties().getProperty('FOLDER_' + key);
    if (!id) throw AppError('File storage is not configured. Please contact the administrator.', 'SETUP');
    return DriveApp.getFolderById(id);
  },

  signatureOk: function (ext, b) {
    function at(i) { return (b[i] + 256) % 256; }
    if (!b || b.length < 4) return false;
    switch (ext) {
      case 'pdf': return at(0) === 0x25 && at(1) === 0x50 && at(2) === 0x44 && at(3) === 0x46;
      case 'png': return at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4E && at(3) === 0x47;
      case 'jpg': case 'jpeg': return at(0) === 0xFF && at(1) === 0xD8 && at(2) === 0xFF;
      case 'docx': case 'pptx': case 'xlsx': return at(0) === 0x50 && at(1) === 0x4B;
      case 'doc': case 'ppt': case 'xls': return at(0) === 0xD0 && at(1) === 0xCF && at(2) === 0x11 && at(3) === 0xE0;
    }
    return false;
  },

  /** Validates an upload {name, data(base64)} and returns {bytes, ext, name}. Nothing is written yet. */
  decode: function (upload, kind, maxBytes) {
    if (!upload || !upload.name || !upload.data) throw AppError('Please choose a file to upload.');
    var name = U.safeFileName(upload.name);
    var m = /\.([A-Za-z0-9]{2,5})$/.exec(name);
    var ext = m ? m[1].toLowerCase() : '';
    var allowed = UPLOAD_KINDS[kind] || [];
    if (allowed.indexOf(ext) < 0) throw AppError('This file type is not allowed. Allowed: ' + allowed.join(', ').toUpperCase() + '.');
    var bytes;
    try { bytes = Utilities.base64Decode(String(upload.data)); } catch (e) { throw AppError('The uploaded file could not be read. Please try again.'); }
    if (!bytes.length) throw AppError('The uploaded file is empty.');
    if (bytes.length > (maxBytes || CFG.MAX_FILE_BYTES)) throw AppError('The file is too large. Maximum size is ' + Math.round((maxBytes || CFG.MAX_FILE_BYTES) / 1024 / 1024 * 10) / 10 + ' MB.');
    if (!Files.signatureOk(ext, bytes)) throw AppError('The file content does not match its type (' + ext.toUpperCase() + '). Please upload a valid file.');
    return { bytes: bytes, ext: ext, name: name };
  },

  /** Writes a decoded upload to Drive and returns { fileId, fileName }. */
  store: function (folderKey, decoded, prefix) {
    var stored = U.safeFileName((prefix ? prefix + '_' : '') + decoded.name);
    var blob = Utilities.newBlob(decoded.bytes, Files.MIME[decoded.ext], stored);
    var file = Files.folder(folderKey).createFile(blob);
    return { fileId: file.getId(), fileName: decoded.name };
  },

  /** Save raw blob (used for receipts). */
  storeBlob: function (folderKey, blob, fileName) {
    blob.setName(fileName);
    var file = Files.folder(folderKey).createFile(blob);
    return file.getId();
  },

  exists: function (fileId) {
    if (!fileId) return false;
    try { return !DriveApp.getFileById(fileId).isTrashed(); } catch (e) { return false; }
  },

  /** Reads a file for download. `friendlyName` is what the user will see. */
  read: function (fileId, friendlyName) {
    if (!fileId) throw AppError('No file is attached.', 'NOT_FOUND');
    try {
      var f = DriveApp.getFileById(fileId);
      if (f.isTrashed()) throw new Error('trashed');
      var b = f.getBlob();
      return { name: friendlyName || f.getName(), mime: b.getContentType(), data: Utilities.base64Encode(b.getBytes()) };
    } catch (e) {
      Log.error('Files.read', e, { fileId: fileId });
      throw AppError('This file is no longer available. Please contact the institute.', 'NOT_FOUND');
    }
  },

  logoDataUri: function (fileId) {
    try {
      var b = DriveApp.getFileById(fileId).getBlob();
      return 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes());
    } catch (e) {
      Log.error('Files.logoDataUri', e);
      return '';
    }
  }
};

// ======================================================================
// FILE: Auth.gs
// ======================================================================
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

    /** Self-service student password recovery using the registered 10-digit phone number.
     *  The temporary password is returned exactly once to the browser and the old sessions are revoked.
     */
    forgotStudentPassword: function (p) {
      var studentId = U.text(p.studentId, 'Student ID', { max: 30 }).toUpperCase();
      var phone = U.phone(p.phone, 'Registered phone number');
      var c = cache(), key = 'forgot:' + studentId;
      var attempts = Number(c.get(key) || 0);
      if (attempts >= 5) throw AppError('Too many password-reset attempts. Please wait 15 minutes and try again.', 'LOCKED');
      c.put(key, String(attempts + 1), CFG.LOGIN_LOCK_SEC);

      return U.withLock(function () {
        var student = Db.get(SHEET.STUDENTS, 'StudentID', studentId);
        if (!student || String(student.Phone) !== phone || student.Status !== STATUS.ACTIVE) {
          throw AppError('The Student ID or registered phone number is not correct.', 'RECOVERY');
        }
        var user = Db.get(SHEET.USERS, 'UserID', student.UserID);
        if (!user || user.Role !== ROLE.STUDENT || user.Status !== STATUS.ACTIVE) {
          throw AppError('This student account is not active. Please contact the institute.', 'INACTIVE');
        }
        var pw = U.randomPassword(10);
        Db.update(SHEET.USERS, user, { AuthData: Auth.make(pw), UpdatedAt: U.now() });
        Auth.revoke(user.UserID);
        return { username: user.Username, password: pw };
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

// ======================================================================
// FILE: Users.gs
// ======================================================================
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

// ======================================================================
// FILE: Students.gs
// ======================================================================
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

// ======================================================================
// FILE: Teachers.gs
// ======================================================================
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

// ======================================================================
// FILE: Batches.gs
// ======================================================================
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

// ======================================================================
// FILE: Attendance.gs
// ======================================================================
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

// ======================================================================
// FILE: Notifications.gs
// ======================================================================
/**
 * ============================================================================
 *  Notifications.gs — in-app notifications only (no email / SMS / WhatsApp).
 *
 *  Target: ALL | CLASS_8 | CLASS_9 | CLASS_10 | <batch name> | <StudentID>
 *  Read state: instead of a row per user per notification, each user has a
 *  "seen up to" timestamp (Users.NotifSeenAt). Anything newer is unread.
 * ============================================================================
 */
var Notifications = {
  /** Adds a notification. The caller must already hold the lock (U.withLock). */
  push: function (target, title, message, createdBy) {
    var id = Seq.next('NOTIFICATION', 'NTF', 5, SHEET.NOTIFICATIONS, 'NotificationID');
    Db.insert(SHEET.NOTIFICATIONS, {
      NotificationID: id, Date: U.nowMs(), Target: String(target).toUpperCase(),
      Title: String(title).substr(0, 100), Message: String(message).substr(0, 500), CreatedBy: createdBy
    });
    return id;
  },

  _visible: function (ctx) {
    var vis = Access.visibleTargets(ctx);
    return Db.where(SHEET.NOTIFICATIONS, function (n) { return Access.targetVisible(n.Target, vis); })
      .sort(function (a, b) { return U.cmp(b.Date + b.NotificationID, a.Date + a.NotificationID); });
  },

  _seen: function (ctx) {
    var u = Db.get(SHEET.USERS, 'UserID', ctx.userId);
    return u ? String(u.NotifSeenAt || '') : '';
  },

  unreadCount: function (ctx) {
    if (ctx.role === ROLE.ADMIN) return 0;
    var seen = Notifications._seen(ctx);
    return Notifications._visible(ctx).filter(function (n) { return n.Date > seen; }).length;
  },

  view: function (n, seen, creators) {
    return {
      id: n.NotificationID, date: n.Date, target: n.Target, title: n.Title, message: n.Message,
      unread: n.Date > seen, from: creators[n.CreatedBy] || (n.CreatedBy === 'ADMIN' ? 'Admin' : '')
    };
  },

  list: function (ctx, p) {
    var seen = ctx.role === ROLE.ADMIN ? '9999' : Notifications._seen(ctx);
    var creators = {};
    Db.all(SHEET.TEACHERS).forEach(function (t) { creators[t.TeacherID] = t.Name; });
    var rows = Notifications._visible(ctx);
    var unread = ctx.role === ROLE.ADMIN ? 0 : rows.filter(function (n) { return n.Date > seen; }).length;
    var page = U.paginate(rows, { page: p.page, pageSize: p.pageSize || 20 });
    page.items = page.items.map(function (n) { return Notifications.view(n, seen, creators); });
    page.unread = unread;
    return page;
  },

  markRead: function (ctx) {
    if (ctx.role === ROLE.ADMIN) return { unread: 0 };
    return U.withLock(function () {
      var u = Db.get(SHEET.USERS, 'UserID', ctx.userId);
      if (u) Db.update(SHEET.USERS, u, { NotifSeenAt: U.nowMs() });
      return { unread: 0 };
    });
  },

  create: function (ctx, p) {
    var title = U.text(p.title, 'Title', { max: 100 });
    var message = U.text(p.message, 'Message', { max: 500, multiline: true });
    var target = Access.normalizeTarget(ctx, p.target, { allowStudent: true });
    return U.withLock(function () {
      return { id: Notifications.push(target, title, message, 'ADMIN') };
    });
  },

  remove: function (ctx, p) {
    return U.withLock(function () {
      var n = Db.get(SHEET.NOTIFICATIONS, 'NotificationID', p.id);
      if (!n) throw AppError('Notification not found.', 'NOT_FOUND');
      Db.deleteWhere(SHEET.NOTIFICATIONS, function (r) { return r.NotificationID === p.id; });
      return { done: true };
    });
  }
};

// ======================================================================
// FILE: Content.gs
// ======================================================================
/**
 * ============================================================================
 *  Content.gs — Assignments, Study Materials and Events.
 *  Content belongs to a BATCH (or a target); students see it automatically
 *  through their batch membership. No per-student copies are ever created.
 * ============================================================================
 */
var Content = {
  createdBy: function (ctx) { return ctx.role === ROLE.ADMIN ? 'ADMIN' : ctx.teacherId; },
  creatorNames: function () {
    var m = { ADMIN: 'Admin' };
    Db.all(SHEET.TEACHERS).forEach(function (t) { m[t.TeacherID] = t.Name; });
    return m;
  },
  inScope: function (readable, batch) { return readable === null || readable.indexOf(batch) >= 0; }
};

/* ============================================================================
 *  Assignments
 * ========================================================================== */
var Assignments = {
  view: function (a, names) {
    var today = U.today();
    return {
      assignmentId: a.AssignmentID, batch: a.Batch, subject: a.Subject, title: a.Title, description: a.Description,
      fileName: a.FileName, hasFile: !!a.FileID, issueDate: a.IssueDate, dueDate: a.DueDate, status: a.Status,
      createdBy: names[a.CreatedBy] || '', mine: false,
      daysLeft: a.DueDate ? U.daysBetween(today, a.DueDate) : null, overdue: !!a.DueDate && a.DueDate < today
    };
  },

  list: function (ctx, p) {
    var readable = Access.readableBatchNames(ctx), names = Content.creatorNames(), today = U.today();
    var q = U.lc(p.q).trim(), batch = String(p.batch || '').toUpperCase(), status = String(p.status || '');
    var rows = Db.where(SHEET.ASSIGNMENTS, function (a) {
      if (!Content.inScope(readable, a.Batch)) return false;
      if (ctx.role === ROLE.STUDENT && a.Status !== 'PUBLISHED') return false;
      if (batch && a.Batch !== batch) return false;
      if (status && a.Status !== status) return false;
      if (q && U.lc(a.Title).indexOf(q) < 0 && U.lc(a.Subject).indexOf(q) < 0) return false;
      return true;
    });
    if (ctx.role === ROLE.STUDENT) {
      rows.sort(function (a, b) {
        var ua = a.DueDate >= today, ub = b.DueDate >= today;
        if (ua !== ub) return ua ? -1 : 1;
        return ua ? U.cmp(a.DueDate, b.DueDate) : U.cmp(b.DueDate, a.DueDate);
      });
    } else rows.sort(function (a, b) { return U.cmp(b.IssueDate + b.AssignmentID, a.IssueDate + a.AssignmentID); });
    var page = U.paginate(rows, { page: p.page, pageSize: p.pageSize || 20 });
    page.items = page.items.map(function (a) {
      var v = Assignments.view(a, names);
      v.mine = ctx.role === ROLE.ADMIN || a.CreatedBy === ctx.teacherId;
      return v;
    });
    return page;
  },

  save: function (ctx, p) {
    var editing = !!p.assignmentId;
    var existing = null, batch;
    if (editing) {
      existing = Db.get(SHEET.ASSIGNMENTS, 'AssignmentID', p.assignmentId);
      if (!existing) throw AppError('Assignment not found.', 'NOT_FOUND');
      batch = Access.requireBatch(ctx, existing.Batch, { write: true });
    } else batch = Access.requireBatch(ctx, p.batch, { write: true });

    var title = U.text(p.title, 'Title', { min: 3, max: 120 });
    var description = U.text(p.description, 'Description', { required: false, max: 1000, multiline: true });
    var issue = U.date(p.issueDate || U.today(), 'Issue date');
    var due = U.date(p.dueDate, 'Due date');
    if (due < issue) throw AppError('The due date cannot be before the issue date.');
    var decoded = p.file ? Files.decode(p.file, 'assignment') : null;
    var saved = decoded ? Files.store('ASSIGNMENTS', decoded, batch.Batch) : null;

    return U.withLock(function () {
      if (editing) {
        var row = Db.get(SHEET.ASSIGNMENTS, 'AssignmentID', p.assignmentId);
        var patch = { Title: title, Description: description, IssueDate: issue, DueDate: due };
        if (saved) { patch.FileID = saved.fileId; patch.FileName = saved.fileName; }
        Db.update(SHEET.ASSIGNMENTS, row, patch);
        return { assignmentId: row.AssignmentID, updated: true };
      }
      var id = Seq.next('ASSIGNMENT', 'ASG', 4, SHEET.ASSIGNMENTS, 'AssignmentID');
      Db.insert(SHEET.ASSIGNMENTS, {
        AssignmentID: id, Batch: batch.Batch, Subject: batch.Subject, Title: title, Description: description,
        FileID: saved ? saved.fileId : '', FileName: saved ? saved.fileName : '', IssueDate: issue, DueDate: due,
        Status: 'PUBLISHED', CreatedBy: Content.createdBy(ctx), CreatedAt: U.now()
      });
      Notifications.push(batch.Batch, 'New assignment: ' + title, batch.Subject + ' \u2014 due ' + U.prettyDate(due), Content.createdBy(ctx));
      return { assignmentId: id, updated: false };
    });
  },

  setStatus: function (ctx, p) {
    var status = U.oneOf(String(p.status || '').toUpperCase(), ['PUBLISHED', 'ARCHIVED'], 'status');
    return U.withLock(function () {
      var a = Db.get(SHEET.ASSIGNMENTS, 'AssignmentID', p.assignmentId);
      if (!a) throw AppError('Assignment not found.', 'NOT_FOUND');
      Access.requireBatch(ctx, a.Batch, { write: true });
      Db.update(SHEET.ASSIGNMENTS, a, { Status: status });
      return { done: true, status: status };
    });
  },

  file: function (ctx, p) {
    var a = Db.get(SHEET.ASSIGNMENTS, 'AssignmentID', p.assignmentId);
    if (!a) throw AppError('Assignment not found.', 'NOT_FOUND');
    Access.requireBatch(ctx, a.Batch);
    if (ctx.role === ROLE.STUDENT && a.Status !== 'PUBLISHED') throw AppError('You do not have access to this file.', 'FORBIDDEN');
    return Files.read(a.FileID, a.FileName);
  }
};

/* ============================================================================
 *  Study materials
 * ========================================================================== */
var Materials = {
  view: function (m, names) {
    return {
      materialId: m.MaterialID, batch: m.Batch, subject: m.Subject, title: m.Title, description: m.Description,
      fileName: m.FileName, hasFile: !!m.FileID, date: m.Date, status: m.Status, createdBy: names[m.CreatedBy] || '', mine: false
    };
  },

  list: function (ctx, p) {
    var readable = Access.readableBatchNames(ctx), names = Content.creatorNames();
    var q = U.lc(p.q).trim(), batch = String(p.batch || '').toUpperCase(), status = String(p.status || '');
    var rows = Db.where(SHEET.MATERIALS, function (m) {
      if (!Content.inScope(readable, m.Batch)) return false;
      if (ctx.role === ROLE.STUDENT && m.Status !== 'PUBLISHED') return false;
      if (batch && m.Batch !== batch) return false;
      if (status && m.Status !== status) return false;
      if (q && U.lc(m.Title).indexOf(q) < 0 && U.lc(m.Subject).indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) { return U.cmp(b.Date + b.MaterialID, a.Date + a.MaterialID); });
    var page = U.paginate(rows, { page: p.page, pageSize: p.pageSize || 20 });
    page.items = page.items.map(function (m) {
      var v = Materials.view(m, names);
      v.mine = ctx.role === ROLE.ADMIN || m.CreatedBy === ctx.teacherId;
      return v;
    });
    return page;
  },

  save: function (ctx, p) {
    var editing = !!p.materialId;
    var existing = null, batch;
    if (editing) {
      existing = Db.get(SHEET.MATERIALS, 'MaterialID', p.materialId);
      if (!existing) throw AppError('Material not found.', 'NOT_FOUND');
      batch = Access.requireBatch(ctx, existing.Batch, { write: true });
    } else batch = Access.requireBatch(ctx, p.batch, { write: true });

    var title = U.text(p.title, 'Title', { min: 3, max: 120 });
    var description = U.text(p.description, 'Description', { required: false, max: 1000, multiline: true });
    if (!editing && !p.file) throw AppError('Please choose a file to upload.');
    var decoded = p.file ? Files.decode(p.file, 'material') : null;
    var saved = decoded ? Files.store('MATERIALS', decoded, batch.Batch) : null;

    return U.withLock(function () {
      if (editing) {
        var row = Db.get(SHEET.MATERIALS, 'MaterialID', p.materialId);
        var patch = { Title: title, Description: description };
        if (saved) { patch.FileID = saved.fileId; patch.FileName = saved.fileName; }
        Db.update(SHEET.MATERIALS, row, patch);
        return { materialId: row.MaterialID, updated: true };
      }
      var id = Seq.next('MATERIAL', 'MAT', 4, SHEET.MATERIALS, 'MaterialID');
      Db.insert(SHEET.MATERIALS, {
        MaterialID: id, Batch: batch.Batch, Subject: batch.Subject, Title: title, Description: description,
        FileID: saved.fileId, FileName: saved.fileName, Date: U.today(), Status: 'PUBLISHED', CreatedBy: Content.createdBy(ctx)
      });
      Notifications.push(batch.Batch, 'New study material: ' + title, batch.Subject, Content.createdBy(ctx));
      return { materialId: id, updated: false };
    });
  },

  setStatus: function (ctx, p) {
    var status = U.oneOf(String(p.status || '').toUpperCase(), ['PUBLISHED', 'ARCHIVED'], 'status');
    return U.withLock(function () {
      var m = Db.get(SHEET.MATERIALS, 'MaterialID', p.materialId);
      if (!m) throw AppError('Material not found.', 'NOT_FOUND');
      Access.requireBatch(ctx, m.Batch, { write: true });
      Db.update(SHEET.MATERIALS, m, { Status: status });
      return { done: true, status: status };
    });
  },

  file: function (ctx, p) {
    var m = Db.get(SHEET.MATERIALS, 'MaterialID', p.materialId);
    if (!m) throw AppError('Material not found.', 'NOT_FOUND');
    Access.requireBatch(ctx, m.Batch);
    if (ctx.role === ROLE.STUDENT && m.Status !== 'PUBLISHED') throw AppError('You do not have access to this file.', 'FORBIDDEN');
    return Files.read(m.FileID, m.FileName);
  }
};

/* ============================================================================
 *  Events
 * ========================================================================== */
var Events = {
  view: function (e, names, ctx) {
    return {
      eventId: e.EventID, title: e.Title, description: e.Description, eventType: e.EventType,
      date: e.Date, time: e.Time, target: e.Target, createdBy: names[e.CreatedBy] || '',
      mine: ctx.role === ROLE.ADMIN || e.CreatedBy === ctx.teacherId
    };
  },

  list: function (ctx, p) {
    var vis = Access.visibleTargets(ctx), names = Content.creatorNames(), today = U.today();
    var scope = String(p.scope || 'upcoming'), type = String(p.type || '');
    var rows = Db.where(SHEET.EVENTS, function (e) {
      var see = Access.targetVisible(e.Target, vis) || (ctx.role === ROLE.TEACHER && e.CreatedBy === ctx.teacherId);
      if (!see) return false;
      if (type && e.EventType !== type) return false;
      if (scope === 'upcoming' && e.Date < today) return false;
      if (scope === 'past' && e.Date >= today) return false;
      return true;
    });
    if (scope === 'past') rows.sort(function (a, b) { return U.cmp(b.Date, a.Date); });
    else rows.sort(function (a, b) { return U.cmp(a.Date + a.Time, b.Date + b.Time); });
    var page = U.paginate(rows, { page: p.page, pageSize: p.pageSize || 30 });
    page.items = page.items.map(function (e) { return Events.view(e, names, ctx); });
    return page;
  },

  save: function (ctx, p) {
    var title = U.text(p.title, 'Title', { min: 3, max: 120 });
    var description = U.text(p.description, 'Description', { required: false, max: 500, multiline: true });
    var type = U.oneOf(p.eventType, EVENT_TYPES, 'event type');
    var date = U.date(p.date, 'Date');
    var time = U.text(p.time, 'Time', { required: false, max: 20 });
    var editing = !!p.eventId;
    return U.withLock(function () {
      var target = Access.normalizeTarget(ctx, p.target);
      if (editing) {
        var e = Db.get(SHEET.EVENTS, 'EventID', p.eventId);
        if (!e) throw AppError('Event not found.', 'NOT_FOUND');
        if (ctx.role !== ROLE.ADMIN && e.CreatedBy !== ctx.teacherId) throw AppError('You can only change your own events.', 'FORBIDDEN');
        Db.update(SHEET.EVENTS, e, { Title: title, Description: description, EventType: type, Date: date, Time: time, Target: target });
        return { eventId: e.EventID, updated: true };
      }
      var id = Seq.next('EVENT', 'EVT', 4, SHEET.EVENTS, 'EventID');
      Db.insert(SHEET.EVENTS, {
        EventID: id, Title: title, Description: description, EventType: type, Date: date, Time: time,
        Target: target, CreatedBy: Content.createdBy(ctx), CreatedAt: U.now()
      });
      if (p.notify !== false) {
        Notifications.push(target, type + ': ' + title, U.prettyDate(date) + (time ? ' at ' + time : '') + (description ? ' \u2014 ' + description : ''), Content.createdBy(ctx));
      }
      return { eventId: id, updated: false };
    });
  },

  remove: function (ctx, p) {
    return U.withLock(function () {
      var e = Db.get(SHEET.EVENTS, 'EventID', p.eventId);
      if (!e) throw AppError('Event not found.', 'NOT_FOUND');
      if (ctx.role !== ROLE.ADMIN && e.CreatedBy !== ctx.teacherId) throw AppError('You can only delete your own events.', 'FORBIDDEN');
      Db.deleteWhere(SHEET.EVENTS, function (r) { return r.EventID === p.eventId; });
      return { done: true };
    });
  }
};

// ======================================================================
// FILE: Fees.gs
// ======================================================================
/**
 * ============================================================================
 *  Fees.gs — fee records (Fees sheet) and payments (Payments sheet).
 *
 *  A fee record is identified by StudentID + FeeType (e.g. "Course Fee 2026-27",
 *  "Monthly Fee - Oct 2026"), so no extra ID is needed.
 *    FinalFee  = TotalFee - Discount        (always calculated by the server)
 *    Remaining = FinalFee - Paid            (always calculated by the server)
 *  Installments / partial payments = several Payments rows against one fee.
 * ============================================================================
 */
var Fees = {
  calc: function (total, discount, paid) {
    var t = U.round2(total), d = U.round2(discount), p = U.round2(paid);
    var finalFee = U.round2(Math.max(t - d, 0));
    var remaining = U.round2(Math.max(finalFee - p, 0));
    var status = remaining <= 0 ? 'PAID' : (p > 0 ? 'PARTIAL' : 'PENDING');
    return { FinalFee: finalFee, Remaining: remaining, Status: status };
  },

  view: function (f) {
    var today = U.today();
    return {
      studentId: f.StudentID, feeType: f.FeeType, totalFee: U.num(f.TotalFee), discount: U.num(f.Discount),
      finalFee: U.num(f.FinalFee), paid: U.num(f.Paid), remaining: U.num(f.Remaining), status: f.Status,
      dueDate: f.DueDate, overdue: U.num(f.Remaining) > 0 && !!f.DueDate && f.DueDate < today
    };
  },

  _find: function (studentId, feeType) {
    return Db.first(SHEET.FEES, function (r) { return r.StudentID === studentId && U.lc(r.FeeType) === U.lc(feeType); });
  },

  /** Assign a fee to one student, a whole batch or a whole class. Existing (student, fee type) pairs are skipped. */
  assign: function (ctx, p) {
    var feeType = U.text(p.feeType, 'Fee type', { min: 3, max: 60 });
    var total = U.money(p.totalFee, 'Total fee', { positive: true });
    var discount = U.money(p.discount === '' || p.discount === undefined ? 0 : p.discount, 'Discount');
    if (discount > total) throw AppError('Discount cannot be more than the total fee.');
    var due = U.date(p.dueDate, 'Due date', { required: false });
    var t = p.target || {};
    var type = U.oneOf(t.type, ['STUDENT', 'BATCH', 'CLASS'], 'target');
    return U.withLock(function () {
      var students;
      if (type === 'STUDENT') {
        var s = Db.get(SHEET.STUDENTS, 'StudentID', String(t.value || '').trim());
        if (!s || s.Status !== STATUS.ACTIVE) throw AppError('Please choose an active student.');
        students = [s];
      } else if (type === 'BATCH') {
        var b = Db.get(SHEET.BATCHES, 'Batch', Batches.norm(t.value));
        if (!b) throw AppError('Please choose a valid batch.');
        students = Students.inBatch(b.Batch);
      } else {
        var cls = Settings.validClass(t.value);
        students = Db.where(SHEET.STUDENTS, function (s2) { return s2.Status === STATUS.ACTIVE && String(s2.Class) === cls; });
      }
      if (!students.length) throw AppError('No active students match this selection.');
      var have = {};
      Db.all(SHEET.FEES).forEach(function (f) { have[f.StudentID + '|' + U.lc(f.FeeType)] = true; });
      var calc = Fees.calc(total, discount, 0), now = U.now(), rows = [], skipped = 0;
      students.forEach(function (s3) {
        if (have[s3.StudentID + '|' + U.lc(feeType)]) { skipped++; return; }
        rows.push({ StudentID: s3.StudentID, FeeType: feeType, TotalFee: total, Discount: discount, FinalFee: calc.FinalFee, Paid: 0, Remaining: calc.Remaining, Status: calc.Status, DueDate: due, UpdatedAt: now });
      });
      if (rows.length) Db.insert(SHEET.FEES, rows);
      return { created: rows.length, skipped: skipped };
    });
  },

  update: function (ctx, p) {
    var total = U.money(p.totalFee, 'Total fee', { positive: true });
    var discount = U.money(p.discount === '' || p.discount === undefined ? 0 : p.discount, 'Discount');
    if (discount > total) throw AppError('Discount cannot be more than the total fee.');
    var due = U.date(p.dueDate, 'Due date', { required: false });
    return U.withLock(function () {
      var f = Fees._find(String(p.studentId || ''), String(p.feeType || ''));
      if (!f) throw AppError('Fee record not found.', 'NOT_FOUND');
      var calc = Fees.calc(total, discount, f.Paid);
      if (U.round2(total - discount) < U.num(f.Paid)) throw AppError('The final fee cannot be less than the amount already paid (\u20B9' + U.num(f.Paid) + ').');
      Db.update(SHEET.FEES, f, { TotalFee: total, Discount: discount, FinalFee: calc.FinalFee, Remaining: calc.Remaining, Status: calc.Status, DueDate: due, UpdatedAt: U.now() });
      return Fees.view(f);
    });
  },

  remove: function (ctx, p) {
    return U.withLock(function () {
      var f = Fees._find(String(p.studentId || ''), String(p.feeType || ''));
      if (!f) throw AppError('Fee record not found.', 'NOT_FOUND');
      if (U.num(f.Paid) > 0) throw AppError('This fee already has payments and cannot be deleted.');
      Db.deleteWhere(SHEET.FEES, function (r) { return r === f; });
      return { done: true };
    });
  },

  /** Admin list of fee records with student info, filters, totals and paging. */
  outstanding: function (ctx, p) {
    var students = U.indexBy(Db.all(SHEET.STUDENTS), 'StudentID');
    var q = U.lc(p.q).trim(), cls = String(p.class || ''), batch = String(p.batch || '').toUpperCase();
    var status = String(p.status || 'DUE'), feeType = String(p.feeType || '');
    var types = {};
    var rows = Db.where(SHEET.FEES, function (f) {
      types[f.FeeType] = true;
      var s = students[f.StudentID];
      if (!s) return false;
      if (status === 'DUE' ? U.num(f.Remaining) <= 0 : (status !== 'ALL' && f.Status !== status)) return false;
      if (feeType && f.FeeType !== feeType) return false;
      if (cls && String(s.Class) !== cls) return false;
      if (batch && !U.hasId(s.Batch, batch)) return false;
      if (q && U.lc(s.Name).indexOf(q) < 0 && U.lc(s.StudentID).indexOf(q) < 0) return false;
      return true;
    });
    var totals = { count: rows.length, finalFee: 0, paid: 0, remaining: 0 };
    rows.forEach(function (f) { totals.finalFee += U.num(f.FinalFee); totals.paid += U.num(f.Paid); totals.remaining += U.num(f.Remaining); });
    totals.finalFee = U.round2(totals.finalFee); totals.paid = U.round2(totals.paid); totals.remaining = U.round2(totals.remaining);
    rows.sort(function (a, b) { return U.cmp(U.lc(students[a.StudentID].Name), U.lc(students[b.StudentID].Name)) || U.cmp(a.FeeType, b.FeeType); });
    var page = U.paginate(rows, p);
    page.items = page.items.map(function (f) {
      var v = Fees.view(f), s = students[f.StudentID];
      v.studentName = s.Name; v.class = String(s.Class); v.batches = U.csv(s.Batch);
      return v;
    });
    page.totals = totals;
    page.feeTypes = Object.keys(types).sort();
    return page;
  },

  _studentBundle: function (studentId) {
    var s = Db.get(SHEET.STUDENTS, 'StudentID', studentId);
    var fees = Db.where(SHEET.FEES, function (f) { return f.StudentID === studentId; }).map(Fees.view);
    var pays = Db.where(SHEET.PAYMENTS, function (r) { return r.StudentID === studentId; })
      .sort(function (a, b) { return U.cmp(b.Date + b.PaymentID, a.Date + a.PaymentID); }).map(Payments.view);
    var t = { finalFee: 0, paid: 0, remaining: 0 };
    fees.forEach(function (f) { t.finalFee += f.finalFee; t.paid += f.paid; t.remaining += f.remaining; });
    t.finalFee = U.round2(t.finalFee); t.paid = U.round2(t.paid); t.remaining = U.round2(t.remaining);
    return { student: { studentId: s.StudentID, name: s.Name, class: String(s.Class), batches: U.csv(s.Batch) }, fees: fees, payments: pays, totals: t };
  },

  /** Admin: fees + payments of any student. */
  student: function (ctx, p) {
    var s = Access.requireStudent(ctx, p.studentId);
    return Fees._studentBundle(s.StudentID);
  },

  /** Student: own fees, payments and totals. */
  my: function (ctx) {
    return Fees._studentBundle(Access.studentRow(ctx).StudentID);
  }
};

var Payments = {
  view: function (r, students) {
    var s = students ? students[r.StudentID] : null;
    return {
      paymentId: r.PaymentID, studentId: r.StudentID, studentName: s ? s.Name : '', class: s ? String(s.Class) : '',
      feeType: r.FeeType, amount: U.num(r.Amount), date: r.Date, mode: r.PaymentMode, receiptNumber: r.ReceiptNumber,
      previousBalance: U.num(r.PreviousBalance), remainingBalance: U.num(r.RemainingBalance), notes: r.Notes
    };
  },

  nextReceiptNumber: function () {
    var n = Seq.raw('RECEIPT', function () {
      var max = 0;
      Db.all(SHEET.PAYMENTS).forEach(function (r) {
        var rn = String(r.ReceiptNumber), m = /-(\d+)$/.exec(rn);
        if (m && rn.indexOf('TEST-') !== 0) max = Math.max(max, parseInt(m[1], 10));
      });
      return max;
    });
    var ay = String(Settings.get('AcademicYear', '')), code = /^\d{4}-\d{2}$/.test(ay) ? ay.substr(2, 2) + ay.substr(5, 2) : String(new Date().getFullYear());
    return Settings.get('ReceiptPrefix', 'SCC') + '-' + code + '-' + U.pad(n, 6);
  },

  /** Records one payment: validates, updates the fee balance, creates receipt number, notifies student. */
  record: function (ctx, p) {
    var studentId = String(p.studentId || '').trim();
    var feeType = U.text(p.feeType, 'Fee type', { max: 60 });
    var amount = U.money(p.amount, 'Amount', { positive: true });
    var date = U.date(p.date || U.today(), 'Payment date');
    if (date > U.today()) throw AppError('The payment date cannot be in the future.');
    var mode = U.oneOf(p.paymentMode, PAYMENT_MODES, 'payment mode');
    var notes = U.text(p.notes, 'Notes', { required: false, max: 200 });

    var res = U.withLock(function () {
      var s = Db.get(SHEET.STUDENTS, 'StudentID', studentId);
      if (!s) throw AppError('Student not found.', 'NOT_FOUND');
      var fee = Fees._find(studentId, feeType);
      if (!fee) throw AppError('This student has no such fee record.', 'NOT_FOUND');
      var remaining = U.round2(fee.Remaining);
      if (remaining <= 0) throw AppError('This fee is already fully paid.');
      if (amount > remaining) throw AppError('The amount cannot be more than the remaining balance (\u20B9' + remaining + ').');

      var paymentId = Seq.next('PAYMENT', 'PAY', 6, SHEET.PAYMENTS, 'PaymentID');
      var receiptNumber = Payments.nextReceiptNumber();
      var paid = U.round2(U.num(fee.Paid) + amount);
      var calc = Fees.calc(fee.TotalFee, fee.Discount, paid);
      var now = U.now();
      Db.insert(SHEET.PAYMENTS, {
        PaymentID: paymentId, StudentID: studentId, FeeType: fee.FeeType, Amount: amount, Date: date, PaymentMode: mode,
        ReceiptNumber: receiptNumber, PreviousBalance: remaining, RemainingBalance: calc.Remaining, Notes: notes,
        ReceiptFileID: '', CreatedBy: 'ADMIN', CreatedAt: now
      });
      Db.update(SHEET.FEES, fee, { Paid: paid, Remaining: calc.Remaining, Status: calc.Status, UpdatedAt: now });
      Notifications.push(studentId, 'Payment received',
        '\u20B9' + amount + ' received for ' + fee.FeeType + '. Receipt ' + receiptNumber + '. Remaining balance: \u20B9' + calc.Remaining + '.', 'ADMIN');
      return { paymentId: paymentId, receiptNumber: receiptNumber, remaining: calc.Remaining, status: calc.Status };
    });

    // PDF generation is slow, so it happens outside the lock. If it fails the payment is still safe
    // and the receipt is generated on demand the first time someone opens it.
    try { Receipts.ensure(res.paymentId); res.receiptReady = true; }
    catch (e) { Log.error('Payments.record/receipt', e, { paymentId: res.paymentId }); res.receiptReady = false; }
    return res;
  },

  list: function (ctx, p) {
    var students = U.indexBy(Db.all(SHEET.STUDENTS), 'StudentID');
    var q = U.lc(p.q).trim(), from = p.from ? U.date(p.from, 'From date') : '', to = p.to ? U.date(p.to, 'To date') : '';
    var mode = String(p.mode || '');
    var rows = Db.where(SHEET.PAYMENTS, function (r) {
      if (from && r.Date < from) return false;
      if (to && r.Date > to) return false;
      if (mode && r.PaymentMode !== mode) return false;
      if (q) {
        var s = students[r.StudentID];
        if (U.lc(r.StudentID).indexOf(q) < 0 && U.lc(r.ReceiptNumber).indexOf(q) < 0 && U.lc(r.PaymentID).indexOf(q) < 0 && !(s && U.lc(s.Name).indexOf(q) >= 0)) return false;
      }
      return true;
    }).sort(function (a, b) { return U.cmp(b.Date + b.PaymentID, a.Date + a.PaymentID); });
    var total = 0;
    rows.forEach(function (r) { total += U.num(r.Amount); });
    var page = U.paginate(rows, p);
    page.items = page.items.map(function (r) { return Payments.view(r, students); });
    page.totalAmount = U.round2(total);
    return page;
  }
};

// ======================================================================
// FILE: Receipts.gs
// ======================================================================
/**
 * ============================================================================
 *  Receipts.gs — professional PDF payment receipts, stored in Google Drive.
 *  HTML -> PDF using Apps Script's built-in converter (no external service).
 *  Everything printed comes from the Settings sheet, nothing is hard-coded.
 * ============================================================================
 */
var Receipts = {
  html: function (pay) {
    var m = Settings.map();
    var s = Db.get(SHEET.STUDENTS, 'StudentID', pay.StudentID) || { Name: '', Class: '', Batch: '' };
    var e = U.esc;
    var logo = m.Logo ? Files.logoDataUri(m.Logo) : '';
    // "Rs." instead of the rupee sign: the PDF converter's default font may not contain that glyph.
    var money = function (n) { return 'Rs. ' + U.num(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
    var row = function (label, value, strong) {
      return '<tr><td style="width:38%;background:#f3f5fb;font-weight:bold;">' + e(label) + '</td><td' + (strong ? ' style="font-weight:bold;font-size:15px;"' : '') + '>' + value + '</td></tr>';
    };
    var name = m.InstituteName || 'SUCCESS COACHING CLASSES';
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
      'body{font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:13px;margin:0;padding:0;}' +
      'table.d{border-collapse:collapse;width:100%;margin-top:6px;}' +
      'table.d td{border:1px solid #c9cfe0;padding:8px 10px;}' +
      '</style></head><body>' +
      '<div style="border:2px solid #2a3f9e;padding:22px 26px;margin:10px;">' +
      '<table style="width:100%;"><tr>' +
      '<td style="width:90px;">' + (logo ? '<img src="' + logo + '" style="max-width:80px;max-height:80px;">' : '') + '</td>' +
      '<td style="text-align:center;"><div style="font-size:24px;font-weight:bold;color:#2a3f9e;">' + e(name) + '</div>' +
      '<div style="margin-top:4px;">' + e(m.Address || '') + '</div>' +
      '<div>' + (m.Phone ? 'Phone: ' + e(m.Phone) : '') + (m.Email ? ' &nbsp;|&nbsp; ' + e(m.Email) : '') + '</div></td>' +
      '<td style="width:90px;"></td></tr></table>' +
      '<div style="border-top:2px solid #2a3f9e;margin:12px 0 8px;"></div>' +
      '<div style="text-align:center;font-size:18px;font-weight:bold;letter-spacing:3px;margin-bottom:10px;">PAYMENT RECEIPT</div>' +
      '<table style="width:100%;margin-bottom:8px;"><tr>' +
      '<td><b>Receipt No:</b> ' + e(pay.ReceiptNumber) + '</td>' +
      '<td style="text-align:right;"><b>Payment Date:</b> ' + e(U.prettyDate(pay.Date)) + '</td></tr></table>' +
      '<table class="d">' +
      row('Student Name', e(s.Name)) + row('Student ID', e(pay.StudentID)) +
      row('Class', e(s.Class)) + row('Batch', e(U.csv(s.Batch).join(', ') || '-')) +
      row('Fee Type', e(pay.FeeType)) +
      row('Previous Balance', money(pay.PreviousBalance)) +
      row('Amount Paid', money(pay.Amount), true) +
      row('Remaining Balance', money(pay.RemainingBalance)) +
      row('Payment Mode', e(String(pay.PaymentMode).replace('_', ' '))) +
      (pay.Notes ? row('Notes', e(pay.Notes)) : '') +
      '</table>' +
      '<div style="margin-top:12px;"><b>Amount in words:</b> ' + e(U.amountInWords(U.num(pay.Amount))) + '</div>' +
      '<table style="width:100%;margin-top:46px;"><tr>' +
      '<td style="text-align:left;color:#555;font-size:11px;">This is a computer generated receipt.</td>' +
      '<td style="text-align:right;"><div style="border-top:1px solid #444;display:inline-block;padding-top:4px;min-width:170px;text-align:center;">Authorised Signatory</div></td>' +
      '</tr></table></div></body></html>';
  },

  /** Makes sure a PDF exists in Drive for this payment and returns its file id. */
  ensure: function (paymentId, force) {
    var pay = Db.get(SHEET.PAYMENTS, 'PaymentID', paymentId);
    if (!pay) throw AppError('Payment not found.', 'NOT_FOUND');
    if (!force && pay.ReceiptFileID && Files.exists(pay.ReceiptFileID)) return pay.ReceiptFileID;
    var blob = Utilities.newBlob(Receipts.html(pay), 'text/html', 'receipt.html').getAs('application/pdf');
    var fileId = Files.storeBlob('RECEIPTS', blob, 'Receipt_' + U.safeFileName(pay.ReceiptNumber) + '_' + pay.StudentID + '.pdf');
    var old = pay.ReceiptFileID;
    U.withLock(function () {
      var row = Db.get(SHEET.PAYMENTS, 'PaymentID', paymentId);
      Db.update(SHEET.PAYMENTS, row, { ReceiptFileID: fileId });
    });
    if (force && old) { try { DriveApp.getFileById(old).setTrashed(true); } catch (e) { /* ignore */ } }
    return fileId;
  },

  /** Student (own receipts) and admin (any) download a receipt PDF. */
  get: function (ctx, p) {
    var pay = Db.get(SHEET.PAYMENTS, 'PaymentID', p.paymentId);
    if (!pay) throw AppError('Receipt not found.', 'NOT_FOUND');
    if (ctx.role === ROLE.STUDENT && pay.StudentID !== ctx.studentId) throw AppError('You do not have access to this receipt.', 'FORBIDDEN');
    var fileId = Receipts.ensure(pay.PaymentID, false);
    return Files.read(fileId, 'Receipt_' + U.safeFileName(pay.ReceiptNumber) + '.pdf');
  },

  regenerate: function (ctx, p) {
    var pay = Db.get(SHEET.PAYMENTS, 'PaymentID', p.paymentId);
    if (!pay) throw AppError('Receipt not found.', 'NOT_FOUND');
    Receipts.ensure(pay.PaymentID, true);
    return Receipts.get(ctx, p);
  }
};

// ======================================================================
// FILE: Results.gs
// ======================================================================
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

// ======================================================================
// FILE: Dashboard.gs
// ======================================================================
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

// ======================================================================
// FILE: Api.gs
// ======================================================================
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
      'auth.forgotStudentPassword': pub('recovering the student password', function (c, p) { return Auth.forgotStudentPassword(p); }),
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

// ======================================================================
// FILE: Setup.gs
// ======================================================================
/**
 * ============================================================================
 *  Setup.gs — first-time installation and maintenance menu.
 *
 *  These functions are meant to be run by the OWNER from the Google Sheet menu
 *  "Success Portal". Each one checks that the caller is the owner, because
 *  every public function of an Apps Script web app can technically be called
 *  from a browser.
 * ============================================================================
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('Success Portal')
      .addItem('1. Set up portal (first time)', 'setupPortal')
      .addItem('Reset admin password', 'resetAdminPassword')
      .addItem('Show portal status / link', 'showPortalStatus')
      .addSeparator()
      .addItem('Load TEST data', 'loadTestData')
      .addItem('Remove TEST data', 'clearTestData')
      .addToUi();
  } catch (e) { /* not opened from a spreadsheet */ }
}

function setupPortal() {
  Setup.assertOwner();
  var ui = Setup.ui();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Open this script from a Google Sheet (Extensions > Apps Script) before running setup.');
  var props = PropertiesService.getScriptProperties();
  props.setProperty('SPREADSHEET_ID', ss.getId());
  if (!props.getProperty('PEPPER')) props.setProperty('PEPPER', U.token());
  Db.resetMemo();

  var warnings = [];
  Object.keys(SCHEMA).forEach(function (name) { warnings = warnings.concat(Setup.ensureSheet(ss, name)); });
  var def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1 && def.getLastRow() === 0) ss.deleteSheet(def);

  Db.resetMemo();
  var existing = {};
  Db.all(SHEET.SETTINGS).forEach(function (r) { existing[r.Key] = true; });
  var missing = DEFAULT_SETTINGS.filter(function (d) { return !existing[d[0]]; })
    .map(function (d) { return { Key: d[0], Value: d[1], Description: d[2] }; });
  if (missing.length) Db.insert(SHEET.SETTINGS, missing);

  var folderUrl = Files.ensureFolders();
  var adminMsg = Setup.ensureAdmin(ui);
  CacheService.getScriptCache().remove('pubinfo');

  var msg = 'Portal is ready.\n\n' + adminMsg + '\n\nDrive folder: ' + folderUrl +
    '\n\nNext: Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone) and open the link.' +
    (warnings.length ? '\n\nWarnings:\n- ' + warnings.join('\n- ') : '');
  Setup.say(ui, 'Success Portal setup', msg);
  return msg;
}

function resetAdminPassword() {
  Setup.assertOwner();
  var ui = Setup.ui();
  Db.resetMemo();
  var admin = Db.first(SHEET.USERS, function (u) { return u.Role === ROLE.ADMIN; });
  if (!admin) { Setup.say(ui, 'Admin password', Setup.ensureAdmin(ui)); return; }
  var pw = Setup.askPassword(ui, 'Choose a NEW password for the admin login (username: ' + admin.Username + ').');
  var generated = false;
  if (!pw) { pw = U.randomPassword(12); generated = true; }
  Db.update(SHEET.USERS, admin, { AuthData: Auth.make(pw), UpdatedAt: U.now() });
  Auth.revoke(admin.UserID);
  Setup.say(ui, 'Admin password', 'Admin password changed.' + (generated ? '\nNew password: ' + pw : ''));
}

function showPortalStatus() {
  Setup.assertOwner();
  var ui = Setup.ui();
  Db.resetMemo();
  var url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) { /* not deployed */ }
  var msg = 'Students: ' + Db.count(SHEET.STUDENTS) + '\nTeachers: ' + Db.count(SHEET.TEACHERS) +
    '\nBatches: ' + Db.count(SHEET.BATCHES) + '\nPayments: ' + Db.count(SHEET.PAYMENTS) +
    '\n\nWeb app link:\n' + (url || '(not deployed yet - use Deploy > New deployment > Web app)');
  Setup.say(ui, 'Portal status', msg);
  return msg;
}

var Setup = {
  ui: function () { try { return SpreadsheetApp.getUi(); } catch (e) { return null; } },

  assertOwner: function () {
    var a = '', e = '';
    try { a = Session.getActiveUser().getEmail(); e = Session.getEffectiveUser().getEmail(); } catch (x) { /* ignore */ }
    if (a && a === e) return;
    if (Setup.ui()) return;
    throw new Error('Only the owner of this project can run this function.');
  },

  say: function (ui, title, msg) {
    if (ui) ui.alert(title, msg, ui.ButtonSet.OK);
    Log.info(title + ': ' + msg);
  },

  askPassword: function (ui, text) {
    if (!ui) return '';
    for (var i = 0; i < 3; i++) {
      var r = ui.prompt('Success Portal', text + '\nAt least 8 characters with letters and numbers.\n(Cancel = generate a random one)', ui.ButtonSet.OK_CANCEL);
      if (r.getSelectedButton() !== ui.Button.OK) return '';
      try { return Auth.validPassword(r.getResponseText()); } catch (e) { ui.alert(e.message); }
    }
    return '';
  },

  ensureAdmin: function (ui) {
    Db.resetMemo();
    var admin = Db.first(SHEET.USERS, function (u) { return u.Role === ROLE.ADMIN; });
    if (admin) return 'Admin account already exists (username: ' + admin.Username + ').';
    var pw = Setup.askPassword(ui, 'Choose a password for the ADMIN login (username: admin).');
    var generated = false;
    if (!pw) { pw = U.randomPassword(12); generated = true; }
    U.withLock(function () { Users.create(ROLE.ADMIN, 'admin', pw, STATUS.ACTIVE); });
    return 'Admin account created.\nUsername: admin' + (generated ? '\nPassword: ' + pw + '\n(write it down, then change it after logging in)' : '');
  },

  /** Creates the sheet / header / formats. Returns a list of warnings. */
  ensureSheet: function (ss, name) {
    var headers = SCHEMA[name], warnings = [];
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getMaxColumns() < headers.length) sh.insertColumnsAfter(sh.getMaxColumns(), headers.length - sh.getMaxColumns());
    var cur = sh.getRange(1, 1, 1, headers.length).getValues()[0];
    var empty = cur.every(function (v) { return v === ''; });
    if (empty) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    else {
      headers.forEach(function (h, i) {
        if (String(cur[i]).trim() !== h) warnings.push('Sheet "' + name + '" column ' + (i + 1) + ' is "' + cur[i] + '" but "' + h + '" was expected.');
      });
    }
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#2a3f9e').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    if (sh.getMaxRows() > 1) Db.applyFormats(sh, name, headers, 2, sh.getMaxRows() - 1);
    try { sh.autoResizeColumns(1, headers.length); } catch (e) { /* ignore */ }
    if ((name === SHEET.USERS || name === SHEET.PAYMENTS) && sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).length === 0) {
      sh.protect().setDescription('Edit only if you know what you are doing').setWarningOnly(true);
    }
    return warnings;
  }
};

// ======================================================================
// FILE: TestData.gs
// ======================================================================
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
