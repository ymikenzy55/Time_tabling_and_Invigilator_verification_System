import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, MapPin, Clock, ScanLine, CheckCircle2,
  AlertCircle, Building, Loader2,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCardGrid } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { venueAssignmentsApi } from '@/features/venueAssignments/venueAssignmentsApi';
import { attendanceApi } from '@/features/attendance/attendanceApi';

const formatDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d) ? v : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

const getTimeSlot = (datetimeStr) => {
  const d = new Date(datetimeStr);
  const h = d.getHours();
  if (h < 11) return '8:00 AM – 11:00 AM';
  if (h < 14) return '11:00 AM – 2:00 PM';
  return '2:00 PM – 5:00 PM';
};

export const MyAssignmentsPage = () => {
  const navigate = useNavigate();
  const [confirmScan, setConfirmScan] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const assignmentsQuery = useQuery({
    queryKey: ['myVenueAssignments'],
    queryFn: venueAssignmentsApi.myAssignments,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const scansQuery = useQuery({
    queryKey: ['myVenueScans'],
    queryFn: () => attendanceApi.listVenueScans(),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const assignments = assignmentsQuery.data || [];
  const scans = scansQuery.data || [];

  // Group assignments by date
  const grouped = assignments.reduce((acc, a) => {
    const dateKey = new Date(a.slotAt).toDateString();
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(a);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));

  // Check if an assignment has been scanned
  const isScanned = (assignmentId) => {
    return scans.some(
      (s) =>
        s.venueId === assignments.find((a) => a.id === assignmentId)?.venue?.id &&
        s.result === 'RECORDED' &&
        new Date(s.scannedAt).toDateString() ===
          new Date(assignments.find((a) => a.id === assignmentId)?.slotAt).toDateString()
    );
  };

  const handleScanClick = (assignment) => {
    setConfirmScan(assignment);
  };

  const confirmSubmit = async () => {
    if (!confirmScan) return;
    setSubmitting(true);
    try {
      navigate('/scan', { state: { fromAssignment: confirmScan } });
      setConfirmScan(null);
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = assignmentsQuery.isLoading;

  return (
    <>
      <PageHeader
        title="My Assignments"
        description="Your venue invigilation schedule. Scan the venue QR code to check in."
      />

      {/* Stats summary — mobile responsive */}
      {!isLoading && assignments.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
          <div className="panel p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold text-ink-900">{assignments.length}</div>
            <div className="text-xs text-ink-500 mt-0.5">Total Slots</div>
          </div>
          <div className="panel p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold text-emerald-600">
              {scans.filter((s) => s.result === 'RECORDED').length}
            </div>
            <div className="text-xs text-ink-500 mt-0.5">Checked In</div>
          </div>
          <div className="panel p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold text-amber-600">
              {assignments.filter((a) => !isScanned(a.id) && new Date(a.slotAt) > new Date()).length}
            </div>
            <div className="text-xs text-ink-500 mt-0.5">Upcoming</div>
          </div>
        </div>
      )}

      {isLoading ? (
        <SkeletonCardGrid count={4} lines={3} />
      ) : assignments.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No assignments yet"
          description="You have not been assigned to any examination venues. Once the exam officer assigns you, your schedule will appear here."
        />
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateKey) => {
            const dayAssignments = grouped[dateKey];
            const isToday = new Date().toDateString() === dateKey;
            const isPast = new Date(dateKey) < new Date() && !isToday;

            return (
              <div key={dateKey}>
                {/* Date header */}
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-2 h-2 rounded-full ${isToday ? 'bg-primary-600' : isPast ? 'bg-ink-300' : 'bg-emerald-500'}`} />
                  <h3 className="text-sm font-bold text-ink-900">
                    {isToday ? 'Today' : formatDate(dateKey)}
                  </h3>
                  <span className="text-xs text-ink-400">
                    {dayAssignments.length} slot{dayAssignments.length === 1 ? '' : 's'}
                  </span>
                </div>

                {/* Assignment cards — mobile first */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {dayAssignments.map((a) => {
                    const scanned = isScanned(a.id);
                    const slotLabel = getTimeSlot(a.slotAt);

                    return (
                      <div
                        key={a.id}
                        className={`card p-4 sm:p-5 transition-all ${
                          scanned ? 'border-emerald-300 bg-emerald-50/30' : ''
                        } ${isToday && !scanned ? 'ring-1 ring-primary-200' : ''}`}
                      >
                        {/* Top: venue + status */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-sm font-bold text-ink-900 truncate">
                              <Building className="w-4 h-4 shrink-0 text-ink-400" />
                              <span className="truncate">{a.venue?.name || '—'}</span>
                            </div>
                            {a.venue?.location && (
                              <div className="flex items-center gap-1 text-xs text-ink-500 mt-1 truncate">
                                <MapPin className="w-3 h-3 shrink-0" />
                                <span className="truncate">{a.venue.location}</span>
                              </div>
                            )}
                          </div>
                          {scanned ? (
                            <Badge variant="success" className="shrink-0">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Checked In
                            </Badge>
                          ) : isPast ? (
                            <Badge variant="neutral" className="shrink-0">Missed</Badge>
                          ) : (
                            <Badge variant="info" className="shrink-0">Pending</Badge>
                          )}
                        </div>

                        {/* Time slot */}
                        <div className="mt-3 flex items-center gap-2 text-sm text-ink-700">
                          <Clock className="w-4 h-4 text-ink-400" />
                          <span className="font-medium">{slotLabel}</span>
                        </div>

                        {/* Session info */}
                        <div className="mt-2 text-xs text-ink-500">
                          {a.examinationSession?.name}
                        </div>

                        {/* Action button */}
                        {!scanned && !isPast && (
                          <button
                            className="mt-4 w-full btn-primary btn-sm flex items-center justify-center gap-2"
                            onClick={() => handleScanClick(a)}
                          >
                            <ScanLine className="w-4 h-4" />
                            Scan Venue QR
                          </button>
                        )}
                        {scanned && (
                          <div className="mt-4 text-xs text-emerald-700 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Attendance submitted to exam officer
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation modal before scanning */}
      <Modal
        open={!!confirmScan}
        onClose={() => setConfirmScan(null)}
        title="Confirm Attendance Check-in"
        size="sm"
      >
        {confirmScan && (
          <div className="space-y-4">
            <div className="rounded-lg bg-surface-subtle p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-ink-400" />
                <span className="font-medium text-ink-900">{confirmScan.venue?.name}</span>
              </div>
              <div className="flex items-center gap-2 text-ink-600">
                <MapPin className="w-3.5 h-3.5" />
                {confirmScan.venue?.location || '—'}
              </div>
              <div className="flex items-center gap-2 text-ink-600">
                <Clock className="w-3.5 h-3.5" />
                {formatDate(confirmScan.slotAt)} · {getTimeSlot(confirmScan.slotAt)}
              </div>
            </div>
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                You will be directed to scan the venue QR code. Your attendance will be sent to the exam officer
                after scanning. Make sure you scan the QR code for <strong>{confirmScan.venue?.name}</strong> —
                scanning a different venue will be rejected.
              </span>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setConfirmScan(null)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={confirmSubmit}
                disabled={submitting}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
                Proceed to Scan
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};
