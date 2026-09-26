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
