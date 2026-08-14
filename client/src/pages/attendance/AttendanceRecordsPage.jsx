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

export const AttendanceRecordsPage = () => {
  const query = useQuery({
    queryKey: ['attendance', 'records'],
    queryFn: () => attendanceApi.list(),
  });

  const records = query.data || [];

  return (
    <>
      <PageHeader
        title="Attendance Records"
        description="All QR scan attempts across examination sessions."
      />

      {query.isLoading ? (
        <SkeletonTable rows={6} cols={4} />
      ) : records.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No attendance records yet"
          description="Records will appear once invigilators start scanning QR codes."
        />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-subtle text-ink-500 text-xs uppercase">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Course</th>
                  <th className="text-left font-medium px-4 py-3">Invigilator</th>
                  <th className="text-left font-medium px-4 py-3">Scheduled</th>
                  <th className="text-left font-medium px-4 py-3">Result</th>
                  <th className="text-left font-medium px-4 py-3">Scanned at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-divider">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-subtle/50">
                    <td className="px-4 py-3 text-ink-900">
                      {r.invigilation?.course?.code} — {r.invigilation?.course?.title}
                    </td>
                    <td className="px-4 py-3 text-ink-700">{r.user?.fullName}</td>
                    <td className="px-4 py-3 text-ink-700">{formatDateTime(r.invigilation?.scheduledAt)}</td>
                    <td className="px-4 py-3"><Badge variant={STATUS_VARIANT[r.result] || 'neutral'}>{r.result}</Badge></td>
                    <td className="px-4 py-3 text-ink-500">{formatDateTime(r.scannedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
};
