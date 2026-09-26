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
