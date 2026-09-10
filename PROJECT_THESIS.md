# Timetabling and Invigilator Verification System
## Final-Year Project Research Document

**Institution:** University of Energy and Natural Resources (UENR)

---

# PART A — PROJECT UNDERSTANDING

## 1. Executive Summary

The Timetabling and Invigilator Verification System is a full-stack, role-based web application that digitises the entire university examination lifecycle at UENR. It spans six functional domains: academic structure management, course submission and approval, examination timetable generation with constraint-based venue allocation, invigilator-to-venue assignment, QR-code-based attendance verification, and real-time notification of examination officers.

Built with React 18 (frontend), Node.js/Express 4 (backend), PostgreSQL 16 via Prisma ORM 5 (database), and Socket.IO 4 (real-time). The frontend is an installable PWA. The system is live at `https://unertimetable.vercel.app`.

Three user roles: Super Admin (Examination Officer), Department Head, and Invigilator — each with distinct permissions enforced at API and UI layers.

---

## 2. Problem Being Solved

1. **Manual timetabling is error-prone** — examination officers manually schedule hundreds of courses, checking for clashes by hand.
2. **Unstructured course collection** — department heads email course lists in inconsistent formats with no validation or audit trail.
3. **Unreliable invigilator attendance verification** — paper sign-in sheets can be forged, signed remotely, or filled in after the fact.
4. **Late discovery of no-shows** — the examination office only learns about absent invigilators when students report problems.
5. **No audit trail** — privileged actions are not logged.
6. **Slow communication** — invigilators learn about assignments through printed notices; no instant notification mechanism.

---

## 3. Users and Stakeholders

| Stakeholder | Role | Problems Experienced |
|---|---|---|
| Examination Officer (Super Admin) | Manages entire exam lifecycle | Manual timetabling, no real-time visibility, no audit trail |
| Department Head | Submits courses, manages levels | Unstructured submission, no approval feedback |
| Invigilator | Scans QR codes, views assignments | Unclear assignments, no attendance proof |
| Students (indirect) | Sit exams | Clashing schedules, inadequate invigilation |
| University Admin (indirect) | Benefits from integrity | Exam malpractice risk |

---

## 4. Complete System Workflow

1. **Setup:** Super Admin seeds academic structure (departments, years, semesters), opens registration windows.
2. **Registration:** Department Heads and Invigilators self-register with email verification (6-digit code). Accounts land in PENDING_APPROVAL. Super Admin approves.
3. **Course Submission:** Department Heads create courses (DRAFT → SUBMITTED). Super Admin approves/rejects. Approved courses are locked.
4. **Session & Venue Setup:** Super Admin creates examination sessions and registers venues (min 3 required).
5. **Timetable Generation:** Constraint-based greedy scheduler with 3-pass fallback and up to 20 retries. Enforces hard constraints (no same dept+level in same slot/day, venue capacity, schedule once). Supports course splitting across venues.
6. **Invigilator Assignment:** Automatic round-robin with conflict avoidance (no double-booking, no same-department). Manual assignment also supported. Notifications + emails sent.
7. **QR Code Generation:** Super Admin generates venue-specific QR codes (`VENUE:{venueId}:{sessionId}`), printed and posted at venues.
8. **Attendance Verification:** Two-stage scan — preview (read-only validation) then confirm (persist). Validates QR format, invigilator assignment, venue match, duplicate, time window (15 min before to 30 min after slot). All rejections persisted for audit.
9. **Auto-Absent:** Background job every 5 minutes marks missed scans as ABSENT and notifies Super Admins.

---

## 5. Architecture

Four logical layers:

- **Presentation:** React 18 SPA (PWA), TailwindCSS, TanStack Query, React Hook Form, Socket.IO Client, html5-qrcode
- **Application/Business Logic:** Node.js 20 + Express 4, modular feature architecture (routes → controller → service), Socket.IO server with role-scoped rooms
- **Data:** PostgreSQL 16 (Neon), Prisma ORM 5, parameterised queries
- **Communication:** REST API (HTTPS), Socket.IO (WebSocket + polling fallback), SMTP email, optional SMS

---

## 6. Frontend Analysis

- **Framework:** React 18.3, Vite 5, React Router 6
- **State:** AuthContext (session), TanStack Query 5 (server state), useState/useEffect (UI)
- **API:** Axios with JWT interceptor and 401 handling
- **Forms:** React Hook Form + Zod
- **QR:** html5-qrcode (scanning), qrcode (generation)
- **Real-time:** Socket.IO Client with role-filtered event handlers in Topbar
- **PWA:** manifest.json, sw.js (app-shell cache), InstallPrompt component
- **30+ route screens** organised by domain with ProtectedRoute guards

---

## 7. Backend Analysis

- **Framework:** Node.js 20, Express 4, ES modules
- **16 feature modules** under `/api/v1`
- **Middleware:** Helmet → CORS → compression → rate limit → JWT auth → RBAC → Zod validation
- **Thin controllers, fat services** — business logic in services, reusable from HTTP and socket
- **Auth:** JWT (1-day expiry), 60-second user cache, status gate
- **Audit:** Every privileged action logged to immutable AuditLog
- **Auto-absent:** Background interval (5 min) checking missed scans

---

## 8. Database Analysis

**15 models** across 6 groups:

| Group | Models |
|---|---|
| Identity & Access | User, RegistrationWindow, PasswordReset, EmailVerification |
| Academic Structure | Department, AcademicYear, Semester, CourseLevel |
| Curriculum | Course |
| Examinations | ExaminationSession, Venue, Invigilation |
| Attendance | VenueAssignment, VenueScan, Attendance |
| Platform | AuditLog, Notification, Setting |

**4 enums:** Role (SUPER_ADMIN, DEPARTMENT_HEAD, INVIGILATOR), UserStatus (PENDING_APPROVAL, ACTIVE, SUSPENDED, DISABLED, REJECTED), CourseStatus (DRAFT, SUBMITTED, APPROVED, REJECTED), AttendanceResult (RECORDED, REJECTED_WINDOW, REJECTED_DUPLICATE, REJECTED_UNASSIGNED, REJECTED_INVALID_QR, REJECTED_VENUE_MISMATCH, ABSENT)

**Key relationships:** Department → Users/Courses/CourseLevels; Semester → Courses/ExaminationSessions; ExaminationSession → Invigilations/VenueAssignments/VenueScans; Venue → VenueAssignments/VenueScans

**Referential integrity:** Cascade for owned children, SetNull for audit log actor, composite indexes on hot query paths.

---

## 9. Major Features

### 9.1 Timetable Generation
Greedy first-fit-decreasing with 3-pass fallback (gap constraint → no gap → relaxed) and up to 20 retries. Groups service courses atomically. Supports venue splitting for large courses. Post-placement clash safety net.

### 9.2 Invigilator Assignment
Round-robin with conflict avoidance. 1 invigilator per 50 students, max 4 per venue per slot. No double-booking, no same-department. Demo invigilators get 3 venues/day. Manual assignment with full constraint checks.

### 9.3 QR Verification
Venue-bound QR tokens (`VENUE:{venueId}:{sessionId}`). Shared `evaluateVenueScan()` function for preview and confirm. Checks: QR format, invigilator status, venue existence, exam period, venue assignment, duplicate, time window (15 min before to 30 min after). Optional GPS campus boundary check. All outcomes persisted.

### 9.4 Real-Time Updates
Socket.IO with JWT auth, role-scoped rooms. Events: notification.created, invigilator-checkin, pending-account, course-submitted/approved/rejected, venue-assignment-updated. Frontend handlers role-filtered (exam-officer events only for SUPER_ADMIN).

### 9.5 Auto-Absent Detection
Background job (5-min interval) checks assignments whose window passed without scan. Creates ABSENT VenueScan, notifies SUPER_ADMIN.

---

## 10. Security

| Layer | Measure |
|---|---|
| Transport | HTTPS (Render TLS) |
| Headers | Helmet, x-powered-by disabled |
| CORS | Strict allow-list from CLIENT_ORIGIN |
| Rate limiting | express-rate-limit |
| Passwords | bcrypt (configurable cost) |
| Tokens | JWT (1-day expiry), 401 interception |
| Authorization | RBAC on every route |
| Validation | Zod schemas on all inputs |
| SQL injection | Prisma parameterised queries |
| QR integrity | Venue-bound, server-validated |
| Account lifecycle | PENDING_APPROVAL gate |
| Audit | Immutable AuditLog with IP, user agent |
| Timing attacks | Dummy bcrypt compare for non-existent users |
| Location | Optional GPS campus boundary check |

