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
