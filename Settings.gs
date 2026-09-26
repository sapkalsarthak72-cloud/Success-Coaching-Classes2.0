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
