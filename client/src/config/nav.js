import {
  LayoutDashboard, Users, MailPlus, Building2, GraduationCap,
  BookOpen, CheckSquare, CalendarRange, ScanLine, ClipboardList,
  Settings, CirclePlus, Layers, CalendarDays, Building, QrCode,
} from 'lucide-react';

/**
 * Role-driven navigation config.
 * `roles`: which roles see the item.
 * Groups render collapsible; single items render flat.
 */
export const navConfig = [
  {
    kind: 'item',
    label: 'Dashboard',
    to: '/dashboard',
    icon: LayoutDashboard,
    roles: ['SUPER_ADMIN', 'DEPARTMENT_HEAD', 'INVIGILATOR'],
  },
  {
    kind: 'group',
    label: 'User Management',
    icon: Users,
    roles: ['SUPER_ADMIN'],
    items: [
      { label: 'Registration Windows', to: '/registration-windows', icon: MailPlus, roles: ['SUPER_ADMIN'] },
      { label: 'Pending Approvals', to: '/approvals', roles: ['SUPER_ADMIN'] },
      { label: 'Department Heads', to: '/department-heads', roles: ['SUPER_ADMIN'] },
      { label: 'Invigilators', to: '/invigilators', roles: ['SUPER_ADMIN'] },
    ],
  },
  {
    kind: 'group',
    label: 'Academic Structure',
    icon: Building2,
    roles: ['SUPER_ADMIN'],
    items: [
      { label: 'Faculties', to: '/faculties', roles: ['SUPER_ADMIN'] },
      { label: 'Departments', to: '/departments', roles: ['SUPER_ADMIN'] },
      { label: 'Academic Years', to: '/academic-years', roles: ['SUPER_ADMIN'] },
      { label: 'Semesters', to: '/semesters', roles: ['SUPER_ADMIN'] },
    ],
  },
  {
    kind: 'item',
    label: 'My Department',
    to: '/my-department',
    icon: GraduationCap,
    roles: ['DEPARTMENT_HEAD'],
  },
  {
    kind: 'group',
    label: 'Department Team',
    icon: Users,
    roles: ['DEPARTMENT_HEAD'],
    items: [
      { label: 'Department Heads', to: '/my-department-heads', roles: ['DEPARTMENT_HEAD'] },
    ],
  },
  {
    kind: 'group',
    label: 'Courses',
    icon: BookOpen,
    roles: ['SUPER_ADMIN', 'DEPARTMENT_HEAD'],
    items: [
      { label: 'All Courses', to: '/courses', roles: ['SUPER_ADMIN', 'DEPARTMENT_HEAD'], icon: BookOpen },
      {
        label: 'Add Courses',
        to: '/courses/add',
        roles: ['DEPARTMENT_HEAD'],
        type: 'course-semester-level-links',
        icon: CirclePlus,
      },
      { label: 'Manage Levels', to: '/course-levels', roles: ['DEPARTMENT_HEAD'], icon: Layers },
      { label: 'Course Approvals', to: '/course-approvals', icon: CheckSquare, roles: ['SUPER_ADMIN'] },
    ],
  },
  {
    kind: 'item',
    label: 'Venues',
    to: '/venues',
    icon: Building,
    roles: ['SUPER_ADMIN'],
  },
  {
    kind: 'item',
    label: 'Timetable',
    to: '/timetable',
    icon: CalendarRange,
    roles: ['SUPER_ADMIN', 'DEPARTMENT_HEAD', 'INVIGILATOR'],
  },
  {
    kind: 'group',
    label: 'Examinations',
    icon: ClipboardList,
    roles: ['SUPER_ADMIN', 'INVIGILATOR'],
    items: [
      { label: 'Sessions', to: '/examinations', roles: ['SUPER_ADMIN'] },
      { label: 'Invigilator Assignments', to: '/invigilator-assignments', roles: ['SUPER_ADMIN'] },
      { label: 'My Assignments', to: '/my-assignments', roles: ['INVIGILATOR'] },
    ],
  },
  {
    kind: 'group',
    label: 'Attendance',
    icon: ScanLine,
    roles: ['SUPER_ADMIN', 'INVIGILATOR'],
    items: [
      { label: 'Scan QR', to: '/scan', roles: ['INVIGILATOR'] },
      { label: 'My History', to: '/attendance/history', roles: ['INVIGILATOR'] },
      { label: 'All Records', to: '/attendance', roles: ['SUPER_ADMIN'] },
      { label: 'Venue QR Codes', to: '/venue-qr-codes', icon: QrCode, roles: ['SUPER_ADMIN'] },
    ],
  },
  {
    kind: 'item',
    label: 'Audit Logs',
    to: '/audit-logs',
    icon: ClipboardList,
    roles: ['SUPER_ADMIN', 'DEPARTMENT_HEAD', 'INVIGILATOR'],
  },
  {
    kind: 'item',
    label: 'Settings',
    to: '/settings',
    icon: Settings,
    roles: ['SUPER_ADMIN', 'DEPARTMENT_HEAD', 'INVIGILATOR'],
  },
];

export const filterNavForRole = (role) => {
  if (!role) return [];
  return navConfig
    .filter((n) => n.roles.includes(role))
    .map((n) => {
      if (n.kind === 'group') {
        const items = n.items.filter((i) => i.roles.includes(role));
        return items.length ? { ...n, items } : null;
      }
      return n;
    })
    .filter(Boolean);
};
