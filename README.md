# AttendX API

NestJS backend for **AttendX — Secure Attendance. Smarter Campus.**, the
university attendance system whose Flutter UI this pairs with. Implements
auth, courses, live QR attendance sessions (with rotating tokens and a
WebSocket feed), attendance records, CSV/Excel export, and offline sync —
everything the mobile app's mocked services expect, for real.

Built, compiled, and exercised end-to-end (register → login → create
course → enroll → start session → scan QR → mark attendance → end session
→ export → offline sync) in the environment this was generated in — not
just written against the API surface blind.

## Quick start

```bash
npm install
npm run start:dev
```

The API runs on **http://localhost:3000/api**, with interactive Swagger
docs at **http://localhost:3000/api/docs**. No external database to set
up — it uses a local SQLite file (`attendx.sqlite`, auto-created).

Seed some demo data (a lecturer, a student, two courses, one enrollment
with attendance history already on the books):

```bash
npm run seed
```

Demo accounts after seeding:
- Lecturer: `s.johnson@uniport.edu.ng` / `password123`
- Student: `nicholas.johnson@uniport.edu.ng` / `password123`

## Pointing the Flutter app at this API

The mobile app currently runs entirely on mock services
(`lib/shared/services/Mock*Service`). To connect it to this backend:

1. Add an HTTP client (`dio` or `http`) and a WebSocket client
   (`socket_io_client`) to the Flutter project.
2. Implement `Rest*Service` classes against the endpoints below for each
   interface in `lib/shared/services/` (`AuthService`, `CourseService`,
   `AttendanceService`, `SessionService`, `VerificationService`,
   `SyncService`, `ExportService`).
3. Swap the instantiation in `lib/core/state/app_state.dart`.

No screen changes needed — see the "Swapping in a real backend" section
of the Flutter app's README for the same wiring from the other side.

## API overview

All routes are prefixed with `/api`. Auth is a Bearer JWT (from
`/auth/login` or `/auth/register/*`) except where noted `(public)`.

### Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register/student` | (public) |
| POST | `/auth/register/lecturer` | (public) |
| POST | `/auth/login` | (public) — `identifier` can be email, Student ID, or Staff ID |

### Users
| Method | Path | Notes |
|---|---|---|
| GET | `/users/me` | Returns the Student or Lecturer profile shape the app expects |
| PATCH | `/users/me` | Update name/department/faculty/avatar |

### Courses
| Method | Path | Notes |
|---|---|---|
| GET | `/courses` | Enrolled courses (student) or taught courses (lecturer) |
| GET | `/courses/:id` | Role-aware single course view |
| POST | `/courses` | Lecturer only |
| PATCH | `/courses/:id` | Lecturer only, own courses |
| POST | `/courses/:id/enroll` | Lecturer only — body `{ studentId }` |
| GET | `/courses/:id/students` | Lecturer only — enrolled roster |

### Sessions (live attendance)
| Method | Path | Notes |
|---|---|---|
| GET | `/sessions/today` | Lecturer's sessions for today's weekday |
| POST | `/sessions/start` | Body `{ courseId }` — generates a fresh QR secret |
| GET | `/sessions/:id` | Session + live present count |
| GET | `/sessions/:id/qr` | Current rotating token + seconds until refresh |
| POST | `/sessions/:id/pause` \| `/resume` \| `/end` | |

**WebSocket** (`/sessions` namespace): join room via `session:join` with
the session id; receive `attendance:new` (present count ticks up) and
`session:status` events live as students scan and the lecturer controls
the session.

### Attendance
| Method | Path | Notes |
|---|---|---|
| POST | `/attendance/mark` | Student — verifies QR token + BLE + liveness, then records |
| GET | `/attendance/me` | Student's history, optional `?courseId=` |
| GET | `/attendance/course/:courseId` | Lecturer roster, filters: `?date=&student=&status=` |

### Export & Sync
| Method | Path | Notes |
|---|---|---|
| GET | `/export/course/:courseId?format=csv\|excel` | Downloads the file directly |
| POST | `/sync/attendance` | Batch-sync offline-recorded attendance, idempotent on `clientRecordId` |

## What's real vs. what's a seam for later

- **QR rotation** is a real HMAC-SHA256 time-step token (`sessions/utils/totp.util.ts`),
  not a placeholder — it actually rotates and actually gets verified
  server-side against a per-session secret. Swap in strict RFC 6238 or a
  different scheme by editing just that file.
- **BLE proximity** and **face liveness** are accepted as booleans/RSSI
  numbers from the client (`MarkAttendanceDto`) and checked against a
  configurable threshold — this is the seam where real BLE ranging and a
  real liveness model plug in; the verification *call site* in
  `AttendanceService.markAttendance` doesn't need to change, only what
  feeds those two fields.
- **Offline sync** trusts the client's claim that verification already
  happened before persisting — see the doc comment in `sync.service.ts`
  for the security tradeoff and what a hardened version would add
  (a signed proof captured at scan time).
- **Schema migrations**: `synchronize: true` (auto schema sync) is used
  for MVP speed. Turn it off and add TypeORM migrations before this ever
  touches a real database with data worth keeping.

## Project layout

```
src/
  common/           # Guards, decorators, enums, exception filter, shared interfaces
  config/           # Typed configuration (env-driven)
  modules/
    auth/           # Register/login, JWT strategy
    users/          # Profile
    courses/        # Courses + enrollments
    sessions/       # Live attendance sessions, QR token utility, WebSocket gateway
    attendance/     # Marking attendance, history, course roster
    export/         # CSV/Excel generation
    sync/           # Offline-attendance batch sync
    database/seeds/ # Demo data seed script
```

## Environment variables

See `.env.example`. Sensible defaults are baked in via
`src/config/configuration.ts`, so the app runs with zero configuration
out of the box — only override `JWT_SECRET` before this goes anywhere
near production.
