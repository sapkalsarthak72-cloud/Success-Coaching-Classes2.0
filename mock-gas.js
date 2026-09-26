// Minimal in-memory mock of the Google Apps Script services used by the portal.
const crypto = require('crypto');
const vm = require('vm');
const fs = require('fs');
const path = require('path');

function toBuf(v) {
  if (typeof v === 'string') return Buffer.from(v, 'utf8');
  if (Array.isArray(v)) return Buffer.from(v.map(b => (b + 256) % 256));
  return Buffer.from(v);
}
function toSigned(buf) { return Array.from(buf).map(b => (b > 127 ? b - 256 : b)); }

function makeBlob(data, mime, name) {
  let bytes = toBuf(data);
  const b = {
    getBytes: () => toSigned(bytes),
    getContentType: () => mime,
    getName: () => name,
    setName: (n) => { name = n; return b; },
    getAs: (m) => makeBlob('%PDF-1.4 mock ' + bytes.length, m, name)
  };
  return b;
}

class Range {
  constructor(sh, r, c, nr, nc) { this.sh = sh; this.r = r; this.c = c; this.nr = nr; this.nc = nc; }
  _check() {
    if (this.r < 1 || this.c < 1 || this.r + this.nr - 1 > this.sh.maxRows || this.c + this.nc - 1 > this.sh.maxCols)
      throw new Error('The coordinates of the range are outside the dimensions of the sheet.');
  }
  getValues() {
    this._check();
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = [];
      for (let j = 0; j < this.nc; j++) { const v = (this.sh.data[this.r - 1 + i] || [])[this.c - 1 + j]; row.push(v === undefined ? '' : v); }
      out.push(row);
    }
    return out;
  }
  setValues(vals) {
    this._check();
    if (vals.length !== this.nr || (vals[0] && vals[0].length !== this.nc)) throw new Error('Dimension mismatch ' + vals.length + 'x' + (vals[0] || []).length + ' vs ' + this.nr + 'x' + this.nc);
    this.sh.calls++;
    for (let i = 0; i < this.nr; i++) {
      const rr = this.r - 1 + i;
      this.sh.data[rr] = this.sh.data[rr] || [];
      for (let j = 0; j < this.nc; j++) {
        let v = vals[i][j];
        const fmt = (this.sh.formats[rr] || [])[this.c - 1 + j];
        if (fmt === '@' && v !== '' && v !== null && v !== undefined) v = String(v);
        this.sh.data[rr][this.c - 1 + j] = v;
      }
    }
    return this;
  }
  setNumberFormats(f) {
    this._check();
    for (let i = 0; i < this.nr; i++) {
      const rr = this.r - 1 + i; this.sh.formats[rr] = this.sh.formats[rr] || [];
      for (let j = 0; j < this.nc; j++) this.sh.formats[rr][this.c - 1 + j] = f[i][j];
    }
    return this;
  }
  clearContent() {
    for (let i = 0; i < this.nr; i++) { const rr = this.r - 1 + i; if (this.sh.data[rr]) for (let j = 0; j < this.nc; j++) this.sh.data[rr][this.c - 1 + j] = ''; }
    return this;
  }
  setFontWeight() { return this; } setBackground() { return this; } setFontColor() { return this; }
}

class Sheet {
  constructor(name) { this.name = name; this.data = []; this.formats = []; this.maxRows = 1000; this.maxCols = 26; this.calls = 0; this.prot = []; }
  getRange(r, c, nr, nc) { return new Range(this, r, c, nr || 1, nc || 1); }
  getDataRange() {
    const lr = this.getLastRow() || 1; let lc = 1;
    this.data.forEach(row => { row.forEach((v, i) => { if (v !== '' && v !== undefined) lc = Math.max(lc, i + 1); }); });
    return new Range(this, 1, 1, lr, lc);
  }
  getLastRow() {
    for (let i = this.data.length - 1; i >= 0; i--) if ((this.data[i] || []).some(v => v !== '' && v !== undefined)) return i + 1;
    return 0;
  }
  getMaxRows() { return this.maxRows; } getMaxColumns() { return this.maxCols; }
  insertRowsAfter(after, n) { this.maxRows += n; }
  insertColumnsAfter(after, n) { this.maxCols += n; }
  setFrozenRows() {} autoResizeColumns() {}
  getProtections() { return this.prot; }
  protect() { const p = { setDescription() { return p; }, setWarningOnly() { return p; } }; this.prot.push(p); return p; }
}

