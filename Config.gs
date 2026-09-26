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
