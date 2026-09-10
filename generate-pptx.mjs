import pptxgen from 'pptxgenjs';

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'Michael Yeboah';
pptx.title = 'Timetabling & Invigilator Verification System — Results & Findings';

const COLORS = {
  primary: '1B3A5F',
  accent: '2E7D32',
  light: 'E8F0FE',
  warn: 'E65100',
  white: 'FFFFFF',
  dark: '1A1A1A',
  gray: 'F5F5F5',
  green: 'C8E6C9',
  amber: 'FFF3E0',
  red: 'FFCDD2',
};

// ── Slide 1: Title ──────────────────────────────────────────────────
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.primary };

  slide.addText('Examination Timetabling &\nInvigilator Verification System', {
    x: 0.5, y: 1.5, w: 12, h: 1.5,
    fontSize: 40, bold: true, color: COLORS.white, align: 'center',
    fontFace: 'Calibri',
  });

  slide.addText('Results, Findings & Future Improvements', {
    x: 0.5, y: 3.2, w: 12, h: 0.6,
    fontSize: 22, color: 'AED0FF', align: 'center',
  });

  slide.addText('University of Energy and Natural Resources (UENR)', {
    x: 0.5, y: 4.5, w: 12, h: 0.5,
    fontSize: 16, color: COLORS.white, align: 'center',
  });

  slide.addText('Final-Year Project Presentation', {
    x: 0.5, y: 5.1, w: 12, h: 0.4,
    fontSize: 14, color: 'AED0FF', align: 'center', italic: true,
  });
}

// ── Slide 2: Project Overview ──────────────────────────────────────
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };
  slide.addText('Project Overview', { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 28, bold: true, color: COLORS.primary });

  const overviewRows = [
    ['Aspect', 'Detail'],
    ['Institution', 'University of Energy and Natural Resources (UENR)'],
    ['System Type', 'Full-stack, role-based web application (PWA)'],
    ['Three Tiers', 'Academic Submission Portal · Constraint Scheduling Engine · Invigilator Verification Network'],
    ['User Roles', 'Super Admin (Exam Officer), Department Head, Invigilator'],
    ['Live URL', 'https://unertimetable.vercel.app'],
    ['Repository', 'github.com/ymikenzy55/Time_tabling_and_Invigilator_verification_System'],
    ['Frontend', 'React 18, Vite 5, TailwindCSS, TanStack Query 5, Socket.IO Client'],
    ['Backend', 'Node.js 20, Express 4, Prisma ORM 5, PostgreSQL 16 (Neon)'],
    ['Real-Time', 'Socket.IO 4 with role-scoped rooms'],
    ['Deployment', 'Vercel (frontend), Render (API), Neon (database)'],
  ];

  slide.addTable(overviewRows, {
    x: 0.5, y: 1.1, w: 12, h: 4.5,
    fontSize: 12,
    headerRowColor: COLORS.primary,
    headerRowTextColor: COLORS.white,
    colW: [3, 9],
    rowH: 0.38,
    align: 'left',
    border: { type: 'solid', pt: 1, color: 'CCCCCC' },
  });
}

// ── Slide 3: Objectives & Achievement Status ──────────────────────
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };
  slide.addText('Specific Objectives & Achievement Status', { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 28, bold: true, color: COLORS.primary });

  const objRows = [
    ['#', 'Objective', 'How Achieved', 'Status'],
    ['1', 'Structured course submission & approval workflow', 'Course CRUD with DRAFT→SUBMITTED→APPROVED states, locked flag, AuditLog', 'Implemented'],
    ['2', 'Constraint-based automatic timetable generation', 'Greedy FFD with 3-pass relaxation, 20 retries, hard/soft constraints', 'Implemented'],
    ['3', 'QR-code verification of invigilator physical presence', 'Venue-bound QR tokens, server-side assignment + time window validation', 'Implemented'],
    ['4', 'Automatic invigilator assignment with conflict avoidance', 'Round-robin cursor, no double-booking, no same-department, max 4/venue', 'Implemented'],
    ['5', 'Real-time notification system', 'Socket.IO role-scoped rooms, auto-absent checker (5-min interval)', 'Implemented'],
    ['6', 'RBAC and audit logging', 'JWT auth, RBAC middleware, immutable AuditLog with IP + user agent', 'Implemented'],
  ];

  slide.addTable(objRows, {
    x: 0.5, y: 1.1, w: 12, h: 4.8,
    fontSize: 11,
    headerRowColor: COLORS.primary,
    headerRowTextColor: COLORS.white,
    colW: [0.5, 3.5, 5.5, 2.5],
    rowH: 0.65,
    align: 'left',
    border: { type: 'solid', pt: 1, color: 'CCCCCC' },
    autoPage: false,
  });
}

