import { useState } from 'react';
import { UserCircle, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { StatusBadge } from '@/features/users/StatusBadge';
import { ChangePasswordForm } from '@/features/users/ChangePasswordForm';
import { AdminsManager } from '@/features/users/AdminsManager';

const ROLE_LABEL = {
  SUPER_ADMIN: 'Super Admin',
  DEPARTMENT_HEAD: 'Department Head',
  INVIGILATOR: 'Invigilator',
};

const Row = ({ label, value }) => (
  <div className="grid grid-cols-3 gap-4 py-3 border-b border-surface-divider last:border-0">
    <div className="text-sm text-ink-500">{label}</div>
    <div className="col-span-2 text-sm text-ink-900">
      {value || <span className="text-ink-400">—</span>}
    </div>
  </div>
);

const Overview = ({ user }) => (
  <div className="panel p-5 max-w-2xl">
    <div className="flex items-center gap-4 pb-5 border-b border-surface-border">
      <div className="w-14 h-14 rounded-full bg-primary-600 text-white grid place-items-center text-lg font-bold">
        {(user?.fullName || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
      </div>
      <div>
        <div className="text-lg font-bold text-ink-900">{user?.fullName}</div>
        <div className="text-sm text-ink-500">{ROLE_LABEL[user?.role] || user?.role}</div>
      </div>
    </div>
    <div className="pt-2">
      <Row label="Email" value={user?.email} />
      <Row label="Staff ID" value={user?.staffId} />
      <Row label="Phone" value={user?.phone} />
      <Row label="Role" value={ROLE_LABEL[user?.role] || user?.role} />
      <Row label="Status" value={<StatusBadge status={user?.status} />} />
    </div>
  </div>
);

export const ProfilePage = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [tab, setTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: UserCircle },
    { id: 'security', label: 'Security', icon: KeyRound },
    ...(isSuperAdmin ? [{ id: 'admins', label: 'Administrators', icon: ShieldCheck }] : []),
  ];

  return (
    <>
      <PageHeader title="My Profile" description="Manage your account and preferences." />

      <Tabs tabs={tabs} value={tab} onChange={setTab} className="mb-6" />

      {tab === 'overview' && <Overview user={user} />}
      {tab === 'security' && <ChangePasswordForm />}
      {tab === 'admins' && isSuperAdmin && <AdminsManager />}
    </>
  );
};