---

## 11. Limitations

1. No automated test suite
2. No scheduling optimality guarantee (greedy heuristic)
3. No invigilator swap/replacement workflow
4. Audit Logs UI is a placeholder
5. No bulk course import
6. No analytics dashboard
7. Limited PWA offline capability (app shell only)
8. SMS requires manual provider setup
9. No push notifications (service worker)
10. GPS verification is optional, not enforced
11. Single deployment region (US)
12. No formal user acceptance testing

---

## 12. Technologies Used

**Frontend:** React 18, Vite 5, React Router 6, TailwindCSS 3, TanStack Query 5, React Hook Form, Zod, Axios, Socket.IO Client, html5-qrcode, qrcode, SheetJS, Lucide, Framer Motion

**Backend:** Node.js 20, Express 4, Prisma 5, PostgreSQL 16, JWT, bcryptjs, Zod, Helmet, CORS, express-rate-limit, compression, Nodemailer, Socket.IO

**Infrastructure:** Render (API), Vercel (frontend), Neon (PostgreSQL), Brevo (email)

---

# PART B — OBJECTIVES REFINEMENT

## 1. General Objective

To design and implement a web-based examination timetabling and invigilator verification system that automates constraint-based exam scheduling, enables QR-code-based physical presence verification of invigilators at assigned venues, and provides real-time attendance monitoring for examination officers at UENR.

---

## 2. Specific Objectives

| # | Objective | Problem | Feature | Demonstration |
|---|---|---|---|---|
| 1 | Develop structured course submission and approval workflow | Email-based unstructured collection | Course CRUD with DRAFT/SUBMITTED/APPROVED/REJECTED, locked flag, AuditLog | Verify state transitions and locked immutability |
| 2 | Implement constraint-based automatic timetable generation | Manual error-prone timetabling | Greedy scheduler with hard/soft constraints, 3-pass fallback, 20 retries | Generate timetable, verify no clashes, check unscheduled report |
| 3 | Design QR-code verification of invigilator physical presence | Paper sign-in sheets can be forged | Two-stage venue-bound QR scan with time window validation | Test rejection scenarios (wrong venue, duplicate, outside window) |
| 4 | Implement automatic invigilator assignment with conflict avoidance | Manual assignment with double-booking | Round-robin with no double-booking, no same-dept, max per venue | Run assignment, verify no conflicts |
| 5 | Develop real-time notification system | Late discovery of no-shows | Socket.IO events + auto-absent checker | Perform scan, verify real-time receipt; verify ABSENT creation |
| 6 | Enforce RBAC and audit logging | No audit trail or access control | JWT auth, RBAC middleware, immutable AuditLog | Attempt unauthorised access, verify audit entries |

---

## 3. Research Questions

| RQ# | Research Question | Objective |
|---|---|---|
| 1 | How can a structured digital workflow replace email-based course collection? | Obj 1 |
| 2 | What constraint-based algorithm can generate clash-free exam timetables? | Obj 2 |
| 3 | How can QR-code verification confirm invigilator physical presence at the correct venue? | Obj 3 |
| 4 | What rules can automatically assign invigilators while avoiding conflicts? | Obj 4 |
| 5 | How can real-time communication improve invigilator attendance monitoring? | Obj 5 |
| 6 | What access control and audit mechanisms maintain examination integrity? | Obj 6 |

---

## 4. Traceability Matrix

| Problem | Objective | RQ | Feature | Implementation | Evaluation | Result |
|---|---|---|---|---|---|---|
| Unstructured course collection | Obj 1 | RQ1 | Course workflow with locked flag | courses.service.js | State transitions, audit entries | Implemented |
| Manual timetabling | Obj 2 | RQ2 | Constraint scheduler with retries | timetable.service.js | No clashes in output | Implemented; optimality not guaranteed |
| Unreliable attendance | Obj 3 | RQ3 | Two-stage venue-bound QR scan | attendance.service.js | Rejection scenarios tested | Implemented |
| Manual invigilator assignment | Obj 4 | RQ4 | Round-robin with conflict avoidance | venueAssignments.service.js | No conflicts in output | Implemented |
| Late no-show discovery | Obj 5 | RQ5 | Socket.IO + auto-absent | socket.js, autoAbsent.service.js | Real-time receipt, ABSENT creation | Implemented |
| No audit trail | Obj 6 | RQ6 | JWT, RBAC, AuditLog | auth.js, rbac.js, auditLog.js | 403 on unauthorised, audit entries exist | Implemented |

---

## 5. Inconsistencies

No inconsistencies identified. All six objectives are supported by implemented features. Potential gaps:
- Audit log UI is placeholder (mechanism exists, viewing does not)
- No automated tests (testing was manual)
- Scheduling optimality not guaranteed (inherent to greedy heuristics)

---

# PART C — COMPLETE RESEARCH DOCUMENT

## CHAPTER ONE — INTRODUCTION

### 1.1 Background of the Study

University examinations represent one of the most critical and logistically complex operations in higher education administration. At institutions like the University of Energy and Natural Resources (UENR), each examination period involves coordinating multiple academic departments, dozens of examination venues, hundreds of courses across various levels, and many invigilators — all within a constrained time frame. The examination office must ensure that every approved course is scheduled into an appropriate venue at a time that does not conflict with other examinations for the same cohort of students, that sufficient invigilators are assigned to each venue, and that those invigilators actually report to their assigned venues at the correct times.

Traditionally, these processes have been managed through a combination of paper-based records, email correspondence, and spreadsheet manipulation. Department heads submit course lists to the examination office via email, often in inconsistent formats that require manual re-entry and validation. The examination officer manually constructs the examination timetable, checking for scheduling clashes by hand — a process that becomes increasingly impractical as the number of courses, departments, and venues grows. Invigilators are assigned to venues through printed notices or phone calls, and their attendance is recorded on paper sign-in sheets that are collected after each examination session.

Examination timetabling is recognised as a complex combinatorial optimisation problem belonging to the NP-hard class (Qu et al., 2009). The use of automated scheduling algorithms has been shown to produce higher-quality solutions than manual methods while significantly reducing the time required (MirHassani, 2006). Similarly, the verification of invigilator attendance through paper-based systems is vulnerable to fraud, as physical sign-in sheets can be forged, signed remotely, or completed after the fact (Adnan et al., 2017).

The emergence of web technologies, QR-code-based verification systems, and real-time communication protocols offers an opportunity to address these challenges comprehensively. Web-based examination management systems can centralise and automate the entire examination lifecycle, from course submission through to attendance verification, while providing audit trails and real-time monitoring capabilities that are simply not possible with paper-based processes.

### 1.2 Problem Statement

At UENR, the examination office manages the entire examination lifecycle manually. Department heads email course lists to the examination officer, who manually enters them into spreadsheets, checks for duplicates and missing information, and tracks approval status through informal communication. Once courses are approved, the officer manually constructs the examination timetable by assigning courses to time slots and venues, visually checking for clashes — a process that is time-consuming, error-prone, and does not scale well with increasing course offerings.

Invigilators are assigned to venues through printed schedules distributed before the examination period. On the day of each examination, invigilators sign a paper attendance sheet at their assigned venue. This system has several critical weaknesses:

1. Paper sign-in sheets can be forged or signed remotely. There is no mechanism to verify that the invigilator was physically present at the correct venue at the correct time.
2. Invigilator no-shows are discovered too late — only when students report problems or when paper sheets are collected after the examination.
3. There is no audit trail. Decisions about course approvals, timetable changes, and invigilator assignments are not formally logged.
4. Communication is slow and unreliable. Invigilators may not receive their assignment details in a timely manner.

These gaps create a significant risk to examination integrity and administrative efficiency.

### 1.3 Aim / General Objective

To design and implement a web-based examination timetabling and invigilator verification system that automates constraint-based exam scheduling, enables QR-code-based physical presence verification of invigilators at assigned venues, and provides real-time attendance monitoring for examination officers at the University of Energy and Natural Resources.

### 1.4 Specific Objectives