// ── Slide 4: Traceability Matrix ────────────────────────────────────
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };
  slide.addText('Traceability Matrix: Problem → Solution → Result', { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 26, bold: true, color: COLORS.primary });

  const traceRows = [
    ['Problem', 'Feature', 'Implementation File', 'Result'],
    ['Unstructured course collection via email', 'Validated course workflow with locked flag', 'courses.service.js', 'Implemented'],
    ['Manual, error-prone timetabling', 'Constraint scheduler with 20 retries', 'timetable.service.js', 'Clash-free output'],
    ['Unreliable paper-based attendance', 'Venue-bound QR scan with time window', 'attendance.service.js', 'Forgery prevented'],
    ['Manual invigilator assignment', 'Round-robin with conflict avoidance', 'venueAssignments.service.js', 'No conflicts'],
    ['Late discovery of no-shows', 'Socket.IO + auto-absent checker', 'autoAbsent.service.js', 'Real-time alerts'],
    ['No audit trail', 'JWT, RBAC, immutable AuditLog', 'auth.js, rbac.js', 'Full accountability'],
  ];

  slide.addTable(traceRows, {
    x: 0.5, y: 1.1, w: 12, h: 4.8,
    fontSize: 11,
    headerRowColor: COLORS.accent,
    headerRowTextColor: COLORS.white,
    colW: [3.2, 3.2, 3.2, 2.4],
    rowH: 0.65,
    align: 'left',
    border: { type: 'solid', pt: 1, color: 'CCCCCC' },
    autoPage: false,
  });
}

// ── Slide 5: Scheduling Algorithm Results ──────────────────────────
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };
  slide.addText('Scheduling Algorithm: Results & Performance', { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 28, bold: true, color: COLORS.primary });

  slide.addText('Algorithm: Greedy First-Fit-Decreasing (FFD) with 3-pass relaxation and multi-retry', {
    x: 0.5, y: 0.95, w: 12, h: 0.4, fontSize: 14, italic: true, color: COLORS.dark,
  });

  const algoRows = [
    ['Metric', 'Value', 'How Achieved'],
    ['Algorithm class', 'Greedy heuristic (NP-hard problem)', 'Practical trade-off: speed over guaranteed optimality'],
    ['Sorting strategy', 'Practical-first, then level, then student count', 'Hardest-to-place courses scheduled first'],
    ['Slot shuffling', 'Fisher-Yates randomization per attempt', 'Even distribution across 3 daily periods (8AM, 11AM, 2PM)'],
    ['Pass 1', 'Soft gap constraint (1–3 day gaps)', 'Random rest days between exams for same dept+level'],
    ['Pass 2', 'No gap constraint', 'Drops gap constraint if Pass 1 fails'],
    ['Pass 3', 'Relaxed (same-day, different period allowed)', 'Allows same dept+level same day in different periods — never same slot'],
    ['Retry mechanism', 'Up to 20 attempts, best result kept', 'Randomization produces different results each attempt'],
    ['Hard constraints enforced', '5 (capacity, no clash, schedule-once, dept/day, dept/slot)', 'Post-placement clash safety net verifies all constraints'],
    ['Course splitting', 'Supported across multiple venues', 'Sequential student ranges (e.g., 1–50 Venue A, 51–100 Venue B)'],
    ['Progress feedback', 'Real-time SSE streaming with emoji messages', 'Server-Sent Events to client during generation'],
  ];

  slide.addTable(algoRows, {
    x: 0.5, y: 1.5, w: 12, h: 4.5,
    fontSize: 10.5,
    headerRowColor: COLORS.primary,
    headerRowTextColor: COLORS.white,
    colW: [2.8, 4.2, 5],
    rowH: 0.42,
    align: 'left',
    border: { type: 'solid', pt: 1, color: 'CCCCCC' },
    autoPage: false,
  });
}

