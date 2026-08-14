import { PageHeader } from '@/components/ui/PageHeader';
import { UsersListSection } from '@/features/users/UsersListSection';

export const InvigilatorsPage = () => (
  <>
    <PageHeader
      title="Invigilators"
      description="All Invigilators currently registered on the platform."
    />
    <UsersListSection
      role="INVIGILATOR"
      emptyTitle="No Invigilators yet"
      emptyDescription="Once you invite Invigilators and they complete registration, they will appear here."
    />
  </>
);