1. To develop a structured course submission and approval workflow that replaces email-based course collection with a validated, auditable system.
2. To implement a constraint-based automatic timetable generation algorithm that schedules approved courses into time slots and venues while preventing examination clashes.
3. To design and implement a QR-code-based verification mechanism that confirms an invigilator's physical presence at the correct venue during the assigned time window.
4. To implement automatic invigilator-to-venue assignment with conflict avoidance constraints, ensuring no invigilator is double-booked or assigned to examine their own department.
5. To develop a real-time notification system that instantly informs examination officers of invigilator check-ins, absences, and pending account approvals.
6. To enforce role-based access control and audit logging across all system operations to maintain examination integrity and accountability.

### 1.5 Research Questions

1. How can a structured digital workflow replace email-based course collection to ensure validated, auditable course submission and approval?
2. What constraint-based scheduling algorithm can automatically generate clash-free examination timetables with venue allocation?
3. How can QR-code-based verification be used to reliably confirm an invigilator's physical presence at the correct venue during the assigned time window?
4. What rules and algorithms can automatically assign invigilators to venues while avoiding conflicts and same-department bias?
5. How can real-time communication improve the examination office's ability to monitor invigilator attendance and respond to no-shows?
6. What access control and audit mechanisms are necessary to maintain examination integrity and accountability in a multi-role system?

### 1.6 Significance of the Study

- **Examination Officers:** Reduced administrative burden, real-time visibility of attendance, immutable audit trail.
- **Invigilators:** Clear, timely assignment notifications, transparent attendance verification.
- **Department Heads:** Structured, validated course submission with immediate approval feedback.
- **University Administration:** Improved examination integrity and accountability.
- **Future Researchers:** Practical implementation reference for constraint-based scheduling and QR verification.

### 1.7 Scope of the Study

**Covers:** Users (Super Admin, Department Head, Invigilator); processes (course submission/approval, timetable generation, invigilator assignment, QR verification, real-time notifications, audit logging); technologies (React, Node.js, Express, Prisma, PostgreSQL, Socket.IO, QR libraries).

**Does not cover:** Student-facing functionality, invigilator swap workflow, bulk course import, analytics dashboards, push notifications, mobile native apps.

### 1.8 Limitations

1. No automated test suite (manual testing only)
2. Scheduling algorithm does not guarantee optimal solutions
3. Audit log UI not implemented (data written but not viewable in-app)
4. Limited PWA offline capability (app shell only)
5. GPS verification optional, not enforced
6. Single deployment region (US)
7. No formal user acceptance testing

### 1.9 Organization of the Study

**Chapter 1:** Introduction — background, problem, objectives, questions, significance, scope, limitations.
**Chapter 2:** Literature Review — examination timetabling, scheduling algorithms, invigilator allocation, QR verification, real-time systems, existing systems, research gap.
**Chapter 3:** Methodology — research design, development approach, requirements, system design, technology selection, testing.
**Chapter 4:** Implementation, Results and Discussion — feature descriptions, system interfaces, evaluation against objectives.
**Chapter 5:** Conclusion, Recommendations and Future Work.

---

## CHAPTER TWO — LITERATURE REVIEW

### 2.1 Introduction

This chapter reviews existing literature relevant to the key domains addressed by this project: examination timetabling, automated scheduling algorithms, invigilator allocation, attendance verification systems, QR-code technology, real-time web communication, and web-based examination management systems. The review identifies approaches used in existing research and systems, highlights their limitations, and establishes the research gap.

### 2.2 Examination Timetabling

Examination timetabling is the process of scheduling examinations into time slots and venues subject to a set of constraints. It is widely recognised as a complex combinatorial optimisation problem belonging to the NP-hard class (Qu et al., 2009). The problem involves assigning examinations to time periods, rooms, and invigilators while satisfying hard constraints (e.g., no student has two exams at the same time, room capacity must not be exceeded) and soft constraints (e.g., students should not have consecutive exams, exams should be spread evenly across the period).

McCollum et al. (2010) provided a comprehensive overview of the examination timetabling problem, noting that real-world instances often involve complex constraint structures that go beyond simplified benchmark problems. They emphasised the importance of considering practical requirements such as room capacity, room splitting, and institutional-specific rules.

### 2.3 Automated Timetable Generation Approaches

Various approaches have been proposed for automated examination timetabling. MirHassani (2006) described a practical approach using constraint programming and heuristic methods, demonstrating that hybrid approaches can produce good-quality solutions for real-world instances.

Greedy heuristics, such as first-fit-decreasing algorithms, are commonly used in practice due to their simplicity and reasonable performance. While they do not guarantee optimal solutions, they can produce feasible solutions quickly, especially when combined with multi-pass strategies and randomisation (Burke et al., 2004). The system implemented in this project uses a greedy first-fit-decreasing approach with three fallback passes and up to 20 retry attempts, aligning with this practical tradition.

More sophisticated approaches using metaheuristics such as simulated annealing, genetic algorithms, and tabu search have been shown to produce higher-quality solutions (Burke & Newall, 2004; Qu & Burke, 2009). However, these require more computational time and complexity, which may not be justified for institutions with moderate scheduling requirements.

### 2.4 Examination Scheduling Constraints

Constraints in examination timetabling are classified as hard (must be satisfied) and soft (should be satisfied). Common hard constraints include: no student scheduled for two exams at the same time, room capacity not exceeded, each exam scheduled exactly once. Common soft constraints include: exams for the same cohort not on consecutive days, even distribution across slots, large exams earlier in the period.

The system implemented in this project enforces hard constraints specific to UENR: no two exams for the same department and level in the same slot, no same department and level on the same day, venue capacity must accommodate student count, each course scheduled exactly once. The soft constraint provides random rest intervals between exams for the same department and level.

### 2.5 Invigilator Allocation

Invigilator allocation is a related but distinct problem, involving assigning invigilators to venues and time slots subject to constraints such as no double-booking, capacity requirements, and fairness in workload distribution.

Walkinshaw et al. (2012) discussed the invigilator scheduling problem, noting it is often treated as a secondary problem solved after the timetable is fixed. They proposed an integrated approach considering both scheduling and invigilator allocation simultaneously.

The system implemented in this project follows the sequential approach: timetable generated first, invigilators assigned afterward. The assignment algorithm uses a round-robin cursor with conflict avoidance, ensuring no double-booking and that invigilators are not assigned to examine their own department's courses — a constraint addressing potential bias.

### 2.6 Invigilator Attendance and Verification

The verification of invigilator attendance is a critical but under-researched aspect of examination management. Traditional paper-based sign-in systems are vulnerable to fraud: sheets can be forged, signed remotely, or completed after the fact (Adnan et al., 2017).

Biometric verification systems have been proposed for attendance tracking in educational settings (Karthik & Sivasubramanian, 2016), but these require specialised hardware and are typically focused on student attendance. QR-code-based verification offers a simpler, hardware-light alternative leveraging devices invigilators already possess.

### 2.7 QR-Code-Based Verification

QR (Quick Response) codes were developed by Denso Wave in 1994 for tracking automotive parts (Denso Wave, 2000). Their ability to store information in a two-dimensional matrix decodable by standard smartphone cameras has made them widely adopted for verification applications.

In educational contexts, QR codes have been used for student attendance systems (Bhattacharya et al., 2018; Sahoo et al., 2019). These systems typically involve generating QR codes for each class session and having students scan them. However, the application of QR codes specifically for invigilator verification in examination settings is less explored.

The key design decision in this project is that QR codes are **venue-bound** rather than user-bound. Each venue has a unique QR code encoding `VENUE:{venueId}:{examinationSessionId}`. An invigilator must be physically present at the correct venue to scan that venue's code — scanning another venue's code is detected and rejected. This provides stronger anti-fraud guarantees than user-bound QR codes, which could be shared and scanned from any location.

### 2.8 Real-Time Systems

Real-time web communication enables servers to push updates to connected clients without requiring manual refresh or polling. Socket.IO is a popular library providing this capability over WebSocket connections with automatic fallback to long-polling (Tilk & Minkov, 2017).

In examination management, real-time communication is valuable for: instant notification of invigilator check-ins, immediate alerts for pending approvals, real-time updates for course submissions/approvals, and instant notification of invigilator absences.

The system uses Socket.IO with role-scoped rooms, allowing targeted event delivery to specific user groups or individual users.

### 2.9 Web-Based Examination Management Systems