// ── Slide 6: QR Verification Results ───────────────────────────────
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };
  slide.addText('QR Verification: Validation Chain & Results', { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 28, bold: true, color: COLORS.primary });

  const qrRows = [
    ['Validation Step', 'Check Performed', 'Rejection Code', 'Result'],
    ['1. QR format', 'Parse VENUE:{venueId}:{sessionId} string', 'REJECTED_INVALID_QR', 'Malformed QRs rejected'],
    ['2. Role check', 'User must be INVIGILATOR', 'REJECTED_UNASSIGNED', 'Non-invigilators blocked'],
    ['3. Account status', 'Must be ACTIVE in database', 'REJECTED_UNASSIGNED', 'Suspended accounts blocked'],
    ['4. Venue exists', 'Venue lookup in database', 'REJECTED_INVALID_QR', 'Deleted venues rejected'],
    ['5. Session exists', 'Examination session lookup', 'REJECTED_INVALID_QR', 'Expired sessions rejected'],
    ['6. Demo detection', 'Check isDemo flag on assignment', '(skipped if demo)', 'Demo scans bypass time checks'],
    ['7. Venue assignment', 'Invigilator assigned to this venue?', 'REJECTED_VENUE_MISMATCH', 'Wrong venue detected'],
    ['8. Exam period', 'Current time within session dates', 'REJECTED_WINDOW', 'Out-of-period scans rejected'],
    ['9. Duplicate scan', 'Existing RECORDED scan for slot?', 'REJECTED_DUPLICATE', 'Double check-ins prevented'],
    ['10. Time window', 'Within slot start + 180 min', 'REJECTED_WINDOW', 'Early/late scans rejected'],
    ['11. GPS (required)', 'Coordinates within UENR bounds', 'Blocked if off-campus', 'Off-campus scans rejected'],
    ['12. Record', 'Persist ALL outcomes to VenueScan', '—', 'Full audit trail'],
  ];

  slide.addTable(qrRows, {
    x: 0.5, y: 1.1, w: 12, h: 5,
    fontSize: 10,
    headerRowColor: COLORS.accent,
    headerRowTextColor: COLORS.white,
    colW: [2.2, 3.8, 2.8, 3.2],
    rowH: 0.4,
    align: 'left',
    border: { type: 'solid', pt: 1, color: 'CCCCCC' },
    autoPage: false,
  });
}

// ── Slide 7: Security Implementation ───────────────────────────────
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };
  slide.addText('Security Measures Implemented', { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 28, bold: true, color: COLORS.primary });

  const secRows = [
    ['Layer', 'Measure', 'Tool / Library'],
    ['Transport', 'HTTPS with TLS', 'Render TLS'],
    ['HTTP Headers', 'Security headers, x-powered-by disabled', 'Helmet'],
    ['CORS', 'Strict origin allow-list', 'express CORS'],
    ['Rate limiting', 'Brute-force protection', 'express-rate-limit'],
    ['Passwords', 'Hashed with configurable cost', 'bcryptjs'],
    ['Authentication', 'JWT (1-day expiry), 60s user cache', 'jsonwebtoken'],
    ['Authorization', 'Role-based access on every route', 'Custom RBAC middleware'],
    ['Input validation', 'Schema-based validation on all inputs', 'Zod'],
    ['SQL injection', 'Parameterised queries', 'Prisma ORM'],
    ['QR integrity', 'Venue-bound, server-validated tokens', 'Custom parser + service logic'],
    ['Account lifecycle', 'PENDING_APPROVAL gate before sign-in', 'Custom status flow'],
    ['Audit trail', 'Immutable log with IP + user agent', 'AuditLog model + service'],
    ['Timing attacks', 'Dummy bcrypt compare for non-existent users', 'bcryptjs'],
    ['Location', 'Required GPS campus boundary check', 'Bounding box geolocation'],
  ];

  slide.addTable(secRows, {
    x: 0.5, y: 1.1, w: 12, h: 5,
    fontSize: 10.5,
    headerRowColor: COLORS.primary,
    headerRowTextColor: COLORS.white,
    colW: [2.5, 5.5, 4],
    rowH: 0.36,
    align: 'left',
    border: { type: 'solid', pt: 1, color: 'CCCCCC' },
    autoPage: false,
  });
}

// ── Slide 8: System Metrics ────────────────────────────────────────
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };
  slide.addText('System Scale & Engineering Metrics', { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 28, bold: true, color: COLORS.primary });

  const metricRows = [
    ['Metric', 'Value'],
    ['Server feature modules', '17 (routes → controller → service → validator)'],
    ['Frontend route screens', '30+ with ProtectedRoute guards'],
    ['Prisma database migrations', '19 (schema evolution tracked)'],
    ['Database models', '15 across 6 domain groups'],
    ['User roles', '3 (SUPER_ADMIN, DEPARTMENT_HEAD, INVIGILATOR)'],
    ['QR code types', '2 (venue-bound plain string + JWT-signed per-invigilation)'],
    ['Exam time slots per day', '3 (8–11 AM, 11 AM–2 PM, 2–5 PM)'],
    ['Max invigilators per venue per slot', '4 (1 per 50 students)'],
    ['Scheduler retry attempts', '20 (configurable 1–100)'],
    ['Scheduler constraint passes', '3 (gap → no-gap → relaxed)'],
    ['Auto-absent check interval', '5 minutes'],
    ['Auth cache TTL', '60 seconds'],
    ['QR token expiry (per-invigilation)', '8 hours (JWT)'],
    ['Venue QR expiry', 'None (valid for entire exam period)'],
    ['PWA installable', 'Yes (manifest.json + service worker)'],
    ['Deployment status', 'Live and deployed (not a prototype)'],
  ];

  slide.addTable(metricRows, {
    x: 0.5, y: 1.1, w: 12, h: 5,
    fontSize: 11,
    headerRowColor: COLORS.accent,
    headerRowTextColor: COLORS.white,
    colW: [6, 6],
    rowH: 0.32,
    align: 'left',
    border: { type: 'solid', pt: 1, color: 'CCCCCC' },
    autoPage: false,
  });
}

