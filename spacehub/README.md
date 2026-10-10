# SpaceHub — Unified Campus Space and Facility Booking Portal

A pilot build of the "Unified Campus Space and Facility Booking Portal" problem
statement: classrooms, event venues, innovation facilities and lost & found,
in one role-based web app designed to eventually sit inside the MyAmrita app
as an embedded section.

## Tech stack

- **React + Vite + Tailwind CSS** — mobile-friendly UI.
- **Supabase** (Postgres + Auth + Realtime) as the production backend. The
  schema uses `EXCLUDE` constraints so **double-booking is impossible at the
  database level**, not just in application code (see `supabase/schema.sql`).
- **Recharts** for the admin utilization dashboard.
- **qrcode.react** for door/check-in QR codes.
- Ships as a standalone app now; see **"Embedding in MyAmrita"** below for the
  intended integration path.

### Runs with or without Supabase

`src/lib/dataClient.js` picks a backend automatically:

- **No `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` set** → the app runs in
  **mock mode**: all data lives in `localStorage` in `src/mock/mockClient.js`,
  seeded from the real Int. M.Sc Data Science VII B timetable. Nothing to
  configure — `npm install && npm run dev` and it works. Good for a demo;
  data is per-browser only.
- **Both set** → the app talks to real Postgres via `src/lib/supabaseClient.js`,
  which exposes the *exact same function names* as the mock client, so no page
  component needs to change when you switch.

## Getting started

```bash
npm install
npm run dev
```

Open the printed localhost URL. The login screen is a role picker (see
"Pilot auth" below) — pick a role, then a demo account, and you're in.

### Connecting real Supabase (optional, for a shared multi-user deployment)

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run `supabase/schema.sql`, then `supabase/seed.sql`.
3. Copy `.env.example` to `.env.local` and fill in the project URL + anon key
   (Project Settings → API).
4. (Optional but recommended) Enable Realtime on the tables listed at the
   bottom of `schema.sql`, and schedule `spacehub_auto_release_bookings()` to
   run every 1–5 minutes (pg_cron, or any external scheduler calling it via
   the Supabase REST/RPC endpoint) so unclaimed rooms free themselves.
5. Restart `npm run dev`. The app will now use `src/lib/supabaseClient.js`.

## Pilot auth: "simple buttons"

There's no real login system to plug into yet, so the login screen lets you
pick a role (Student / Class Representative / Faculty / Facility In-charge /
Event-Space Admin) and then a seeded demo account for that role. This stands
in for the brief's actual plan: reuse the existing Amrita login and derive
the role from existing records (faculty lists, class-rep designations) —
see the comment on the `profiles` table in `supabase/schema.sql` and on
`src/context/AuthContext.jsx`.

## What's implemented