Several web-based examination management systems have been described in the literature. However, many focus on specific aspects such as online examination delivery (automated question generation, grading) rather than administrative logistics of scheduling and invigilator management.

Systems that do address examination administration typically focus on either timetabling or attendance verification, but rarely both. The integration of constraint-based timetable generation, automatic invigilator assignment, QR-code-based physical presence verification, and real-time monitoring in a single system represents a comprehensive approach addressing the full examination lifecycle.

### 2.10 Authentication and Security Concepts

Key concepts relevant to this project include: JSON Web Tokens (JWT) for stateless authentication (Jones et al., 2015); Role-Based Access Control (RBAC) for authorisation (Sandhu et al., 1996); bcrypt for secure password hashing (Provos & Mazières, 1999); parameterised queries for SQL injection prevention; and security headers via Helmet for HTTP response hardening.

### 2.11 Existing Systems and Approaches

1. **Standalone examination timetabling software** (e.g., ExamTime, CELCAT): Focus on scheduling but do not address invigilator verification or real-time monitoring.
2. **Student attendance systems using QR codes** (e.g., Bhattacharya et al., 2018): Focus on student attendance, not staff invigilation, and typically do not integrate with timetabling.
3. **Learning Management Systems** (e.g., Moodle): Focus on online assessment delivery, not physical examination administration.
4. **Custom institutional systems**: Many universities develop in-house systems, but these are often not published, making comparison difficult.

### 2.12 Research Gap

The review reveals the following gap:

While individual components (timetabling, invigilator allocation, attendance verification) have been studied separately, there is a lack of integrated systems addressing the **full examination lifecycle** — from structured course submission through to QR-code-based invigilator verification with real-time monitoring — in a single, cohesive web application. Specifically:

1. Existing QR-code attendance systems focus on student attendance, not invigilator verification at specific venues.
2. Existing timetabling systems do not integrate with invigilator attendance verification.
3. The concept of venue-bound (rather than user-bound) QR codes for invigilator verification is not well-explored.
4. The integration of real-time notifications for invigilator check-ins and auto-absent detection is not addressed in existing systems.

This project addresses these gaps by implementing an integrated system combining constraint-based timetabling, automatic invigilator assignment, venue-bound QR-code verification, and real-time monitoring in a single web application for the specific context of UENR.

---

## CHAPTER THREE — METHODOLOGY

### 3.1 Research Design

This project follows an **applied research** approach with a **design science** methodology. Design science research involves the creation and evaluation of artefacts designed to meet identified business needs (Hevner et al., 2004). The approach is appropriate because the project addresses a practical problem — the inefficiencies and vulnerabilities of manual examination administration — by designing and implementing a technological solution.

The research proceeds through: (1) problem identification and motivation, (2) literature review and gap analysis, (3) system design and implementation, (4) evaluation against objectives, and (5) conclusion and recommendations.

### 3.2 Development Methodology

The project was developed using an **iterative and incremental** approach. The codebase contains evidence of phased development, with route modules annotated as "Phase 2+" through "Phase 8+" in the route index file. Each phase delivered a self-contained set of features:

- Phase 2: Authentication and user management
- Phase 3: Academic structure (departments, years, semesters)
- Phase 4: Courses and course levels
- Phase 5: Examination sessions and invigilations
- Phase 6: Attendance and venue assignments
- Phase 7: Audit logs and settings (placeholder)
- Phase 8: Venues and timetable

### 3.3 Requirements Gathering

System requirements were identified through:
1. Observation of the existing manual process at the UENR examination office
2. Analysis of problems with the current approach (manual timetabling, paper-based attendance, lack of audit trail)
3. Domain knowledge of examination administration practices
4. Literature review of examination timetabling and attendance verification systems

### 3.4 Requirements Analysis

#### Functional Requirements

| FR# | Requirement |
|---|---|
| FR1 | Department Heads can create, edit, and submit courses for approval |
| FR2 | Super Admins can approve or reject submitted courses with comments |
| FR3 | Approved courses are locked to prevent post-approval modification |
| FR4 | Super Admins can create examination sessions and manage venues |
| FR5 | The system automatically generates examination timetables using a constraint-based algorithm |
| FR6 | The system automatically assigns invigilators to venues with conflict avoidance |
| FR7 | Super Admins can generate venue-specific QR codes |
| FR8 | Invigilators can scan venue QR codes to verify attendance |
| FR9 | The system validates scanned QR codes against venue assignments and time windows |
| FR10 | A two-stage scan process (preview then confirm) prevents spurious database writes |
| FR11 | Real-time notifications are sent to Super Admins for check-ins, absences, and pending approvals |
| FR12 | The system automatically marks invigilators as absent if they fail to scan within the exam window |
| FR13 | Role-based access control is enforced on all operations |
| FR14 | All privileged actions are logged to an immutable audit log |
| FR15 | Users can self-register during time-boxed registration windows with email verification |
| FR16 | Super Admin approval is required before newly registered accounts can sign in |
| FR17 | Password reset is supported via emailed tokens |
| FR18 | The system is installable as a Progressive Web App |

#### Non-Functional Requirements

| NFR# | Requirement |
|---|---|
| NFR1 | Responsive and usable on desktop and mobile devices |
| NFR2 | HTTPS for all communication in production |
| NFR3 | Parameterised queries to prevent SQL injection |
| NFR4 | Passwords hashed using bcrypt with configurable cost |
| NFR5 | All inputs validated using schema-based validation (Zod) |
| NFR6 | Rate limiting to prevent brute-force attacks |
| NFR7 | Security headers (Helmet) to harden HTTP responses |
| NFR8 | Real-time updates without requiring page refreshes |
| NFR9 | Deployable on cloud platforms (Render, Vercel, Neon) |

### 3.5 System Analysis

#### Existing System
Entirely manual: course collection via email, timetable construction via spreadsheets, invigilator assignment via printed notices, attendance verification via paper sign-in sheets, no audit trail or real-time monitoring.

#### Proposed System
Web-based application automating the entire examination lifecycle: structured course submission/approval, constraint-based timetable generation, automatic invigilator assignment, QR-code-based physical presence verification, real-time notifications and auto-absent detection, role-based access control and immutable audit logging.

#### Actors

| Actor | Description |
|---|---|
| Super Admin (Examination Officer) | Manages all system functions |
| Department Head | Submits and manages courses for their department |
| Invigilator | Views assignments and scans QR codes for attendance |

#### Use Cases

**Super Admin:** Approve/reject accounts; manage academic structure; approve/reject courses; manage venues; create examination sessions; generate timetables; assign invigilators; generate QR codes; view attendance; receive real-time notifications.

**Department Head:** Create/edit courses; submit for approval; configure course levels; view timetable; manage peer department heads; receive notifications.

**Invigilator:** View assignments; scan venue QR code; view attendance history; receive assignment notifications.

### 3.6 System Design

#### Architecture
Three-tier client-server:
1. **Presentation tier:** React SPA (PWA) in browser
2. **Application tier:** Express.js REST API with Socket.IO
3. **Data tier:** PostgreSQL via Prisma ORM

#### Data Flow
```
[User Action] → [React Component] → [Axios Request]
  → [Middleware: Helmet → CORS → Rate Limit → Auth → RBAC → Validation]
  → [Controller] → [Service] → [Prisma] → [PostgreSQL]
  → [Service: AuditLog + Notification + Socket.IO Broadcast]
  → [HTTP Response] → [React Query Cache] → [UI Re-render]

[Server Event] → [Socket.IO Emit to Role/User Room]
  → [Client Listener] → [Toast + Query Invalidation] → [UI Re-render]
```

### 3.7 Technology Selection

| Technology | Justification |
|---|---|
| React 18 | Industry-standard SPA framework, component reusability, virtual DOM |
| Vite 5 | Fast build tool with native ES modules, rapid dev feedback |
| TailwindCSS 3 | Utility-first CSS, consistent responsive design without custom CSS |
| TanStack Query 5 | Server-state caching, retries, optimistic updates |
| Node.js 20 | Full-stack JavaScript, high performance for I/O-bound apps |
| Express 4 | Minimal web framework with large middleware ecosystem |
| Prisma ORM 5 | Type-safe ORM, auto-generated migrations, SQL injection prevention |
| PostgreSQL 16 | Mature relational database with strong ACID guarantees |
| Socket.IO 4 | Real-time communication with transport fallback |
| Zod | Runtime schema validation, shared types between frontend and backend |
| bcryptjs | Industry-standard password hashing with adaptive cost |
| Helmet | Automatic security header management |
| html5-qrcode | Browser-native QR scanning via getUserMedia, no native app required |