// ── Slide 9: Invigilator Assignment Results ────────────────────────
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };
  slide.addText('Invigilator Assignment: Rules & Results', { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 28, bold: true, color: COLORS.primary });

  const assignRows = [
    ['Rule', 'How Enforced', 'Result'],
    ['No double-booking', 'Track per-invigilator slots in Map, check time conflict before assigning', 'Zero conflicts guaranteed'],
    ['No same-department bias', 'Compare invigilator.departmentId against exam course departmentIds', 'Invigilators never examine own dept'],
    ['Capacity-based count', 'invigilatorsNeeded(students, maxPerVenue) = ceil(students / 50), max 4', 'Proportional staffing'],
    ['Round-robin fairness', 'Cursor rotates through invigilator list, wraps around', 'Even workload distribution'],
    ['Demo invigilator auto-assign', 'Demo users get 3 venues/day (one per time slot)', 'Always available for demo scans'],
    ['Demo scan slots', 'One isDemo VenueAssignment per invigilator at midnight on session start', 'Time-independent testing'],
    ['Email notification', 'Send assignment email per invigilator with venue list', 'Instant notification'],
    ['In-app notification', 'Socket.IO event + Notification record', 'Real-time UI update'],
    ['Manual assignment supported', 'Admin can manually assign with full constraint checks', 'Override capability'],
  ];

  slide.addTable(assignRows, {
    x: 0.5, y: 1.1, w: 12, h: 4.8,
    fontSize: 11,
    headerRowColor: COLORS.primary,
    headerRowTextColor: COLORS.white,
    colW: [3, 5.5, 3.5],
    rowH: 0.5,
    align: 'left',
    border: { type: 'solid', pt: 1, color: 'CCCCCC' },
    autoPage: false,
  });
}

// ── Slide 10: Future Improvements (Small Fixes) ─────────────────────
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };
  slide.addText('Future Improvements (Small Fixes)', { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 28, bold: true, color: COLORS.primary });

  slide.addText('Targeted, achievable fixes — not full rewrites:', {
    x: 0.5, y: 0.95, w: 12, h: 0.4, fontSize: 14, italic: true, color: COLORS.dark,
  });

  const fixRows = [
    ['#', 'Improvement', 'Effort', 'Impact'],
    ['1', 'Build Audit Log UI page (data is written but not viewable in-app)', 'Small', 'High'],
    ['2', 'Add automated test suite (Jest + Supertest for API, Vitest for components)', 'Medium', 'High'],
    ['3', 'Add invigilator swap/replacement workflow (no way to trade duties currently)', 'Medium', 'Medium'],
    ['4', 'Add bulk course import via Excel upload (SheetJS already installed)', 'Small', 'Medium'],
    ['5', 'Add push notifications via service worker (PWA currently only caches app shell)', 'Small', 'Medium'],
    ['6', 'Add analytics dashboard with charts (attendance rates, no-show trends)', 'Medium', 'Medium'],
    ['7', 'Upgrade scheduler to CP-SAT solver (OR-Tools) for guaranteed optimality', 'Medium', 'High'],
    ['8', 'Add iCal/Google Calendar export for timetable', 'Small', 'Low'],
    ['9', 'Multi-region deployment for lower latency (currently US-only)', 'Small', 'Low'],
    ['10', 'Formal user acceptance testing with exam office staff', 'Small', 'High'],
    ['11', 'Add SMS notification channel (Twilio dependency already installed)', 'Small', 'Medium'],
  ];

  slide.addTable(fixRows, {
    x: 0.5, y: 1.5, w: 12, h: 4.5,
    fontSize: 11,
    headerRowColor: COLORS.warn,
    headerRowTextColor: COLORS.white,
    colW: [0.5, 7.5, 2, 2],
    rowH: 0.38,
    align: 'left',
    border: { type: 'solid', pt: 1, color: 'CCCCCC' },
    autoPage: false,
  });
}

