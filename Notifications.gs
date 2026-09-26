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