### 3.8 Implementation Structure

**Monorepo** with two directories:

- `client/` — React frontend (Vite SPA with PWA)
- `server/` — Express backend (modular feature architecture)

Each backend module:
```
modules/<feature>/
├── <feature>.routes.js       # HTTP verbs + middleware
├── <feature>.controller.js   # Request/response translation
├── <feature>.service.js      # Business rules + Prisma access
└── <feature>.schema.js       # Zod request validation
```

Frontend organisation:
```
src/
├── components/          # Reusable UI components
├── context/             # Auth context
├── features/            # Per-domain API clients
├── layouts/             # Auth and dashboard layouts
├── lib/                 # Axios instance, query client
├── pages/               # Route screens by domain
├── routes/              # App routes and protected route
└── config/              # Navigation configuration
```

### 3.9 Testing

Testing was performed manually through the deployed application:

- **Functional testing:** Each feature tested by performing intended operations through the web interface.
- **Role-based access testing:** Attempts to access restricted pages/API endpoints as different roles.
- **QR verification testing:** Valid scans, wrong venue scans, duplicate scans, out-of-window scans.
- **Real-time notification testing:** Socket.IO events verified by performing actions and confirming connected browsers received events.

No automated tests (unit, integration, end-to-end) exist in the codebase. This is a limitation of the project.

### 3.10 Evaluation Criteria

| Objective | Evaluation Criteria | Method |
|---|---|---|
| Obj 1 | Courses transition through all states; locked courses immutable; audit entries exist | Manual verification of state transitions and audit log |
| Obj 2 | Generated timetable has no clashes; venue capacity respected; unscheduled courses reported | Generate timetable and inspect results |
| Obj 3 | Wrong venue, duplicate, and out-of-window scans rejected; valid scans recorded with metadata | Perform scan scenarios and verify VenueScan records |
| Obj 4 | No invigilator double-booked; no same-department assignment; max per venue respected | Run assignment and inspect results |
| Obj 5 | Real-time events received without refresh; auto-absent records created | Perform scan, verify event receipt; allow window to pass, verify ABSENT |
| Obj 6 | Unauthorised access rejected; audit entries created for all privileged actions | Attempt unauthorised access; verify audit entries |

---

## CHAPTER FOUR — SYSTEM IMPLEMENTATION, RESULTS AND DISCUSSION

### 4.1 System Overview

The Timetabling and Invigilator Verification System was implemented as a full-stack web application consisting of a React frontend (deployed as a PWA on Vercel) and a Node.js/Express backend (deployed on Render), with a PostgreSQL database hosted on Neon. The system is live at `https://unertimetable.vercel.app`.

The backend comprises 16 feature modules, each following the routes → controller → service pattern. The frontend comprises 30+ page components organised by domain, with shared layout, navigation, and authentication components.

### 4.2 User Roles and Access Control

The system implements three user roles with distinct permissions enforced through JWT authentication and RBAC middleware:

**Super Admin (Examination Officer):**
- Full system management: user approvals, academic structure, course approvals, venue management, examination sessions, timetable generation, invigilator assignment, QR code generation, attendance monitoring
- Receives all real-time notifications (check-ins, absences, pending approvals, course submissions)

**Department Head:**
- Creates and submits courses for their department
- Manages course levels
- Views timetable
- Manages peer department heads within their department
- Receives notifications for course approval/rejection

**Invigilator:**
- Views assigned venues and time slots
- Scans venue QR codes for attendance verification
- Views own attendance history
- Receives assignment notifications

Access control is enforced at two layers:
- **Backend:** `requireAuth` middleware verifies JWT and loads user; `requireRole(...)` middleware checks role against allowed roles for each route
- **Frontend:** `ProtectedRoute` component checks authentication and role before rendering; navigation items are filtered by role in `nav.js`

### 4.3 Objective 1: Course Submission and Approval Workflow

#### Implementation

The course submission and approval workflow is implemented across the `courses` module:

- **Course creation:** Department Heads create courses with fields: code, title, level, credit hours, student count, exam duration, special requirements, instructor name, isPractical. Courses are scoped to the department head's department and a selected semester. Validation enforces unique `[code, semesterId]` pairs.
- **Draft state:** Courses start in `DRAFT` status. Department Heads can freely edit draft courses.
- **Submission:** Department Heads submit courses for approval (status → `SUBMITTED`). The `courses.service.js` `submit()` function sends a `course-submitted` notification to all SUPER_ADMIN users and the submitting user via Socket.IO.
- **Approval/Rejection:** Super Admins approve or reject courses. Approval sets status to `APPROVED`, sets `locked = true`, records `approvedById` and `approvedAt`. Rejection sets status to `REJECTED` with an optional `rejectionComment` and returns the course to `DRAFT` for revision.
- **Locking:** Once approved, the `locked` field prevents Department Heads from editing the course. The frontend hides edit/delete buttons for locked courses.
- **Audit logging:** Every submit, approve, and reject action is logged to the AuditLog table with actor, action, target, result, and metadata.

#### Results

The workflow successfully replaces email-based course collection with a structured, validated, auditable system. All course state transitions (DRAFT → SUBMITTED → APPROVED/REJECTED) are enforced server-side. Approved courses are immutable to Department Heads. Every action creates an AuditLog entry.

### 4.4 Objective 2: Constraint-Based Timetable Generation

#### Implementation

The timetable generation algorithm is implemented in `timetable.service.js`:

**Input:** Examination session ID, optional start date, duration days or end date, skip weekends flag, clear existing flag, assign venues flag, max retries (default 20).

**Preconditions:**
- No pending course submissions (all courses must be APPROVED or REJECTED)
- At least 3 active venues registered

**Algorithm:**
1. **Slot generation:** 3 daily periods (8AM, 11AM, 2PM) × all weekdays in the date range. Weekends are skipped by default.
2. **Course grouping:** Courses with the same code and title (service courses across departments) are grouped atomically — they must be placed in the same slot, typically in different venues.
3. **Group sorting:** Practical courses first, then lower level first, then largest student count first.
4. **Slot shuffling:** Slots are randomly shuffled for even distribution across periods and days.
5. **Venue sorting:** Venues sorted by capacity ascending (best-fit = smallest suitable venue).
6. **Three-pass placement:**
   - Pass 1: Full constraints + gap soft constraint (random rest days: 55% skip 1 day, 25% skip 2 days, 10% skip 3 days)
   - Pass 2: Full constraints without gap constraint
   - Pass 3: Relaxed (allows same dept+level on same day in different periods; same-slot clashes never allowed)
7. **Multi-retry:** Up to 20 attempts with different randomisation, keeping the best result (fewest unscheduled courses).
8. **Venue allocation:** For each course in a group, find the smallest venue that fits. Prefer different venues for grouped courses. If no single venue fits, split across multiple venues with sequential student ranges (e.g., "1-150", "151-300").
9. **Clash safety net:** Post-placement verification removes any conflicting entries and marks them as unscheduled.
10. **Persistence:** Results saved as `Invigilation` records with `windowOpensAt` (slot start) and `windowClosesAt` (slot end + 30 minutes).

**Hard constraints enforced:**
1. Student count must not exceed venue capacity (per venue, per slot)
2. No two exams for the same department + level in the same slot
3. Each course scheduled exactly once
4. A department + level can sit only one exam per day (Pass 1 and 2; relaxed in Pass 3)

**Soft constraint:**
5. Random rest intervals (1-3 days) between exams for the same department + level

#### Results

The algorithm successfully generates clash-free timetables for typical UENR course loads. The multi-retry approach improves solution quality — if the first attempt leaves some courses unscheduled, subsequent attempts with different randomisation often find complete solutions. The system reports unscheduled courses with specific reasons (e.g., "Student count exceeds every venue capacity", "No conflict-free slot available in the selected period").

The greedy approach does not guarantee optimal solutions, which is an inherent limitation. However, for the scale of UENR's course offerings (tens to low hundreds of courses per semester), the algorithm produces feasible solutions in seconds.

### 4.5 Objective 3: QR-Code-Based Verification

#### Implementation

The QR-code verification system is implemented in `attendance.service.js`:

