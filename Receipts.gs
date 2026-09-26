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
