# Success Coaching Classes Portal     https://script.google.com/macros/s/AKfycbx0w5pLZ5Ar2iEEsho9NqpnwzjyiEb5N3z2Njsj5D3WVemeW2_Fn00fSBDJ6pyz2TkN/exec

https://docs.google.com/spreadsheets/d/1Psg1Xq6AICv1BjwpgFSKcMQ8k6M6LxJ4j0QTo7Oi8-w/edit?usp=sharing








A complete student / teacher / admin web portal for a coaching institute (Classes 8, 9, 10 and expandable),
built with **Google Apps Script + Google Sheets + Google Drive**. No server, no monthly cost.

* Students: attendance, assignments, study material, results, timetable, fees, PDF receipts, events, notifications
* Teachers: mark attendance, post assignments / material, enter results, events, timetable
* Admin: students, teachers, batches, approvals, fees, payments + receipts, results, settings, everything above

---------------------------------------------------------------------

## 1. Install in 10 minutes (quick method — only 2 files to paste)

You need a Google account (a Google Workspace account is recommended for a real institute — see "Limits").

1. Go to <https://sheets.google.com> and create a **blank spreadsheet**. Name it e.g. `Success Portal Database`.
2. In the spreadsheet click **Extensions → Apps Script**. A code editor opens.
3. Left side, click **Project Settings** (gear icon) → tick **Show "appsscript.json" manifest file in editor**.
   Go back to **Editor**, open `appsscript.json`, delete everything and paste the content of
   `quick-install/appsscript.json`. (This sets the India time zone and the web-app permissions.)
4. Open `Code.gs`, delete everything, paste the whole content of `quick-install/Code.gs`.
5. Click **+ → HTML**, name it exactly `Index` (capital I, no extension) and paste the whole content of
   `quick-install/Index.html`.
6. Press **Save** (Ctrl+S). Close the editor tab, go back to the spreadsheet and **reload the page**.
   After a few seconds a new menu **Success Portal** appears.
7. **Success Portal → 1. Set up portal (first time)**.
   Google asks for permission the first time: *Continue → choose your account → Advanced → "Go to … (unsafe)" → Allow*.
   (It says "unsafe" only because you wrote the script yourself and did not submit it to Google.)
   Run the menu item again if it stopped after the permission screen.
   * It creates all sheets, default settings and the Drive folder *SUCCESS COACHING CLASSES*.
   * It asks you for the **admin password** (username is `admin`).
8. In the Apps Script editor: **Deploy → New deployment → gear icon → Web app**
   * Execute as: **Me**
   * Who has access: **Anyone**
   * Click **Deploy** and copy the **Web app URL**. This is the link you give to students and teachers.
9. Open the link, sign in as `admin`.
10. In the portal: **Settings** (institute name, address, phone, logo, academic year) → **Teachers** → **Batches** → **Students** → **Fees & Payments**.

> Want to look around first? **Success Portal → Load TEST data** creates 5 teachers, 36 students, 12 batches with attendance,
> assignments, results, fees and payments. All accounts use password `Test@1234`
> (teachers `TEST-T1 … TEST-T5`, students `TEST-S001 … TEST-S036`).
> **Success Portal → Remove TEST data** deletes exactly those rows (everything is marked `TEST-` / `(TEST)`), real data is untouched.

### Updating later
Paste the new `Code.gs` / `Index.html`, then **Deploy → Manage deployments → ✏ Edit → Version: New version → Deploy**.
The link stays the same. (Just saving the code does NOT update the live web app.)

### Developer method (clasp)
`modular/` contains every module as its own file (Config, Utils, Db, Auth, … and Js_*.html).
Use `npm i -g @google/clasp && clasp login && clasp create --type sheets && clasp push` from that folder.
`source/build.py` regenerates `quick-install/` and `modular/` from `source/src/`.

---------------------------------------------------------------------

## 2. Daily use