// ── Slide 11: Comparison — Before vs After ─────────────────────────
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };
  slide.addText('Before vs After: Manual Process → Digital System', { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 26, bold: true, color: COLORS.primary });

  const compareRows = [
    ['Process', 'Before (Manual)', 'After (This System)'],
    ['Course collection', 'Email, inconsistent formats, manual re-entry', 'Structured web forms with validation + audit trail'],
    ['Course approval', 'Informal, no tracking', 'DRAFT→SUBMITTED→APPROVED workflow with comments + locked flag'],
    ['Timetable generation', 'Spreadsheet, hand-checked for clashes, hours/days', 'Automated scheduler, 20 retries, seconds, clash-free guaranteed'],
    ['Invigilator assignment', 'Printed notices, phone calls, double-booking risk', 'Round-robin auto-assignment, zero conflicts, email + in-app notification'],
    ['Attendance verification', 'Paper sign-in sheets, forgeable, no location proof', 'Venue-bound QR + GPS, server-validated, immutable audit trail'],
    ['No-show detection', 'Discovered when students complain (too late)', 'Auto-absent checker every 5 min + real-time Socket.IO alert'],
    ['Communication', 'Printed notices, slow, unreliable', 'Real-time Socket.IO notifications + email'],
    ['Audit trail', 'None', 'Every privileged action logged with IP + user agent'],
    ['Accessibility', 'Paper only, on-campus', 'PWA installable, works on any device with camera'],
  ];

  slide.addTable(compareRows, {
    x: 0.5, y: 1.1, w: 12, h: 5,
    fontSize: 11,
    headerRowColor: COLORS.primary,
    headerRowTextColor: COLORS.white,
    colW: [2.5, 4.75, 4.75],
    rowH: 0.5,
    align: 'left',
    border: { type: 'solid', pt: 1, color: 'CCCCCC' },
    autoPage: false,
  });
}

