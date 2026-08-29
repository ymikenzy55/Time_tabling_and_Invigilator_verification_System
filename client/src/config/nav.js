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
    shortLabel: 'Home',
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
      { label: 'Pending Approvals', to: '/approvals', icon: CheckSquare, roles: ['SUPER_ADMIN'] },
      { label: 'Department Heads', to: '/department-heads', icon: GraduationCap, roles: ['SUPER_ADMIN'] },
      { label: 'Invigilators', to: '/invigilators', icon: Users, roles: ['SUPER_ADMIN'] },
    ],
  },
  {
    kind: 'group',
    label: 'Academic Structure',
    icon: Building2,
    roles: ['SUPER_ADMIN'],
    items: [
      { label: 'Departments', to: '/departments', icon: Building, roles: ['SUPER_ADMIN'] },
      { label: 'Semesters', to: '/semesters', icon: CalendarRange, roles: ['SUPER_ADMIN'] },
    ],
  },
  {
    kind: 'group',
    label: 'Department Team',
    icon: Users,
    roles: ['DEPARTMENT_HEAD'],
    items: [
      { label: 'Department Heads', to: '/my-department-heads', icon: GraduationCap, roles: ['DEPARTMENT_HEAD'] },
    ],
  },
  {
    kind: 'group',
    label: 'Courses',
    icon: BookOpen,
    roles: ['SUPER_ADMIN', 'DEPARTMENT_HEAD'],
    items: [
      { label: 'All Courses', shortLabel: 'Courses', to: '/courses', roles: ['SUPER_ADMIN', 'DEPARTMENT_HEAD'], icon: BookOpen },
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
    kind: 'group',
    label: 'Examinations',
    icon: ClipboardList,
    roles: ['SUPER_ADMIN', 'INVIGILATOR'],
    items: [
      { label: 'Sessions', to: '/examinations', icon: CalendarRange, roles: ['SUPER_ADMIN'] },
      { label: 'Timetable', to: '/timetable', icon: CalendarRange, roles: ['SUPER_ADMIN', 'DEPARTMENT_HEAD'] },
      { label: 'Venues', to: '/venues', icon: Building, roles: ['SUPER_ADMIN'] },
      { label: 'Venue QR Codes', to: '/venue-qr-codes', icon: QrCode, roles: ['SUPER_ADMIN'] },
      { label: 'Invigilator Assignments', to: '/invigilator-assignments', icon: Users, roles: ['SUPER_ADMIN'] },
      { label: 'Invigilation Duties', shortLabel: 'Duties', to: '/my-assignments', icon: ClipboardList, roles: ['INVIGILATOR'] },
    ],
  },
  {
    kind: 'group',
    label: 'Attendance',
    icon: ScanLine,
    roles: ['SUPER_ADMIN', 'INVIGILATOR'],
    items: [
      { label: 'Scan QR', to: '/scan', icon: ScanLine, roles: ['INVIGILATOR'] },
      { label: 'My History', to: '/attendance/history', icon: CalendarDays, roles: ['INVIGILATOR'] },
      { label: 'All Records', shortLabel: 'Records', to: '/attendance', icon: ClipboardList, roles: ['SUPER_ADMIN'] },
    ],
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

/**
 * Flatten the nav tree into a single list of { label, to, icon } items.
 */
export const flattenNav = (role) => {
  const nav = filterNavForRole(role);
  const flat = [];
  for (const entry of nav) {
    if (entry.kind === 'item') {
      flat.push({ label: entry.label, shortLabel: entry.shortLabel, to: entry.to, icon: entry.icon });
    } else {
      for (const child of entry.items) {
        if (child.type === 'course-semester-level-links') continue; // skip dynamic nested
        flat.push({ label: child.label, shortLabel: child.shortLabel, to: child.to, icon: child.icon });
      }
    }
  }
  return flat;
};

/**
 * Primary routes shown in the mobile bottom nav per role.
 * Everything else goes in the "More" sheet.
 */
const BOTTOM_NAV_PRIMARY = {
  INVIGILATOR: ['/dashboard', '/my-assignments', '/scan', '/attendance/history', '/settings'],
  SUPER_ADMIN: ['/dashboard', '/examinations', '/courses', '/attendance'],
  DEPARTMENT_HEAD: ['/dashboard', '/my-department-heads', '/courses', '/timetable'],
};

/**
 * Returns { primary, overflow } arrays for the bottom nav.
 * `primary` has at most 4 items; `overflow` has the rest.
 * The scan route is pulled out separately so the caller can render it
 * as a prominent center button.
 */
export const bottomNavItems = (role) => {
  const flat = flattenNav(role);
  const primaryRoutes = BOTTOM_NAV_PRIMARY[role] || [];
  const primary = [];
  const overflow = [];
  let scanItem = null;

  for (const item of flat) {
    if (item.to === '/scan') {
      scanItem = item;
    } else if (primaryRoutes.includes(item.to)) {
      primary.push(item);
    } else {
      overflow.push(item);
    }
  }

  // Sort primary to match the configured order
  primary.sort((a, b) => primaryRoutes.indexOf(a.to) - primaryRoutes.indexOf(b.to));

  return { primary, overflow, scanItem };
};
