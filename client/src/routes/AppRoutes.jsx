import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthLayout } from '@/layouts/AuthLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { ProtectedRoute } from './ProtectedRoute';

import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { DepartmentHeadsPage } from '@/pages/users/DepartmentHeadsPage';
import { InvigilatorsPage } from '@/pages/users/InvigilatorsPage';
import { RegistrationWindowsPage } from '@/pages/users/RegistrationWindowsPage';
import { ApprovalsPage } from '@/pages/users/ApprovalsPage';
import { FacultiesPage } from '@/pages/academic/FacultiesPage';
import { DepartmentsPage } from '@/pages/academic/DepartmentsPage';
import { AcademicYearsPage } from '@/pages/academic/AcademicYearsPage';
import { SemestersPage } from '@/pages/academic/SemestersPage';
import { CoursesPage } from '@/pages/courses/CoursesPage';
import { CoursesByLevelPage } from '@/pages/courses/CoursesByLevelPage';
import { CourseLevelsPage } from '@/pages/courses/CourseLevelsPage';
import { CourseApprovalsPage } from '@/pages/courses/CourseApprovalsPage';
import { ExaminationsPage } from '@/pages/examinations/ExaminationsPage';
import { InvigilatorAssignmentsPage } from '@/pages/examinations/InvigilatorAssignmentsPage';
import { MyAssignmentsPage } from '@/pages/examinations/MyAssignmentsPage';
import { TimetablePage } from '@/pages/timetable/TimetablePage';
import { VenuesPage } from '@/pages/venues/VenuesPage';
import { AttendanceRecordsPage } from '@/pages/attendance/AttendanceRecordsPage';
import { AttendanceHistoryPage } from '@/pages/attendance/AttendanceHistoryPage';
import { QrCodePage } from '@/pages/attendance/QrCodePage';
import { VenueQrCodesPage } from '@/pages/attendance/VenueQrCodesPage';
import { ScanPage } from '@/pages/attendance/ScanPage';
import { MyDepartmentPage } from '@/pages/department/MyDepartmentPage';
import { MyDepartmentHeadsPage } from '@/pages/users/MyDepartmentHeadsPage';
import { NotificationsPage } from '@/pages/notifications/NotificationsPage';
import { SettingsPage } from '@/pages/SettingsPage';

const SUPER_ADMIN = ['SUPER_ADMIN'];
const ADMIN_OR_HEAD = ['SUPER_ADMIN', 'DEPARTMENT_HEAD'];
const ADMIN_OR_INVIGILATOR = ['SUPER_ADMIN', 'INVIGILATOR'];
const INVIGILATOR = ['INVIGILATOR'];

export const AppRoutes = () => (
  <Routes>
    {/* Public */}
    <Route element={<AuthLayout />}>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
    </Route>

    {/* Protected shell */}
    <Route
      element={
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/profile" element={<Navigate to="/settings" replace />} />

      {/* Super Admin — User management */}
      <Route path="/department-heads" element={<ProtectedRoute roles={SUPER_ADMIN}><DepartmentHeadsPage /></ProtectedRoute>} />
      <Route path="/invigilators" element={<ProtectedRoute roles={SUPER_ADMIN}><InvigilatorsPage /></ProtectedRoute>} />
      <Route path="/registration-windows" element={<ProtectedRoute roles={SUPER_ADMIN}><RegistrationWindowsPage /></ProtectedRoute>} />
      <Route path="/approvals" element={<ProtectedRoute roles={SUPER_ADMIN}><ApprovalsPage /></ProtectedRoute>} />

      {/* Super Admin — Academic */}
      <Route path="/faculties" element={<ProtectedRoute roles={SUPER_ADMIN}><FacultiesPage /></ProtectedRoute>} />
      <Route path="/departments" element={<ProtectedRoute roles={SUPER_ADMIN}><DepartmentsPage /></ProtectedRoute>} />
      <Route path="/academic-years" element={<ProtectedRoute roles={SUPER_ADMIN}><AcademicYearsPage /></ProtectedRoute>} />
      <Route path="/semesters" element={<ProtectedRoute roles={SUPER_ADMIN}><SemestersPage /></ProtectedRoute>} />

      {/* Department Head */}
      <Route path="/my-department" element={<ProtectedRoute roles={['DEPARTMENT_HEAD']}><MyDepartmentPage /></ProtectedRoute>} />
      <Route path="/my-department-heads" element={<ProtectedRoute roles={['DEPARTMENT_HEAD']}><MyDepartmentHeadsPage /></ProtectedRoute>} />

      {/* Courses */}
      <Route path="/courses" element={<ProtectedRoute roles={ADMIN_OR_HEAD}><CoursesPage /></ProtectedRoute>} />
      <Route path="/courses/add/:semester/:level" element={<ProtectedRoute roles={['DEPARTMENT_HEAD']}><CoursesByLevelPage /></ProtectedRoute>} />
      <Route path="/course-levels" element={<ProtectedRoute roles={['DEPARTMENT_HEAD']}><CourseLevelsPage /></ProtectedRoute>} />
      <Route path="/course-approvals" element={<ProtectedRoute roles={SUPER_ADMIN}><CourseApprovalsPage /></ProtectedRoute>} />

      {/* Venues + Timetable */}
      <Route path="/venues" element={<ProtectedRoute roles={SUPER_ADMIN}><VenuesPage /></ProtectedRoute>} />
      <Route path="/timetable" element={<ProtectedRoute roles={['SUPER_ADMIN', 'DEPARTMENT_HEAD']}><TimetablePage /></ProtectedRoute>} />

      {/* Examinations */}
      <Route path="/examinations" element={<ProtectedRoute roles={SUPER_ADMIN}><ExaminationsPage /></ProtectedRoute>} />
      <Route path="/invigilator-assignments" element={<ProtectedRoute roles={SUPER_ADMIN}><InvigilatorAssignmentsPage /></ProtectedRoute>} />
      <Route path="/my-assignments" element={<ProtectedRoute roles={INVIGILATOR}><MyAssignmentsPage /></ProtectedRoute>} />

      {/* Attendance */}
      <Route path="/attendance" element={<ProtectedRoute roles={SUPER_ADMIN}><AttendanceRecordsPage /></ProtectedRoute>} />
      <Route path="/attendance/qr/:invigilationId" element={<ProtectedRoute roles={ADMIN_OR_INVIGILATOR}><QrCodePage /></ProtectedRoute>} />
      <Route path="/venue-qr-codes" element={<ProtectedRoute roles={SUPER_ADMIN}><VenueQrCodesPage /></ProtectedRoute>} />
      <Route path="/attendance/history" element={<ProtectedRoute roles={INVIGILATOR}><AttendanceHistoryPage /></ProtectedRoute>} />
      <Route path="/scan" element={<ProtectedRoute roles={INVIGILATOR}><ScanPage /></ProtectedRoute>} />

      {/* Audit + Settings */}
      <Route path="/audit-logs" element={<ProtectedRoute roles={SUPER_ADMIN}><PlaceholderPage title="Audit Logs" phase="Phase 7" /></ProtectedRoute>} />
      <Route path="/settings" element={<SettingsPage />} />
    </Route>

    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);