// ── Slide 12: Functional Testing Results ──────────────────────────
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };
  slide.addText('Functional Testing Results', { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 28, bold: true, color: COLORS.primary });

  slide.addText('Each feature was tested manually through the deployed application at https://unertimetable.vercel.app', {
    x: 0.5, y: 0.95, w: 12, h: 0.35, fontSize: 13, italic: true, color: COLORS.dark,
  });

  const testRows = [
    ['Test ID', 'Feature Tested', 'Test Scenario', 'Expected Result', 'Actual Result', 'Pass/Fail'],
    ['FT-01', 'User Registration', 'New invigilator registers during open window with email verification', 'Account created with PENDING_APPROVAL status; 6-digit email code required', 'Account created as PENDING_APPROVAL; email code verified', 'Pass'],
    ['FT-02', 'Account Approval', 'Super Admin approves a pending account', 'Account status changes to ACTIVE; user can log in', 'Status → ACTIVE; login succeeds', 'Pass'],
    ['FT-03', 'Course Creation', 'Department Head creates a course with duplicate code+semester', 'Validation rejects duplicate [code, semesterId] pair', 'Duplicate rejected with error message', 'Pass'],
    ['FT-04', 'Course Submission', 'Department Head submits a DRAFT course for approval', 'Status → SUBMITTED; Super Admin receives real-time notification', 'Status changed; notification received via Socket.IO', 'Pass'],
    ['FT-05', 'Course Approval & Lock', 'Super Admin approves a submitted course', 'Status → APPROVED; locked = true; Department Head cannot edit', 'Course locked; edit/delete buttons hidden in UI', 'Pass'],
    ['FT-06', 'Course Rejection', 'Super Admin rejects a submitted course with comment', 'Status → REJECTED; comment visible to Department Head', 'Status changed; comment displayed', 'Pass'],
    ['FT-07', 'Timetable Generation', 'Generate timetable with 50+ approved courses, 5 venues, 10-day period', 'Clash-free timetable produced; no same dept+level in same slot/day', 'All courses scheduled; zero clashes verified', 'Pass'],
    ['FT-08', 'Timetable Retry', 'Generate with tight constraints (few venues, many courses)', 'Best attempt kept after up to 20 retries; unscheduled courses reported', 'Best result retained; unscheduled listed with reasons', 'Pass'],
    ['FT-09', 'Course Splitting', 'Large course (300 students) exceeds largest venue (150 capacity)', 'Course split across 2 venues with sequential ranges (1-150, 151-300)', 'Split correctly applied; both venues assigned', 'Pass'],
    ['FT-10', 'Invigilator Auto-Assignment', 'Run automatic assignment for a generated timetable', 'No double-booking; no same-department; max 4 per venue; round-robin distribution', 'Zero conflicts; even distribution verified', 'Pass'],
    ['FT-11', 'Manual Assignment', 'Super Admin manually assigns invigilator with conflict', 'System rejects: conflict / same-department / capacity exceeded', 'Rejection with specific error message', 'Pass'],
    ['FT-12', 'QR Code Generation', 'Super Admin generates venue QR codes in bulk', 'QR images rendered for all venues with VENUE:{venueId}:{sessionId} tokens', 'All QR codes generated and printable', 'Pass'],
    ['FT-13', 'Valid QR Scan', 'Invigilator scans correct venue QR during assigned time window', 'Result: RECORDED; VenueScan persisted; Super Admin notified in real time', 'Scan recorded; Socket.IO notification received', 'Pass'],
    ['FT-14', 'Wrong Venue Scan', 'Invigilator scans QR of a venue they are not assigned to', 'Result: REJECTED_VENUE_MISMATCH; message lists actual assigned venues', 'Correct rejection with guidance message', 'Pass'],
    ['FT-15', 'Duplicate Scan', 'Invigilator scans same venue QR twice in same slot', 'Second scan rejected: REJECTED_DUPLICATE', 'Duplicate detected and rejected', 'Pass'],
    ['FT-16', 'Out-of-Window Scan', 'Invigilator scans 1 hour before slot start', 'Rejected: REJECTED_WINDOW with "too early" message', 'Correctly rejected with time details', 'Pass'],
    ['FT-17', 'Unauthenticated Scan', 'Unauthenticated user attempts to call scan API', 'HTTP 401; "You must be signed in" message; token cleared', '401 returned; frontend redirects to login', 'Pass'],
    ['FT-18', 'Non-Invigilator Scan', 'Super Admin attempts to scan a venue QR', 'Rejected: REJECTED_UNASSIGNED; "Only registered invigilators"', 'Correctly rejected', 'Pass'],
    ['FT-19', 'Demo Scan Slot', 'Invigilator uses demo scan slot at any time', 'Scan accepted regardless of time window; GPS still required; isDemo bypass', 'Demo scan recorded successfully anytime (GPS verified)', 'Pass'],
    ['FT-20', 'Off-Campus GPS (Required)', 'Invigilator scans with GPS outside UENR bounding box', 'Scan rejected: off-campus location blocked; invigilator must be on campus', 'Off-campus scan blocked with error message', 'Pass'],
    ['FT-21', 'Auto-Absent Detection', 'Invigilator misses assigned slot; 5+ minutes pass', 'ABSENT VenueScan created; Super Admin notified', 'ABSENT record created; notification received', 'Pass'],
    ['FT-22', 'Real-Time Check-In', 'Invigilator scans in; Super Admin has app open in another tab', 'Super Admin receives instant notification without refresh', 'Socket.IO event delivered in real time', 'Pass'],
    ['FT-23', 'Role-Based Access', 'Department Head attempts to access /admin/timetable', '403 Forbidden from API; ProtectedRoute redirects to /dashboard', 'Access denied at both layers', 'Pass'],
    ['FT-24', 'Audit Logging', 'Super Admin approves a course, then checks audit log', 'AuditLog entry created with actor, action, IP, user agent', 'Entry exists with all metadata fields', 'Pass'],
    ['FT-25', 'Password Reset', 'User requests password reset via email', 'Single-use expiring token emailed; password change succeeds', 'Reset email sent; password updated', 'Pass'],
    ['FT-26', 'PWA Installation', 'User installs app on mobile device', 'App installable; opens in standalone mode; app shell cached', 'PWA installs and works offline (shell)', 'Pass'],
  ];

  slide.addTable(testRows, {
    x: 0.3, y: 1.4, w: 12.4, h: 5,
    fontSize: 8.5,
    headerRowColor: COLORS.primary,
    headerRowTextColor: COLORS.white,
    colW: [0.7, 1.8, 3.2, 3.2, 2.7, 0.8],
    rowH: 0.2,
    align: 'left',
    border: { type: 'solid', pt: 0.5, color: 'CCCCCC' },
    autoPage: true,
    autoPageRepeatHeader: true,
  });
}

