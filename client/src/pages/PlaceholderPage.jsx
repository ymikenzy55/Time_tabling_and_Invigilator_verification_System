import { Construction } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';

export const PlaceholderPage = ({ title, description, phase }) => (
  <>
    <PageHeader
      title={title}
      description={description}
      actions={phase ? <Badge variant="warning">Coming in {phase}</Badge> : null}
    />
    <EmptyState
      icon={Construction}
      title="This module is scaffolded and ready for implementation"
      description="The backend routes, database models, and navigation entry for this module are already in place. Feature work will land in an upcoming phase."
    />
  </>
);
