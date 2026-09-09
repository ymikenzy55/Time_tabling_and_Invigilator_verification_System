import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ClipboardList, Calendar } from 'lucide-react';
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
  REJECTED_VENUE_MISMATCH: 'danger',
};

const STATUS_LABEL = {
  RECORDED: 'Present',
  REJECTED_WINDOW: 'Outside Time',
  REJECTED_DUPLICATE: 'Duplicate',
  REJECTED_UNASSIGNED: 'Not Authorized',
  REJECTED_INVALID_QR: 'Invalid QR',
  REJECTED_VENUE_MISMATCH: 'Wrong Venue',
};

const formatDateTime = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d) ? v : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const formatLocation = (r) => {
  if (r.locationAddress) return r.locationAddress;
  if (r.latitude != null && r.longitude != null) {
    return `${r.latitude.toFixed(6)}, ${r.longitude.toFixed(6)}`;
  }
  return '—';
};

export const AttendanceHistoryPage = () => {
  const [dateFilter, setDateFilter] = useState('');

  const query = useQuery({
    queryKey: ['attendance', 'venue-scans', { date: dateFilter }],
    queryFn: () => attendanceApi.listVenueScans(dateFilter ? { date: dateFilter } : {}),
  });

  const records = query.data || [];

  return (
    <>
      <PageHeader
        title="Attendance History"
        description="Your QR scan attempts and recorded attendances."
      />

      <div className="panel p-4 mb-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <Calendar className="w-4 h-4 text-ink-500 shrink-0" />
          <label className="text-sm font-medium text-ink-700 shrink-0">Filter by date:</label>
          <input
            type="date"
            className="input flex-1 min-w-[150px] sm:flex-none sm:max-w-[180px]"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
          {dateFilter && (
            <button
              className="btn-secondary btn-sm"
              onClick={() => setDateFilter('')}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {query.isLoading ? (
        <SkeletonTable rows={6} cols={4} label="Loading attendance history…" />
      ) : records.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={dateFilter ? 'No scans on this date' : 'No attendance records yet'}
          description={dateFilter
            ? 'You have no scan records for the selected date.'
            : 'Scan an attendance QR code during an examination to see it here.'}
        />
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <div className="space-y-3 md:hidden">
            {records.map((r) => (
              <div key={r.id} className="panel p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-ink-900 break-words">{r.venue?.name || '—'}</div>
                    {r.venue?.location && (
                      <div className="text-xs text-ink-500 break-words">{r.venue.location}</div>
                    )}
                  </div>
                  <Badge variant={STATUS_VARIANT[r.result] || 'neutral'}>
                    {STATUS_LABEL[r.result] || r.result}
                  </Badge>
                </div>

                <dl className="mt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-500 shrink-0">Scanned at</dt>
                    <dd className="text-ink-700 text-right break-words">{formatDateTime(r.scannedAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-500 shrink-0">Location</dt>
                    <dd className="text-ink-700 text-right break-all">
                      {formatLocation(r)}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>

          {/* Desktop / tablet: table */}
          <div className="panel overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-subtle border-b border-surface-border">
                  <tr>
                    <th className="text-left px-4 py-3 font-bold text-ink-700">Venue</th>
                    <th className="text-left px-4 py-3 font-bold text-ink-700">Status</th>
                    <th className="text-left px-4 py-3 font-bold text-ink-700">Scanned At</th>
                    <th className="text-left px-4 py-3 font-bold text-ink-700">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-divider">
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-surface-subtle transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink-900">{r.venue?.name || '—'}</div>
                        {r.venue?.location && (
                          <div className="text-xs text-ink-500">{r.venue.location}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[r.result] || 'neutral'}>
                          {STATUS_LABEL[r.result] || r.result}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-ink-600 whitespace-nowrap">
                        {formatDateTime(r.scannedAt)}
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-500">
                        {formatLocation(r)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
};