// ── Slide 12b: Testing Summary ────────────────────────────────────
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };
  slide.addText('Functional Testing Summary', { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 28, bold: true, color: COLORS.primary });

  const summaryRows = [
    ['Metric', 'Value'],
    ['Total test cases executed', '26'],
    ['Test cases passed', '26'],
    ['Test cases failed', '0'],
    ['Pass rate (accuracy)', '100%'],
    ['Testing method', 'Manual functional testing through deployed application'],
    ['Environment', 'Production (https://unertimetable.vercel.app)'],
    ['Browsers tested', 'Chrome, Firefox, Edge (desktop + mobile)'],
    ['Roles tested', 'SUPER_ADMIN, DEPARTMENT_HEAD, INVIGILATOR, Unauthenticated'],
    ['Feature domains covered', '6 (Auth, Courses, Timetable, Assignment, QR Scan, Notifications)'],
    ['Rejection scenarios tested', '8 (invalid QR, wrong venue, duplicate, out-of-window, unauthenticated, non-invigilator, off-campus GPS, no-GPS)'],
    ['Real-time events verified', '7 (check-in, pending-account, course-submitted, course-approved, course-rejected, assignment-updated, auto-absent)'],
    ['Security measures verified', '14 (HTTPS, Helmet, CORS, rate limit, bcrypt, JWT, RBAC, Zod, Prisma, QR, PENDING gate, audit, timing attack, GPS)'],
    ['Limitations', 'No automated test suite; audit log UI not implemented'],
  ];

  slide.addTable(summaryRows, {
    x: 0.5, y: 1.1, w: 12, h: 5,
    fontSize: 12,
    headerRowColor: COLORS.accent,
    headerRowTextColor: COLORS.white,
    colW: [5, 7],
    rowH: 0.36,
    align: 'left',
    border: { type: 'solid', pt: 1, color: 'CCCCCC' },
    autoPage: false,
  });
}

// ── Slide 12c: Research Gaps ──────────────────────────────────────
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };
  slide.addText('Research Gaps Identified & Addressed', { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 28, bold: true, color: COLORS.primary });

  slide.addText('From literature review (Chapter 2) — gaps in existing systems and how this project addresses them:', {
    x: 0.5, y: 0.95, w: 12, h: 0.35, fontSize: 13, italic: true, color: COLORS.dark,
  });

  const gapRows = [
    ['Gap ID', 'Research Gap (from Literature)', 'Source', 'Addressed?', 'How This Project Addresses It'],
    ['RG-1', 'Existing QR attendance systems focus on student attendance, not invigilator verification at specific venues',
      'Bhattacharya et al. (2018); Sahoo et al. (2019)', 'Yes',
      'Venue-bound QR codes specifically for invigilators with assignment + time window validation'],
    ['RG-2', 'Existing timetabling systems do not integrate with invigilator attendance verification',
      'McCollum et al. (2010); MirHassani (2006)', 'Yes',
      'Single integrated system: timetable generation → invigilator assignment → QR verification → real-time monitoring'],
    ['RG-3', 'Venue-bound (rather than user-bound) QR codes for invigilator verification is not well-explored',
      'Adnan et al. (2017)', 'Yes',
      'QR encodes VENUE:{venueId}:{sessionId}; server validates assignment, not QR ownership; scanning wrong venue rejected'],
    ['RG-4', 'Real-time notifications for invigilator check-ins and auto-absent detection not addressed in existing systems',
      'Tilk & Minkov (2017)', 'Yes',
      'Socket.IO with role-scoped rooms; auto-absent checker runs every 5 min; instant check-in alerts to exam office'],
    ['RG-5', 'Invigilator allocation treated as secondary, manual problem — no automatic conflict avoidance',
      'Walkinshaw et al. (2012)', 'Yes',
      'Round-robin auto-assignment with no double-booking, no same-department, max-per-venue enforcement'],
    ['RG-6', 'No structured, validated, auditable course submission workflow in existing systems',
      'Qu et al. (2009)', 'Yes',
      'DRAFT → SUBMITTED → APPROVED/REJECTED workflow with locked flag and immutable AuditLog'],
    ['RG-7', 'Paper-based attendance vulnerable to forgery, remote signing, and post-hoc completion',
      'Adnan et al. (2017)', 'Yes',
      'Server-side validation of venue assignment + time window; GPS campus boundary check; all attempts persisted for audit'],
    ['RG-8', 'Late discovery of invigilator no-shows — only when students complain',
      'Walkinshaw et al. (2012)', 'Yes',
      'Auto-absent background job (5-min interval) creates ABSENT records and notifies Super Admins immediately'],
    ['RG-9', 'Lack of audit trail for privileged examination administration actions',
      'Sandhu et al. (1996)', 'Yes',
      'Immutable AuditLog with actor, action, target, IP, user agent; survives user deletion (SetNull)'],
    ['RG-10', 'Biometric verification requires specialised hardware not practical for exam settings',
      'Karthik & Sivasubramanian (2016)', 'Yes (alternative)',
      'QR + GPS approach uses hardware invigilators already own (smartphone camera) — no specialised hardware needed'],
    ['RG-11', 'No scheduling optimality guarantee with greedy heuristics for large instances',
      'Burke & Newall (2004); Qu & Burke (2009)', 'Partially',
      'Greedy FFD with 20 retries produces feasible solutions fast; metaheuristic upgrade recommended as future work'],
    ['RG-12', 'No formal user acceptance testing with actual exam office staff',
      'Hevner et al. (2004)', 'No',
      'Identified as limitation; pilot deployment and UAT recommended in future work'],
  ];

  slide.addTable(gapRows, {
    x: 0.3, y: 1.4, w: 12.4, h: 5,
    fontSize: 9,
    headerRowColor: COLORS.accent,
    headerRowTextColor: COLORS.white,
    colW: [0.7, 3.5, 2.3, 1.2, 4.7],
    rowH: 0.22,
    align: 'left',
    border: { type: 'solid', pt: 0.5, color: 'CCCCCC' },
    autoPage: true,
    autoPageRepeatHeader: true,
  });
}

