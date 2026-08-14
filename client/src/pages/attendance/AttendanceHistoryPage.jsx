import { useQuery } from '@tanstack/react-query';
import { Loader2, ClipboardList } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { attendanceApi } from '@/features/attendance/attendanceApi';

const STATUS_VARIANT = {
  RECORDED: 'success',
  REJECTED_WINDOW: 'warning',
  REJECTED_DUPLICATE: 'neutral',
  REJECTED_UNASSIGNED: 'danger',
  REJECTED_INVALID_QR: 'danger',
};

const formatDateTime = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d) ? v : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

export const AttendanceHistoryPage = () => {
  const query = useQuery({
    queryKey: ['attendance', 'history'],
    queryFn: () => attendanceApi.list(),
  });

  const records = query.data || [];

  return (
    <>
      <PageHeader
        title="Attendance History"
        description="Your QR scan attempts and recorded attendances."
      />

      {query.isLoading ? (
        <SkeletonTable rows={6} cols={4} />
      ) : records.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No attendance records yet"
          description="Scan an attendance QR code during an examination to see it here."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {records.map((r) => (
            <div key={r.id} className="panel p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-ink-900">
                    {r.invigilation?.course?.code} — {r.invigilation?.course?.title}
                  </div>
                  <div className="text-sm text-ink-500">
                    Scheduled: {formatDateTime(r.invigilation?.scheduledAt)}
                  </div>
                </div>
                <Badge variant={STATUS_VARIANT[r.result] || 'neutral'}>{r.result}</Badge>
              </div>
              <div className="mt-3 text-xs text-ink-400">
                Scanned at {formatDateTime(r.scannedAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};