| Module | What it does |
|---|---|
| **Classrooms** (`src/pages/Classrooms`) | Live availability board per date/room/slot. Timetabled classes (imported, admin-editable via `timetable_slots`) are always blocked. Class reps/faculty book instantly, first-come-first-served. Weekly booking-hour cap per role. QR check-in (simulated scan) with 15-minute auto-release. Admin can block a room for a date or cancel any booking. |
| **Event venues** (`src/pages/Events`) | Faculty/admin submit a request = tentative hold. Admin approvals screen groups competing requests by venue+date, shows a **suggested priority score** (event level, academic/non-academic, audience fit, notice given, external guests — `src/lib/priorityScore.js`), lets the admin override with a required reason, and suggests free alternative venues on decline. The event admin can also **publish an event directly** (no scoring/approval queue — they're the one who'd approve it anyway). Every approved event — requested or direct — shows on a public, scrollable "Happening on campus" feed visible to every role. |
| **Facilities** (`src/pages/Facilities`) | Discover-page catalogue (what/where/contact). No induction gate — access to every facility, **HPC included**, runs through one unified pipeline: **Submitted → [Faculty Approval Pending →] Facility Admin Review → Approved / Rejected / Alternative Suggested**. Students/class reps pick a faculty mentor who approves first; faculty/admin requesters skip that step and go straight to the facility administrator. The admin can approve, reject, or **propose a different date/time**, which the requester then accepts (moves the request to that slot) or declines. HPC requests carry an extra **node-hours needed** field (`facility_requests.node_hours_requested`) but go through the exact same approval chain — no separate auto-approve threshold or HPC-only page. |
| **Lost & Found** (`src/pages/LostFound`) | Report an item by **academic block** (not an exact room — the finder rarely knows the room code; room/floor/landmark detail goes in the free-text description instead), with an optional **photo** (resized client-side to a data URL). Notifies everyone who had a timetabled class or an active booking in that block **that day** — faculty teaching there plus anyone who booked a room there. |
| **Admin dashboard** (`src/pages/Admin`) | Classroom utilization and facility-usage charts (Recharts), event-approval funnel, blocked-dates and maintenance-report management, a live-occupancy "emergency headcount" widget. |
| **Maintenance reporting** | "Report an issue" is available from both a classroom's row and a facility's card — a serious report blocks further bookings on that room/facility until resolved. |
| **Open study spaces** | The dashboard's "Open study spaces right now" card surfaces free, unbooked classrooms to any signed-in user. |

These line up with the brief's module table (lost & found → PS 13, emergency
headcount → PS 8, open study spaces → PS 7, maintenance reporting → PS 9).

## Architecture notes

- `src/lib/constants.js` — the shared vocabulary (roles, slot times taken
  from the real timetable image, statuses, weekly caps). Both backends and
  every page read from here so they can't drift apart.
- `src/lib/priorityScore.js` — the event-venue scoring formula, used both for
  the live preview on the request form and for the score stored on creation.
- `src/lib/bus.js` + `src/lib/useLiveData.js` — a tiny pub/sub so any
  mutation (book, approve, induct, report…) refreshes every open view, mock
  or Supabase alike, without a heavier state library.
- `src/mock/mockClient.js` ↔ `src/lib/supabaseClient.js` — field-for-field
  mirrors of each other; `src/lib/dataClient.js` is the only place that
  chooses between them.

## Known pilot simplifications (flagged, not hidden)

- **QR check-in is simulated.** The door QR renders a real `spacehub://checkin/<id>`
  payload (`src/components/qr/RoomQR.jsx`), but there's no camera-based
  scanner wired up yet — the check-in modal has a "simulate scan" button
  instead. Swapping in a camera scanner (e.g. `html5-qrcode`) that reads the
  same payload is a self-contained follow-up.
- **Lost & found notifications are in-app only** (no push/SMS/email) — the UI
  shows who *would* be notified.
- **Lost item photos are stored as a compressed data URL** directly in the
  `lost_items.photo_url` text column (`src/lib/image.js` resizes to ~640px
  before encoding), not in Supabase Storage — simplest thing that works for a
  pilot's volume of photos. Swapping to a `lost-item-photos` Storage bucket
  (upload the file, store the public URL in the same column) is a small,
  self-contained follow-up once photo volume matters.
- **RLS policies in `schema.sql` are pilot-grade** (signed-in users can write;
  reads are public). Before this handles real student data, tighten writes to
  check `profiles.role` per table, per the brief's privacy note on India's
  DPDP Act, 2023.
- **Auto-release** runs client-side on every mock-mode read; on Supabase it
  needs the scheduled `spacehub_auto_release_bookings()` function turned on
  (step 4 above) rather than relying on a client being open.

## Embedding in MyAmrita

Per the brief, the recommended integration path for a pilot is the
**embedded web module**: MyAmrita opens this app inside a webview/iframe-like
surface and passes the logged-in user's token along, so this becomes a
`VITE_...` injected session instead of the role-picker screen. The app is
already a plain Vite build (`npm run build` → static `dist/`) deployable to
Vercel or any static host, which is what that embed would point at.