class Spreadsheet {
  constructor() { this.sheets = []; }
  getId() { return 'SS1'; }
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
  insertSheet(n) { const s = new Sheet(n); this.sheets.push(s); return s; }
  getSheets() { return this.sheets; }
  deleteSheet(s) { this.sheets = this.sheets.filter(x => x !== s); }
}

function createEnv() {
  const store = { props: {}, cache: {}, ss: new Spreadsheet(), files: {}, folders: {}, seq: 0 };
  const now = () => new Date();
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const env = {
    console,
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' },
      computeDigest: (algo, v) => toSigned(crypto.createHash('sha256').update(toBuf(v)).digest()),
      base64Encode: (v) => toBuf(v).toString('base64'),
      base64Decode: (s) => { if (/[^A-Za-z0-9+/=]/.test(s)) throw new Error('bad base64'); return toSigned(Buffer.from(s, 'base64')); },
      getUuid: () => crypto.randomUUID(),
      newBlob: (d, m, n) => makeBlob(d, m || 'text/plain', n || 'blob'),
      formatDate: (d, tz, fmt) => {
        const y = d.getFullYear(), mo = pad(d.getMonth() + 1), da = pad(d.getDate()), h = pad(d.getHours()), mi = pad(d.getMinutes()), s = pad(d.getSeconds());
        const ms = pad(d.getMilliseconds(), 3);
        return fmt.replace('SSS', ms).replace('yyyy', y).replace('MM', mo).replace('dd', da).replace('HH', h).replace('mm', mi).replace('ss', s);
      }
    },
    Session: { getScriptTimeZone: () => 'Asia/Kolkata', getActiveUser: () => ({ getEmail: () => 'owner@test' }), getEffectiveUser: () => ({ getEmail: () => 'owner@test' }) },
    CacheService: { getScriptCache: () => ({
      get: k => (k in store.cache ? store.cache[k] : null),
      put: (k, v) => { if (String(v).length > 100000) throw new Error('Argument too large'); store.cache[k] = String(v); },
      remove: k => { delete store.cache[k]; } }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => (k in store.props ? store.props[k] : null), setProperty: (k, v) => { store.props[k] = String(v); } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => store.ss, openById: () => store.ss,
      getUi: () => { throw new Error('no ui'); }, ProtectionType: { SHEET: 'SHEET' }
    },
    ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/TEST/exec' }) },
    DriveApp: (() => {
      const mkFolder = (name) => { const id = 'FOLDER' + (++store.seq); const f = { getId: () => id, getUrl: () => 'https://drive/' + id, isTrashed: () => false,
        createFolder: (n) => mkFolder(n), createFile: (blob) => mkFile(blob) }; store.folders[id] = f; return f; };
      const mkFile = (blob) => { const id = 'FILE' + (++store.seq); let trashed = false; const f = { getId: () => id, getBlob: () => blob, getName: () => blob.getName(),
        isTrashed: () => trashed, setTrashed: (t) => { trashed = t; } }; store.files[id] = f; return f; };
      return { createFolder: mkFolder, getFolderById: (id) => { if (!store.folders[id]) throw new Error('no folder'); return store.folders[id]; },
        getFileById: (id) => { if (!store.files[id]) throw new Error('no file'); return store.files[id]; } };
    })()
  };
  env._store = store;
  return env;
}

function loadPortal(srcDir) {
  const env = createEnv();
  const ctx = vm.createContext(env);
  const order = ['Config', 'Utils', 'Db', 'Settings', 'Auth', 'Users', 'Students', 'Teachers', 'Batches', 'Attendance', 'Notifications', 'Content', 'Fees', 'Receipts', 'Results', 'Dashboard', 'Api', 'Setup', 'TestData'];
  if (process.env.BUNDLE) vm.runInContext(fs.readFileSync(process.env.BUNDLE, 'utf8'), ctx, { filename: 'Code.gs' });
  else order.forEach(f => vm.runInContext(fs.readFileSync(path.join(srcDir, f + '.gs'), 'utf8'), ctx, { filename: f + '.gs' }));
  return ctx;
}
module.exports = { loadPortal, makeBlob };
