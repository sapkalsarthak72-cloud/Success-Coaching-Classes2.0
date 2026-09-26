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