| Who | What to do |
|---|---|
| **Student / teacher (new)** | Login page → *Register*. They receive an ID (`STU0001` / `TCH001`). Admin must approve. |
| **Admin: approvals** | *Approvals* → Approve (choose the student's batches) or Reject. |
| **Admin: fees** | *Fees & Payments* → *Assign fees* to a student / a batch / a whole class → *Pay* on a row → receipt PDF is created. Partial payments (instalments) are supported. |
| **Teacher: attendance** | *Attendance* → batch + date → tap Present / Absent → *Save*. Editable for 30 days. |
| **Teacher: assignments** | *Assignments → New* → pick batch, title, due date, PDF. The batch's students get a notification automatically. |
| **Teacher: results** | *Results* → batch, exam name, max marks → enter marks. Percentage and grade are automatic. |
| **Forgot password** | Admin → *Students / Teachers* → *Reset password* (a temporary password is shown once). Admin's own password: menu *Success Portal → Reset admin password*. |
| **Add a class (e.g. 11)** | *Settings → Classes offered* → `8,9,10,11`. Nothing else to change. |

Batch names must start with the class: `10-A-MATH`, `9-B-SCI`. A batch = class + subject + teacher + schedule
(`Mon/Wed/Fri 5 PM`, `Mon-Sat 4:30 PM - 6 PM`). The **timetable is generated from the schedule text**.
A student can be in several batches (Maths + Science + English of the same class).

---------------------------------------------------------------------

## 3. Architecture

```
Browser (single page app: Index.html + Styles + Js_*.html, no framework)
   │  google.script.run.api(action, token, payload)     ← the ONLY function the browser can call
   ▼
Api.gs        route table: action → allowed roles → module           (security gate #1: role)
   ▼
Modules       Auth / Users / Students / Teachers / Batches / Attendance / Content
              (assignments, materials, events) / Fees (+payments) / Receipts / Results /
              Notifications / Dashboard / Settings                   (security gate #2: ownership, business rules)
   ▼
Db.gs         repository layer – the ONLY code that reads/writes sheets (one read per sheet per request,
              one write per bulk operation, memo + short cache for Batches/Settings)
   ▼
Google Sheets (13 tabs)   Google Drive (assignments, materials, receipts, logo — private files)
```

Why the layers matter: to move to Firebase/Supabase/SQL later you re-implement **Db.gs only**; the UI and the rules stay.

### Sheets (created automatically)

| Sheet | Columns |
|---|---|
| Users | UserID, Username, AuthData (salted hash — never plain passwords), Role, Status, NotifSeenAt, CreatedAt, UpdatedAt |
| Students | StudentID, UserID, Name, Class, **Batch** (comma list), Phone, Status, CreatedAt, UpdatedAt |
| Teachers | TeacherID, UserID, Name, Subject, Phone, Status, CreatedAt, UpdatedAt |
| Batches | Batch, Class, Subject, Teacher, Schedule, Status |
| Attendance | Date, Batch, Present, Absent, PresentIDs, AbsentIDs, Remarks, MarkedBy, UpdatedAt |
| Assignments | AssignmentID, Batch, Subject, Title, Description, FileID, FileName, IssueDate, DueDate, Status, CreatedBy, CreatedAt |
| Materials | MaterialID, Batch, Subject, Title, Description, FileID, FileName, Date, Status, CreatedBy |
| Fees | StudentID, FeeType, TotalFee, Discount, FinalFee, Paid, Remaining, Status, DueDate, UpdatedAt |
| Payments | PaymentID, StudentID, FeeType, Amount, Date, PaymentMode, ReceiptNumber, PreviousBalance, RemainingBalance, Notes, ReceiptFileID, CreatedBy, CreatedAt |
| Results | Exam, Batch, Subject, StudentID, Marks, MaxMarks, Percentage, Grade, Remarks, EnteredBy, UpdatedAt |
| Notifications | NotificationID, Date, Target, Title, Message, CreatedBy |
| Events | EventID, Title, Description, EventType, Date, Time, Target, CreatedBy, CreatedAt |
| Settings | Key, Value, Description |

You may look at / filter / export these sheets freely (e.g. for accounting). Please do not rename or reorder header cells.
`Users` and `Payments` carry a "warning before editing" protection.

### Decisions that differ from the "obvious" design (and why)

1. **Attendance = one row per batch per day** (present list + absent list), not one row per student.
   With 2,000 students a per-student design creates ~1 million rows a year and every screen slows down;
   this design stays around 20,000 rows a year and is still readable (`AbsentIDs: STU0004, STU0009`).
2. **A student can belong to several batches** (`Batch` = comma list) because a class has several subjects/teachers.
3. **Notification read state** = one "seen up to" timestamp per user (`Users.NotifSeenAt`) instead of a row per user per notification.
   The bell shows unread; *Mark all as read* clears it.
4. Extra columns that are genuinely needed: `Payments.FeeType / PreviousBalance / RemainingBalance / ReceiptFileID`
   (receipts must show them and never change afterwards), `Fees.DueDate`, `Results.Batch / Percentage`, `Events` and its sheet
   (events need storage), IDs for notifications and events. Nothing else was added.
5. Fee identity is `StudentID + FeeType` (e.g. *Course Fee 2026-27*, *Monthly Fee - Oct 2026*). Instalments = several payments on one fee.

### IDs and receipts
`STU0001`, `TCH001`, `ASG0001`, `MAT0001`, `EVT0001`, `PAY000001`, `NTF00001`, `USR00001`.
Receipt numbers: `<prefix>-<academic year>-<sequence>` → `SCC-2627-000001` (prefix and year from *Settings*).
Counters live in Script Properties and are protected by a lock, so two people saving at the same second never get the same number.

### Who can do what (enforced on the server)

| | Student | Teacher | Admin |
|---|---|---|---|
| Own dashboard / attendance / fees / results | ✔ own only | – | – |
| Assignments, material, events | view own batches | create/edit for **own batches** | everything |
| Mark attendance | ✘ | own batches, last 30 days | any batch, any date |
| Enter results | ✘ | own batches | any |
| Students list | ✘ | students of own batches | all |
| Teachers, batches, approvals, settings | ✘ | view own batches | ✔ |
| Fees, payments, receipts | own | ✘ | ✔ |
| Notifications | receive | receive | send / delete |

---------------------------------------------------------------------

## 4. Security notes (please read)

* Every request carries a random 64-character session token that the **server** checks; role and ownership are re-checked
  for each action. Hiding a button in the UI is never the only protection.
* Passwords: salted + peppered, 300 rounds of SHA-256 (Apps Script has no bcrypt). 5 wrong passwords lock a username for 15 minutes.
  The *pepper* is stored in Script Properties — **do not delete Script Properties**, or every password stops working
  (you could then only recover the admin via the menu).
* Sessions last up to 6 hours (Apps Script cache limit) and are cancelled immediately when the admin deactivates a user or resets a password.
* Uploads are checked by extension **and** file signature, max 10 MB, and stored privately in Drive. Students download files only through
  the server after their batch membership is checked. Nobody gets a public Drive link.
* All text is HTML-escaped before display; sheet cells are text-formatted so `=formulas` typed by users are never executed.
* Sensitive setup functions (`setupPortal`, `loadTestData` …) refuse to run unless the project owner runs them.
* Errors are logged in *Apps Script → Executions*; users only see friendly messages.

Honest limits: this is suitable for a coaching institute, not for banking. Traffic passes through Google (HTTPS).
Anyone with edit access to the spreadsheet can read/edit data, so **share the sheet only with people you trust** and keep the Apps Script project private.

---------------------------------------------------------------------

## 5. Limits, quotas and backups

* **Daily script runtime**: free Gmail accounts ≈ 90 min/day, Google Workspace ≈ 6 h/day. Each page opening is ~0.2–1 s of runtime.
  For 2,000 students use a **Workspace account** (or expect students to be limited on very busy days). The portal minimises calls:
  one request per dashboard, no polling, admin dashboard cached 60 s.
* Up to ~30 requests can run at the same instant; writes are serialised by a lock (≤25 s wait, then a friendly "try again").
* Sheets: 10 million cells per spreadsheet. Attendance ≈ 9 cells × 20k rows/year ≈ 0.2 M — fine for many years.
* Uploads 10 MB each. Keep the logo below ~60 KB (300 KB max) so the login page loads fast.
* **Backups**: *File → Make a copy* of the spreadsheet regularly (e.g. monthly), and keep the Drive folder. A copy keeps all data; the
  portal itself is re-created by pasting the code into the copy and running *Set up portal* again (existing sheets are kept).
* Academic year change: update *Settings → Academic year* (receipts pick it up). Old data stays; assign new fees for the new year.

---------------------------------------------------------------------

## 6. Troubleshooting

| Problem | Fix |
|---|---|
| Menu *Success Portal* missing | Reload the spreadsheet; check the code is saved in `Code.gs`. |
| "Portal not set up yet" page | Run *Success Portal → Set up portal*. |
| Blank page / old version after editing code | *Deploy → Manage deployments → Edit → New version*. |
| "Authorization required" | Run *Set up portal* once from the menu and accept the permissions. |
| "The system is busy" | Two people saved at the same moment for too long – press the button again. |
| Student cannot log in | Is the account *Approved / Active*? Use *Reset password*. Username = Student ID (`STU0001`). |
| Receipt PDF has no logo | Upload a small PNG/JPG in *Settings* and generate the receipt again (*Fees → Payment history → Receipt*). |
| Someone typed a wrong payment | Payments cannot be deleted from the app on purpose (audit trail). Record a corrected fee (edit fee) or fix the sheet row carefully. |

---------------------------------------------------------------------

## 7. What was tested (and what was not)

Tested by me before delivery:
* 226 automated backend checks running the real code against an Apps Script emulator (auth, lockout, registration/approval, every
  permission rule, attendance rules, uploads, fees/payments arithmetic and receipt numbers, results, notifications, test-data load/remove).
* The real user interface was driven in a headless Chrome (27 end-to-end checks + page-by-page smoke tests) for admin, teacher and student on desktop and phone sizes: every page,
  registration → approval → payment → receipt download, attendance saving, file upload/download, result entry, settings, and an XSS attempt.
* Load check with 2,000 students, 4,000 payments and ~19,000 attendance rows: all operations are fast in code (real speed is then
  limited by Google's Sheets read time, ~1 s for the biggest screens).

**Not possible for me:** running inside Google's own servers. The first live run may reveal small environment differences
(for example the look of the PDF produced by Google's HTML→PDF converter). If something behaves differently, check
*Apps Script → Executions* for the error text.

---------------------------------------------------------------------

## 8. Roadmap (not in this version, easy to add on the same architecture)

Email/WhatsApp/SMS notifications, online payments, parent login, timetable clash detection, per-student attendance
alerts, exam analytics and rank lists, archived academic years, payment reversal with audit log, file/photo gallery, multi-branch support.


---------------------------------------------------------------------

## 9. Re-running the tests (developers)

`source/tests/` contains the Apps Script emulator (`mock-gas.js`) and the tests:
`node backend.test.js`, `node unit.test.js`, `node scale.test.js`; browser tests need Playwright (`node e2e.js`, `python3 ui_smoke.py`).