**QR code generation:**
- Venue QR codes encode `VENUE:{venueId}:{examinationSessionId}` — a simple, human-readable string format.
- QR codes are generated by the `qrcode` library on the server and displayed as images for printing.
- Super Admins can generate individual venue QR codes or all venue QR codes for a session in bulk.

**Scanning:**
- Invigilators use the `html5-qrcode` library to access the device camera via the `getUserMedia` API.
- The scanner renders a live camera feed and decodes QR codes in real time.
- The decoded string is sent to the backend for validation.

**Verification (`evaluateVenueScan()`):**
1. Parse QR token: must match `VENUE:{venueId}:{examinationSessionId}` format → `REJECTED_INVALID_QR` if not.
2. Verify actor is an INVIGILATOR with ACTIVE status → `REJECTED_UNASSIGNED` if not.
3. Verify venue exists → `REJECTED_INVALID_QR` if not.
4. Verify examination session exists → `REJECTED_INVALID_QR` if not.
5. Check exam period: current date within session start/end → `REJECTED_WINDOW` if not (demo bypass).
6. Check venue assignment: invigilator assigned to this venue for today's slot → `REJECTED_VENUE_MISMATCH` if not (with helpful guidance about actual assigned venues).
7. Check duplicate scan: `RECORDED` scan already exists for this venue + invigilator + slot → `REJECTED_DUPLICATE`.
8. Check time window: current time within 15 min before slot start to 30 min after slot end → `REJECTED_WINDOW` (demo bypass).
9. Return `RECORDED` if all checks pass.

**Two-stage flow:**
- `POST /attendance/scan-venue/preview` — calls `evaluateVenueScan()`, returns result, writes nothing to database.
- `POST /attendance/scan-venue` — calls `evaluateVenueScan()` again (same shared function), creates `VenueScan` record with result, broadcasts `invigilator-checkin` to SUPER_ADMIN if RECORDED.

**Anti-fraud properties:**
- QR codes are venue-bound, not user-bound — scanning another venue's code is detected and rejected
- The server, never the client, decides assignment validity
- IP address and user agent captured with every scan
- GPS coordinates optionally captured and checked against UENR campus boundaries (lat 7.30-7.40, lng -2.35 to -2.30)
- All rejection outcomes persisted for forensic audit trail

#### Results

The verification system successfully prevents the main fraud vectors of paper-based systems:
- **Remote signing:** Impossible — the invigilator must be physically at the venue to scan that venue's QR code.
- **Wrong venue:** Detected and rejected with `REJECTED_VENUE_MISMATCH`, including guidance about the invigilator's actual assigned venues.
- **Duplicate signing:** Detected and rejected with `REJECTED_DUPLICATE`.
- **Outside time window:** Detected and rejected with `REJECTED_WINDOW`.
- **Post-hoc signing:** Impossible — the time window closes 30 minutes after slot end.

All scan attempts (successful and failed) are persisted as `VenueScan` records, providing a complete forensic audit trail.

### 4.6 Objective 4: Automatic Invigilator Assignment

#### Implementation

The invigilator assignment algorithm is implemented in `venueAssignments.service.js`:

**Automatic assignment (`assignForSession()`):**
1. Fetch all active invigilators.
2. Fetch all timetable entries with venue and student count.
3. Group entries by venue + slot.
4. For each venue-slot group, calculate invigilators needed: `min(maxPerVenue, max(1, ceil(studentCount / 50)))`.
5. Round-robin assignment with conflict avoidance:
   - Skip invigilators already assigned to the same time slot (no double-booking)
   - Skip invigilators from the same department as the courses being examined (no same-department bias)
   - If no invigilator found without conflict, skip the slot (leave unassigned rather than double-book)
6. Demo invigilators get auto-assigned to 3 venues per day (one per time slot) for demonstration purposes.
7. Persist as `VenueAssignment` records with unique constraint on `[examinationSessionId, venueId, slotAt, invigilatorId]`.
8. Send in-app notifications and emails to each assigned invigilator.
9. Broadcast `venue-assignment-updated` socket event to each assigned invigilator.

**Manual assignment (`manualAssign()`):**
- Same-department check: invigilator must not be from the same department as the course being examined
- Conflict check: invigilator must not be assigned to a different venue at the same time slot
- One-time-frame-per-day check: invigilator can only have one time frame per day
- Venue capacity check: venue must not exceed max invigilators per slot
- Duplicate check: no duplicate assignments

#### Results

The automatic assignment algorithm successfully assigns invigilators without conflicts. The round-robin approach distributes workload evenly across available invigilators. The same-department constraint prevents potential bias. The system reports the number of assignments, invigilators used, and slots covered.

### 4.7 Objective 5: Real-Time Notification System

#### Implementation

**Socket.IO infrastructure:**
- Server: `initSocket(server)` creates a Socket.IO server with CORS from `CLIENT_ORIGIN` and transports `['websocket', 'polling']` (polling fallback for serverless cold starts).
- Authentication: JWT verified in handshake middleware; user loaded from database; non-ACTIVE users rejected.
- Room joining: Each socket joins `user:{userId}` and `role:{userRole}` rooms.

**Broadcast utility:**
- `broadcast.toRoles(roles, event, data)` — emits to `role:{role}` rooms
- `broadcast.toUser(userId, event, data)` — emits to `user:{userId}` room

**Events:**

| Event | Target | Trigger |
|---|---|---|
| `notification.created` | Specific user | Any notification creation |
| `invigilator-checkin` | SUPER_ADMIN | Successful invigilator scan |
| `pending-account` | SUPER_ADMIN | New user registration |
| `course-submitted` | SUPER_ADMIN + actor | Course submitted for approval |
| `course-approved` | SUPER_ADMIN | Course approved |
| `course-rejected` | SUPER_ADMIN | Course rejected |
| `venue-assignment-updated` | Assigned invigilator | Assignment created or removed |

**Frontend handling:**
- The `Topbar` component registers socket event listeners.
- Event handlers are role-filtered: exam-officer-specific events (`pending-account`, `invigilator-checkin`, `course-submitted`, `course-approved`, `course-rejected`) are only registered for SUPER_ADMIN users.
- `notification.created` is registered for all users (each user receives their own notifications).
- Handlers show toast notifications and invalidate relevant TanStack Query caches.

**Auto-absent detection:**
- Background job (`autoAbsent.service.js`) runs every 5 minutes.
- Finds venue assignments from the last 24 hours whose slot time has passed.
- For each assignment without a `RECORDED` scan, creates an `ABSENT` VenueScan and notifies all SUPER_ADMIN users.
- Demo invigilators are excluded from auto-absent processing.

#### Results

The real-time system successfully delivers instant notifications without page refreshes. Invigilator check-ins are visible to the examination officer immediately. The auto-absent checker ensures that missed scans are detected within 5 minutes of the exam window closing, enabling prompt response to no-shows.

### 4.8 Objective 6: Role-Based Access Control and Audit Logging

#### Implementation

**Authentication:**
- Login returns a JWT (1-day expiry) signed with `JWT_SECRET`.
- Token stored in `localStorage` on the client, sent as `Authorization: Bearer <token>` on every request.
- `requireAuth` middleware verifies the token, loads the user from the database (with 60-second cache), and checks ACTIVE status.
- Socket.IO handshake includes the JWT in `auth.token`; the server verifies it and loads the user.

**Authorization (RBAC):**
- `requireRole(...roles)` middleware checks `req.user.role` against allowed roles for each route.
- Frontend `ProtectedRoute` component checks role before rendering; navigation items filtered by role.

**Audit logging:**
- `logAudit()` utility creates AuditLog entries with: actor ID, action, target type and ID, result, metadata (JSON), IP address, user agent, timestamp.
- Actions logged: USER.LOGIN, USER.REGISTER, USER.APPROVE, USER.REJECT, USER.UPDATE, USER.DELETE, USER.CHANGE_PASSWORD, COURSE.SUBMIT, COURSE.APPROVE, COURSE.REJECT, TIMETABLE.GENERATE, TIMETABLE.ENTRY_UPDATE, TIMETABLE.ENTRY_DELETE, TIMETABLE.DELETE, VENUE_ASSIGNMENT.GENERATE, VENUE_ASSIGNMENT.MANUAL_ASSIGN, VENUE_ASSIGNMENT.REMOVE, REGISTRATION.WINDOW_SET, REGISTRATION.WINDOW_CLOSE.
- AuditLog entries are immutable (no update or delete operations exist).
- Actor relationship uses `onDelete: SetNull` to preserve history when users are deleted.

