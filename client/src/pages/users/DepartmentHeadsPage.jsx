import { PageHeader } from '@/components/ui/PageHeader';
import { UsersListSection } from '@/features/users/UsersListSection';

export const DepartmentHeadsPage = () => (
  <>
    <PageHeader
      title="Department Heads"
      description="All Department Heads currently registered on the platform."
    />
    <UsersListSection
      role="DEPARTMENT_HEAD"
      emptyTitle="No Department Heads yet"
      emptyDescription="Once you invite Department Heads and they complete registration, they will appear here."
    />
  </>
);
