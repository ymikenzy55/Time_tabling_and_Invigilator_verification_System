import { Badge } from '@/components/ui/Badge';

const MAP = {
  ACTIVE:           { variant: 'success', label: 'Active' },
  PENDING_APPROVAL: { variant: 'warning', label: 'Pending Approval' },
  INVITED:          { variant: 'neutral', label: 'Invited' },
  SUSPENDED:        { variant: 'danger',  label: 'Suspended' },
  DISABLED:         { variant: 'neutral', label: 'Disabled' },
  REJECTED:         { variant: 'danger',  label: 'Rejected' },
};

export const StatusBadge = ({ status }) => {
  const { variant, label } = MAP[status] || { variant: 'neutral', label: status };
  return <Badge variant={variant}>{label}</Badge>;
};
