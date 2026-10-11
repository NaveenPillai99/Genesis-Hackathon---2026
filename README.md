# CampusConnect: Unified Campus Resource Management, Academic Scheduling, and Lost & Found Platform

[![Python](https://img.shields.io/badge/Backend-FastAPI_0.136-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React_18_%2B_Vite_5-61DAFB.svg?logo=react)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind_3.4-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com)
[![Tests](https://img.shields.io/badge/Tests-Pytest_Passed-brightgreen.svg?logo=pytest)](https://pytest.org)
[![Compliance](https://img.shields.io/badge/Privacy-India_DPDP_Act_2023_Ready-blue.svg)](#security-and-data-protection)

**CampusConnect** is a full-stack, enterprise-grade university resource allocation and campus workflow platform engineered for the **GENESIS 2026 University Hackathon**. It eliminates physical double-booking, streamlines academic class rescheduling with faculty/advisor approvals, automates lab safety inductions, and provides intelligent, location-and-timetable-aware Lost & Found routing.

---

## 1. System Architecture

```
                          ┌─────────────────────────────────────┐
                          │     React + Vite 5 Frontend         │
                          │   (Tailwind CSS + Recharts UI)      │
                          └──────────────────┬──────────────────┘
                                             │
                       REST API (/api) + Bearer Token / Proxy
                                             │
                          ┌──────────────────▼──────────────────┐
                          │       FastAPI Python Backend        │
                          │  (RBAC Middleware, Router Services) │
                          └──────────┬───────────────┬──────────┘
                                     │               │
                 ┌───────────────────▼──┐       ┌────▼─────────────────┐
                 │  SQLAlchemy ORM      │       │ E-Governance Adapter │
                 │  (SQLite / Postgres) │       │ (AUMS / MyAmrita SSO)│
                 └──────────────────────┘       └──────────────────────┘
```

- **Frontend**: React 18, Vite 5, Tailwind CSS, Recharts for analytics, responsive layout across mobile and desktop. Includes dual-client persistence (direct FastAPI REST client with automatic fallback to high-fidelity in-browser localStorage mock client).
- **Backend**: Python 3.11+ with FastAPI, Pydantic v2 data contracts, and SQLAlchemy ORM.
- **Role-Based Access Control (RBAC)**: Strictly enforced server-side on all protected endpoints.
- **Database**: Zero-configuration SQLite (`campusconnect.db`) with out-of-the-box PostgreSQL support (`DATABASE_URL`).
- **Interactive Documentation**: Auto-generated Swagger UI available at `http://localhost:8000/docs`.

---

## 2. The 9 Demonstration Personas

CampusConnect features demo accounts for all **9 institutional roles**. All passwords are securely hashed with bcrypt (`demo123`). The login interface also features a **One-Click Instant Persona Switcher** for rapid evaluation during judging.

| # | Role Label | Demo Account Name | Email | Password | Primary Key Privileges |
|---|---|---|---|---|---|
| 1 | **Student** | Aarav Menon | `aarav@cb.students.amrita.edu` | `demo123` | View classroom free slots, browse events, report lost items, request inducted labs. |
| 2 | **Class Representative** | Devika Nair | `devika.rep@cb.students.amrita.edu` | `demo123` | Book classrooms for section, **propose class prepone/postpone reschedules**, track requests. |
| 3 | **Class Advisor** | Dr Devika | `devika.advisor@cb.amrita.edu` | `demo123` | **Approve/reject timetable reschedule requests**, receive classroom auto-routed lost items. |
| 4 | **Faculty Member** | Dr Thilaga M | `thilaga@cb.amrita.edu` | `demo123` | Manage teaching schedule, submit event venues, approve student HPC jobs, review reschedules. |
| 5 | **Lab Assistant** | Mr Suresh Kumar | `suresh.lab@cb.amrita.edu` | `demo123` | Toggle machine maintenance downtime, publish equipment slots, record custody. |
| 6 | **Lab Administrator** | Dr Anand Shenoy | `anand.labadmin@cb.amrita.edu` | `demo123` | Configure lab operating policies, grant safety inductions, review lab utilization. |
| 7 | **Central Resource Admin** | Mr Ramesh Iyer | `ramesh.admin@cb.amrita.edu` | `demo123` | Review event venue requests with priority score, resolve booking clashes, campus metrics. |
| 8 | **Student Welfare (Lost Property)** | Ms Priya Balan | `priya.welfare@cb.amrita.edu` | `demo123` | Receive campus lost property, review claims, **record return handover notes & audit**. |
| 9 | **System Administrator** | Prof. K. R. Ramakrishnan | `sysadmin@cb.amrita.edu` | `demo123` | Full system configuration, security audit trail inspection, E-Governance adapter sync. |

---

## 3. Core Modules & Verified Workflows

### A. Classroom Availability & Conflict Prevention
- **Search Filters**: Date, Academic Block (AB1–AB4), Minimum Capacity (50+, 60+, 70+), Slot ID.
- **Double-Booking Prevention**: Backend verifies both imported timetable slots and active reservations (`booked`, `checked_in`). Concurrent or overlapping requests on the same exclusive slot are rejected with HTTP 409 Conflict.
- **QR Check-in & Auto-Release**: Simulated scan completes check-in. Bookings unclaimed after 15 minutes auto-release.

### B. Academic Scheduling (Class Prepone / Postpone)
- **Proposal Flow**: Class Rep or Faculty selects course (e.g., Deep Learning), current schedule (e.g., Friday Slot 2), proposed schedule (Thursday Slot 4), and reason.
- **Real-Time Clash Detection**: System validates target room and slot against timetable to prevent clashes.
- **Official Advisor Review**: Class Advisor evaluates proposal (Approve, Reject, Request Modification). When approved, the system updates the timetable slot live.

### C. Event Venues & Auditoriums
- **Venues**: Amriteshwari Auditorium (450 cap), AB1 Seminar Hall (120 cap), Amphitheatre (800 cap).
- **Explainable Priority Scoring Formula**:
  $$\text{Score} = \text{Level} (\text{Univ: } 40, \text{Dept: } 25, \text{Club: } 10) + \text{Academic} (20) + \text{Guests} (15) + \text{Audience Scale} (\le 25)$$
- **Admin Review Queue**: Resource Admin evaluates competing requests and logs required decision rationale.
- **Public Feed**: Approved events stream directly to the campus public feed.

### D. Innovation Facilities & Labs
- **Catalogue**: 3D Rapid Prototyping Lab, VR/AR Immersive Lab, Electronics Prototyping Bench, HPC GPU Cluster (8x NVIDIA A100).
- **Induction Gating**: Students must hold a valid safety induction record before reserving equipment.
- **HPC Node-Hour Quotas**: Requests $\le 20$ node-hours auto-approve; larger allocations route to faculty supervisor.
- **Maintenance Logging**: Lab staff can take machines offline and record diagnostic reasons.

### E. Lost & Found (Intelligent Auto-Routing Engine)
- **Classroom Auto-Routing**:
  1. Finder reports an item found inside a classroom (e.g., AB1 E-104 at 09:15).
  2. The engine resolves the date to the weekday and time to Slot 2.
  3. The engine looks up the timetable entry (Deep Learning, taught by Dr Thilaga M, advised by Dr Devika).
  4. The report is **automatically assigned to Class Advisor Dr Devika**, notifying her and placing the item in class advisor custody.
- **Non-Classroom Auto-Routing**: Items found in outdoor or common areas (cafeteria, lawns, library) route directly to **Student Welfare Custodian Ms Priya Balan**.
- **Transparent Match Engine**: Suggests possible matches between lost and found items with confidence percentage.
- **Custody Lifecycle**: `Reported` $\to$ `In Custody` $\to$ `Claim Pending` $\to$ `Returned` / `Closed`.
- **Handover Verification**: Custodians verify ownership, record proof notes, log timestamped handover, and update the immutable audit log.

### F. Security, Audit Trail & Analytics
- **Append-Only Audit Log**: Every login, booking, approval, claim, and handover records actor ID, role, action, and timestamp.
- **Utilization Analytics**: Calculated metrics for weekly room capacity allocation %, peak slot distribution, and lost-property resolution rate.
- **E-Governance Adapter**: Documented integration spec for AUMS OIDC/SAML with simulated sync trigger.

---

## 4. Getting Started

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+ and pip (or Docker)

### Option A: Local Development (Fast & Zero-Config)

#### 1. Start the FastAPI Backend
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```
- API will be live at: `http://localhost:8000`
- Interactive Swagger UI: `http://localhost:8000/docs`

#### 2. Start the Frontend
```bash
cd spacehub
npm install
npm run dev
```
- Web App will be live at: `http://localhost:5173`

### Option B: Docker Compose (Single Command)
```bash
docker-compose up --build
```
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`

---

## 5. Automated Test Suite

Run the comprehensive pytest suite covering RBAC, double-booking prevention, timetable change approvals, and lost-and-found auto-routing:

```bash
cd backend
pytest -v
```

Expected result:
```text
tests/test_auth_rbac.py::test_demo_users_count PASSED
tests/test_auth_rbac.py::test_login_success_and_failure PASSED
tests/test_auth_rbac.py::test_rbac_student_blocked_from_audit PASSED
tests/test_auth_rbac.py::test_rbac_sysadmin_allowed_audit PASSED
tests/test_classroom_booking.py::test_availability_calculation PASSED
tests/test_classroom_booking.py::test_booking_conflict_prevention_and_double_booking PASSED
tests/test_classroom_booking.py::test_student_cannot_book_directly PASSED
tests/test_lost_found.py::test_lost_found_classroom_automatic_routing PASSED
tests/test_lost_found.py::test_lost_found_outdoor_routing_to_student_welfare PASSED
tests/test_timetable_change.py::test_timetable_change_request_and_approval_flow PASSED

======================= 10 passed in 1.15s =======================
```

---

## 6. Security and Data Protection (DPDP Act, 2023)

- **Role-Level Masking**: Student roll numbers and private contact numbers are masked in public lost & found browse views.
- **Password Protection**: Plaintext passwords are never stored; standard bcrypt hashing is enforced.
- **Server-Side Authorization**: Endpoints reject unauthorized calls with HTTP 403 Forbidden even if frontend calls are forged.
- **Double-Booking Guarantees**: Prevented through atomic database validations and transactions.

---

## 7. Future Roadmap & Production E-Governance Integration

1. **AUMS Production OIDC Handshake**: Connect live JWT certs from Amrita Identity Provider once credentials are provisioned.
2. **Physical Turnstile / QR Scanner Hardware**: Upgrade the simulated check-in endpoint to read physical optical scanners.
3. **SMS / WhatsApp Gateway Integration**: Push WhatsApp reminders to students when items belonging to their class section are turned in.