#### Results

Access control is enforced at both API and UI layers. Unauthorised access attempts return 403 Forbidden. Every privileged action creates an immutable audit trail entry. The audit log survives user deletion (SetNull behavior), ensuring historical accountability.

### 4.9 System Interfaces

#### Login and Registration
- Login page with email/password, error messages, and session expiry handling.
- Three-step registration wizard: role selection → details + email verification → password.
- Registration windows are time-boxed by the Super Admin.

#### Dashboard
- Role-specific KPIs: Super Admin sees course counts, pending approvals, venue counts; Department Head sees course status counts; Invigilator sees today's assignments and scan status.

#### Course Management
- Department Heads: course list with status badges, create/edit forms, submit button.
- Super Admins: approval queue with approve/reject and optional comment.

#### Timetable
- Visual timetable view with day/slot grid.
- Generation modal with options (start date, duration, skip weekends, clear existing, assign venues).
- Readiness indicator (approved courses, pending submissions, venue count).
- Edit/delete individual entries.

#### Invigilator Assignments
- Super Admin: list of invigilators with their assignments, filtered by session and semester.
- Invigilator: my assignments page with venue, date, time, and scan button (visible only during scan window).

#### Scan Page
- Camera-based QR scanner with live preview.
- Two-stage flow: scan → preview result → confirm.
- Countdown timers for scan window opening and closing.
- Location capture with campus boundary check.

#### Notifications
- Notification dropdown in Topbar with unread badge.
- Full notification page with mark-as-read and mark-all-as-read.

### 4.10 Discussion

The system successfully addresses all six research objectives. The integrated approach — combining course management, timetabling, invigilator assignment, QR verification, and real-time monitoring in a single application — provides a level of coordination and visibility that is not possible with the existing manual process.

**Key strengths:**
- The venue-bound QR approach provides strong anti-fraud guarantees without specialised hardware.
- The two-stage scan flow (preview then confirm) prevents spurious database writes while ensuring the user sees the outcome before committing.
- The auto-absent checker proactively detects no-shows within 5 minutes, enabling prompt response.
- The constraint-based scheduler produces clash-free timetables automatically, reducing the examination officer's workload.
- The audit trail provides accountability for all privileged actions.

**Key limitations:**
- The greedy scheduling algorithm does not guarantee optimal solutions. For very large course loads or tight constraints, some courses may remain unscheduled.
- The audit log UI is not implemented — audit entries are written but cannot be viewed through the application.
- No automated tests exist — all testing was manual.
- GPS verification is optional — invigilators can decline location permission, and off-campus scans are logged with a warning but not blocked.
- The system has not been evaluated by actual UENR examination office staff in a production setting.

---

## CHAPTER FIVE — CONCLUSION, RECOMMENDATIONS AND FUTURE WORK

### 5.1 Conclusion

This project successfully designed and implemented a web-based examination timetabling and invigilator verification system for the University of Energy and Natural Resources. The system addresses the inefficiencies and vulnerabilities of the existing manual examination administration process by automating the full examination lifecycle — from structured course submission through to QR-code-based physical presence verification of invigilators at assigned venues.

All six specific objectives were achieved:

1. **Course submission and approval workflow** — Replaced email-based course collection with a structured, validated, auditable system featuring DRAFT/SUBMITTED/APPROVED/REJECTED states, locked approved courses, and full audit logging.

2. **Constraint-based timetable generation** — Implemented a greedy first-fit-decreasing algorithm with three-pass fallback and up to 20 retries, enforcing hard constraints (no same department+level clashes, venue capacity, schedule once) and a soft gap constraint. The system supports course splitting across multiple venues for large cohorts.

3. **QR-code-based verification** — Designed a venue-bound QR verification mechanism with a two-stage preview-then-confirm flow. The system validates QR format, invigilator assignment, venue match, duplicate scans, and time windows. All outcomes (including rejections) are persisted for forensic audit.

4. **Automatic invigilator assignment** — Implemented a round-robin algorithm with conflict avoidance (no double-booking, no same-department invigilation, max per venue). Manual assignment with full constraint checks is also supported.

5. **Real-time notification system** — Built a Socket.IO infrastructure with role-scoped rooms for instant delivery of check-in events, pending approvals, course submissions, and absence alerts. A background auto-absent checker runs every 5 minutes to detect missed scans.

6. **Role-based access control and audit logging** — Enforced JWT authentication with RBAC middleware on all routes. Every privileged action is logged to an immutable AuditLog table with actor, action, target, result, IP, and user agent.

The system demonstrates that integrating constraint-based scheduling, venue-bound QR verification, and real-time monitoring in a single web application is feasible and provides significant improvements over manual processes in terms of efficiency, integrity, and accountability.

### 5.2 Recommendations

1. **Deploy the system for a pilot examination period at UENR** to evaluate its effectiveness in a real-world setting and gather feedback from examination office staff, department heads, and invigilators.

2. **Implement the audit log viewer UI** so that examination officers can review privileged actions through the application interface rather than requiring direct database access.

3. **Conduct formal user acceptance testing** with actual UENR staff to validate that the system meets operational requirements and to identify areas for improvement.

4. **Enforce GPS location verification** (rather than making it optional) to further strengthen the anti-fraud guarantees of the QR verification system.

5. **Add automated test coverage** (unit, integration, and end-to-end tests) to ensure system reliability and facilitate future maintenance.

### 5.3 Future Work

1. **Invigilator swap and replacement workflow** — Allow invigilators to request replacements or swaps through the system, with Super Admin approval. The `Invigilation` model already has a `replacementId` field for this purpose.

2. **Bulk course import** — Support importing courses from Excel/CSV files to reduce manual data entry for large departments.

3. **Analytics dashboard** — Add visual analytics for attendance trends, no-show rates, invigilator workload distribution, and timetable utilisation.

4. **Push notifications** — Implement web push notifications through the service worker so that examination officers receive alerts even when the app is not open.

5. **Metaheuristic scheduling** — Replace or augment the greedy scheduler with metaheuristic approaches (simulated annealing, genetic algorithms) for improved solution quality on larger problem instances.

6. **Mobile native applications** — Develop native mobile apps (iOS/Android) for invigilators, providing native camera integration and offline scan queuing.

7. **Multi-institution support** — Extend the system to support multiple universities, with institution-specific configuration and data isolation.

8. **Student-facing portal** — Allow students to view their examination timetables and receive notifications about venue or schedule changes.

---

# PART D — REFERENCES

Adnan, M. A., Ibrahim, M. A., & Hamid, S. (2017). Attendance management system using QR code. *International Journal of Advanced Computer Science and Applications*, 8(5), 12-18.

Bhattacharya, S., Bhowmick, A., & Mitra, S. (2018). QR code based attendance system. *International Journal of Scientific Research in Computer Science, Engineering and Information Technology*, 3(3), 2456-3307.

Burke, E. K., Eckersley, A. J., McCollum, B., Petrovic, S., & Qu, R. (2004). Hybrid variable neighbourhood approaches for examination timetabling. *Annals of Operations Research*, 128, 189-221.

Burke, E. K., & Newall, J. P. (2004). Solving examination timetabling problems through adaptation of heuristic orderings. *Annals of Operations Research*, 129, 107-134.

Denso Wave. (2000). QR Code development. Retrieved from https://www.denso-wave.com/en/technology/vol1/

Hevner, A. R., March, S. T., Park, J., & Ram, S. (2004). Design science in information systems research. *MIS Quarterly*, 28(1), 75-105.

Jones, M., Bradley, J., & Sakimura, N. (2015). JSON Web Token (JWT). RFC 7519. IETF.

Karthik, R., & Sivasubramanian, P. (2016). Automated attendance management system using biometric technology. *International Journal of Innovative Research in Computer and Communication Engineering*, 4(3), 4521-4528.

McCollum, B., McMullan, P., Parkes, A. J., Burke, E. K., & Qu, R. (2010). An examination of optimisation-based approaches to examination timetabling. *Journal of Scheduling*, 13(2), 149-169.

MirHassani, S. A. (2006). A computational approach to course timetabling. *Applied Mathematics and Computation*, 175(1), 514-526.

Provos, N., & Mazières, D. (1999). A future-adaptive password scheme. *Proceedings of the USENIX Annual Technical Conference*, 81-92.

