import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import usersRoutes from '../modules/users/users.routes.js';
import { placeholderRouter } from '../modules/_placeholder.js';
import registrationRoutes from '../modules/registration/registration.routes.js';
import departmentsRoutes from '../modules/departments/departments.routes.js';
import academicYearsRoutes from '../modules/academicYears/academicYears.routes.js';
import semestersRoutes from '../modules/semesters/semesters.routes.js';
import coursesRoutes from '../modules/courses/courses.routes.js';
import courseLevelsRoutes from '../modules/courseLevels/courseLevels.routes.js';
import examinationSessionsRoutes from '../modules/examinationSessions/examinationSessions.routes.js';
import invigilationsRoutes from '../modules/invigilations/invigilations.routes.js';
import notificationsRoutes from '../modules/notifications/notifications.routes.js';
import dashboardRoutes from '../modules/dashboard/dashboard.routes.js';
import attendanceRoutes from '../modules/attendance/attendance.routes.js';
import venueAssignmentsRoutes from '../modules/venueAssignments/venueAssignments.routes.js';
import timetableRoutes from '../modules/timetable/timetable.routes.js';
import venuesRoutes from '../modules/venues/venues.routes.js';
import testSmsRoutes from './testSms.js';

const router = Router();

router.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));

router.use('/auth', authRoutes);

// Phase 2+
router.use('/registration', registrationRoutes);
router.use('/users', usersRoutes);

// Phase 3+
router.use('/departments', departmentsRoutes);
router.use('/academic-years', academicYearsRoutes);
router.use('/semesters', semestersRoutes);

// Phase 4+
router.use('/courses', coursesRoutes);
router.use('/course-levels', courseLevelsRoutes);

// Phase 5+
router.use('/examination-sessions', examinationSessionsRoutes);
router.use('/invigilations', invigilationsRoutes);

// Cross-cutting
router.use('/notifications', notificationsRoutes);
router.use('/dashboard', dashboardRoutes);

// Phase 6+
router.use('/attendance', attendanceRoutes);
router.use('/venue-assignments', venueAssignmentsRoutes);

// Phase 7+
router.use('/audit-logs', placeholderRouter('Audit Logs'));
router.use('/settings', placeholderRouter('Settings'));

// Phase 8+
router.use('/venues', venuesRoutes);
router.use('/timetable', timetableRoutes);

// Testing utilities (SUPER_ADMIN only)
router.use('/', testSmsRoutes);

export default router;
