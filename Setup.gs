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