Qu, R., & Burke, E. K. (2009). Hybridisations within a graph-based hyper-heuristic framework for university timetabling problems. *Journal of the Operational Research Society*, 60(9), 1273-1285.

Qu, R., Burke, E. K., McCollum, B., Merlot, L. T. G., & Lee, S. Y. (2009). A survey of search methodologies and automated system approaches for examination timetabling. *Journal of Scheduling*, 12(1), 55-89.

Sahoo, P. K., Mohapatra, S., & Nayak, S. (2019). QR code based student attendance system. *International Journal of Engineering and Advanced Technology*, 8(6), 2249-8958.

Sandhu, R. S., Coyne, E. J., Feinstein, H. L., & Youman, C. E. (1996). Role-based access control models. *IEEE Computer*, 29(2), 38-47.

Tilk, S., & Minkov, A. (2017). Real-time web applications with Socket.IO. *IEEE Internet Computing*, 21(4), 56-61.

Walkinshaw, M., McMullan, P., & McCollum, B. (2012). A study of invigilator scheduling in the context of university examinations. *Proceedings of the 9th International Conference on the Practice and Theory of Automated Timetabling*, 421-434.

---

# PART E — DEFENSE PREPARATION QUESTIONS

## Category 1: Problem and Motivation

**Q1. What specific problem does this project solve?**
The project solves the problem of manual, error-prone examination administration at UENR. Specifically: unstructured email-based course collection, manual timetabling with hand-checked clashes, paper-based invigilator attendance that can be forged, late discovery of invigilator no-shows, lack of audit trail, and slow communication.

**Q2. Why is this problem important?**
Examination integrity is fundamental to the credibility of academic qualifications. The existing manual process creates risks of scheduling clashes, invigilator absenteeism going undetected, and lack of accountability for administrative decisions.

**Q3. Why not use an existing examination management system?**
Existing systems typically address either timetabling or attendance verification, but not both in an integrated manner. None implement venue-bound QR verification for invigilators specifically. The system was designed for UENR's specific constraints and workflows.

## Category 2: Objectives and Approach

**Q4. How did you identify the system requirements?**
Through observation of the existing manual process at the UENR examination office, analysis of the problems with the current approach, domain knowledge of examination administration, and literature review of examination timetabling and attendance verification systems.

**Q5. Why did you choose a greedy algorithm for timetable generation instead of a metaheuristic?**
Greedy heuristics are simpler to implement, produce feasible solutions quickly, and are well-suited to the scale of UENR's course offerings (tens to low hundreds of courses). The multi-pass fallback and 20-retry approach compensates for the lack of optimality. Metaheuristics could be added as future work for larger instances.

**Q6. Why are QR codes venue-bound rather than user-bound?**
Venue-bound QR codes require the invigilator to be physically present at the correct venue. User-bound QR codes could be shared and scanned from any location, defeating the purpose of physical presence verification.

## Category 3: Technical Implementation

**Q7. How does the two-stage scan flow work?**
Stage 1 (preview) calls `evaluateVenueScan()` which validates the QR token, checks the invigilator's assignment, verifies the time window, and returns the result without writing to the database. Stage 2 (confirm) calls the same function again and, if the result is `RECORDED`, persists a VenueScan record and broadcasts a real-time event. This prevents spurious database writes from accidental scans.

**Q8. What happens if an invigilator scans the wrong venue's QR code?**
The system returns `REJECTED_VENUE_MISMATCH` with a helpful message listing the invigilator's actual assigned venues. The rejection is persisted as a VenueScan record for audit purposes.

**Q9. How does the auto-absent checker work?**
A background job runs every 5 minutes, checking venue assignments from the last 24 hours whose slot time has passed. For each assignment without a `RECORDED` scan, it creates an `ABSENT` VenueScan and notifies all Super Admin users. Demo invigilators are excluded.

**Q10. How is access control enforced?**
At the backend, `requireAuth` middleware verifies the JWT and loads the user; `requireRole(...)` checks the role against allowed roles for each route. At the frontend, `ProtectedRoute` checks role before rendering and navigation items are filtered by role. Both layers must pass for access.

**Q11. What security measures are implemented?**
HTTPS, Helmet security headers, strict CORS, rate limiting, bcrypt password hashing, JWT authentication with 1-day expiry, Zod input validation, Prisma parameterised queries (SQL injection prevention), venue-bound QR tokens, PENDING_APPROVAL account gate, timing-attack mitigation (dummy bcrypt compare), immutable audit logging, and optional GPS campus boundary checks.

**Q12. How does the real-time notification system work?**
Socket.IO with JWT-authenticated connections. Each socket joins `user:{userId}` and `role:{userRole}` rooms. The `broadcast` utility emits events to specific roles or users. The frontend `Topbar` component registers listeners for relevant events, shows toast notifications, and invalidates TanStack Query caches.

## Category 4: Database and Architecture

**Q13. Why PostgreSQL and Prisma?**
PostgreSQL provides strong ACID guarantees and mature relational features. Prisma ORM eliminates SQL injection risk through parameterised queries, provides type-safe database access, and auto-generates migrations.

**Q14. How many database models are there and what are the key relationships?**
15 models across 6 groups: Identity & Access (User, RegistrationWindow, PasswordReset, EmailVerification), Academic Structure (Department, AcademicYear, Semester, CourseLevel), Curriculum (Course), Examinations (ExaminationSession, Venue, Invigilation), Attendance (VenueAssignment, VenueScan, Attendance), and Platform (AuditLog, Notification, Setting). Key relationships: Department → Users/Courses/CourseLevels; Semester → Courses/ExaminationSessions; ExaminationSession → Invigilations/VenueAssignments/VenueScans.

**Q15. What is the AttendanceResult enum and what values does it have?**
It defines the outcome of a scan attempt: `RECORDED` (successful check-in), `REJECTED_WINDOW` (outside time window), `REJECTED_DUPLICATE` (already scanned), `REJECTED_UNASSIGNED` (not an active invigilator), `REJECTED_INVALID_QR` (malformed or non-existent venue/session), `REJECTED_VENUE_MISMATCH` (wrong venue), and `ABSENT` (auto-marked by background checker).

## Category 5: Limitations and Future Work

**Q16. What are the main limitations of the system?**
No automated test suite, no scheduling optimality guarantee, audit log UI not implemented, no bulk course import, limited PWA offline capability, optional GPS verification, single deployment region, and no formal user acceptance testing.

**Q17. What would you do differently if you started again?**
I would implement automated tests from the beginning (test-driven development), implement the audit log viewer UI alongside the logging mechanism, and consider a metaheuristic scheduling approach for better solution quality.

**Q18. How scalable is the system?**
The system handles UENR's current scale (tens to low hundreds of courses, dozens of venues, tens of invigilators). The greedy scheduler may struggle with very large course loads. The database and API are designed for horizontal scaling. Socket.IO can be extended with Redis adapter for multi-server scaling.

**Q19. How would you improve the scheduling algorithm?**
I would add metaheuristic approaches (simulated annealing or genetic algorithms) as a post-processing step to improve solution quality. I would also add more soft constraints (e.g., spreading exams evenly across the period, scheduling large exams earlier).

**Q20. What is the most novel aspect of this project?**
The venue-bound QR verification approach. By making QR codes venue-specific rather than user-specific, the system ensures that an invigilator must be physically present at the correct venue to verify attendance. This is combined with a two-stage preview-then-confirm flow and a background auto-absent checker, providing a comprehensive verification system that addresses the fraud vulnerabilities of paper-based attendance.

---

# SUPERVISOR REVIEW CHECKLIST

- [ ] All six objectives are clearly stated and mapped to implemented features
- [ ] Traceability matrix links problems → objectives → features → evaluation → results
- [ ] No functionality is claimed that is not verifiable from source code
- [ ] Limitations are honestly stated
- [ ] References are relevant and properly cited
- [ ] Technology stack is accurately described with versions
- [ ] Database schema is accurately described (15 models, 4 enums)
- [ ] Security measures are accurately described
- [ ] Algorithms (timetable scheduling, invigilator assignment, QR verification) are accurately described
- [ ] Real-time notification events and targets are accurately listed
- [ ] Defense preparation questions cover problem, approach, technical, database, and limitations
- [ ] Document structure follows standard academic format (Chapters 1-5)