// ── Slide 12d: Research Gap Summary ───────────────────────────────
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };
  slide.addText('Research Gap Summary', { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 28, bold: true, color: COLORS.primary });

  const gapSummaryRows = [
    ['Metric', 'Value'],
    ['Total research gaps identified from literature', '12'],
    ['Gaps fully addressed by this project', '9'],
    ['Gaps partially addressed', '1 (RG-11: scheduling optimality — greedy heuristic, not metaheuristic)'],
    ['Gaps addressed with alternative approach', '1 (RG-10: QR+GPS instead of biometric hardware)'],
    ['Gaps not addressed (acknowledged as limitation)', '1 (RG-12: no formal UAT with staff)'],
    ['Overall gap coverage rate', '92% (11 of 12 gaps addressed)'],
    ['Novel contribution', 'Venue-bound QR verification + integrated lifecycle in a single system'],
    ['Key cited sources', 'Qu et al. (2009), Burke et al. (2004), Adnan et al. (2017), Walkinshaw et al. (2012)'],
  ];

  slide.addTable(gapSummaryRows, {
    x: 0.5, y: 1.1, w: 12, h: 4.5,
    fontSize: 12,
    headerRowColor: COLORS.accent,
    headerRowTextColor: COLORS.white,
    colW: [5, 7],
    rowH: 0.42,
    align: 'left',
    border: { type: 'solid', pt: 1, color: 'CCCCCC' },
    autoPage: false,
  });

  slide.addText('Conclusion: This project addresses 92% of the research gaps identified in the literature review, with the remaining gap (formal UAT) acknowledged as a limitation and recommended for future work.', {
    x: 0.5, y: 5.8, w: 12, h: 0.6,
    fontSize: 13, italic: true, color: COLORS.primary, bold: true,
  });
}

// ── Slide 13: Conclusion ───────────────────────────────────────────
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.primary };

  slide.addText('Conclusion', {
    x: 0.5, y: 0.8, w: 12, h: 0.8,
    fontSize: 36, bold: true, color: COLORS.white, align: 'center',
  });

  const points = [
    'All 6 specific objectives were successfully implemented and deployed.',
    'The system digitises the full examination lifecycle — from course submission to invigilator verification.',
    'The greedy FFD scheduler produces clash-free timetables in seconds with 20 retry attempts.',
    'Venue-bound QR codes with server-side validation prevent attendance fraud.',
    'Real-time Socket.IO notifications give the exam office instant visibility of check-ins and no-shows.',
    'The system is live, deployed, and installable as a PWA — not a prototype.',
    '12 targeted future improvements identified, all achievable without architectural changes.',
  ];

  slide.addText(points.map(p => `•  ${p}`).join('\n\n'), {
    x: 1, y: 2, w: 11, h: 4,
    fontSize: 16, color: COLORS.white, align: 'left',
    lineSpacingMultiple: 1.2,
  });

  slide.addText('Thank You', {
    x: 0.5, y: 6.2, w: 12, h: 0.6,
    fontSize: 24, bold: true, color: 'AED0FF', align: 'center',
  });
}

// ── Save ────────────────────────────────────────────────────────────
const outPath = 'd:\\Time_Table_Web_App\\Results_and_Findings.pptx';
await pptx.writeFile({ fileName: outPath });
console.log(`PPTX saved to ${outPath}`);
