import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight, Clock, Building, MapPin, Trash2, Loader2,
  ClipboardList, ArrowLeft,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCardGrid } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { venueAssignmentsApi } from '@/features/venueAssignments/venueAssignmentsApi';
import toast from 'react-hot-toast';

const formatDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d) ? v : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

const formatDateLong = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d) ? v : d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

const getTimeSlot = (datetimeStr) => {
  const d = new Date(datetimeStr);
  const h = d.getHours();
  if (h < 11) return '8:00 AM – 11:00 AM';
  if (h < 14) return '11:00 AM – 2:00 PM';
  return '2:00 PM – 5:00 PM';
};

export const InvigilatorAssignmentDetailPage = () => {
  const { invigilatorId } = useParams();
  const qc = useQueryClient();
  const [removeTargetState, setRemoveTargetState] = useState(null);

  const assignmentsQuery = useQuery({
    queryKey: ['venueAssignments', { invigilatorId }],
    queryFn: () => venueAssignmentsApi.list({ invigilatorId }),
    enabled: !!invigilatorId,
    staleTime: 30_000,
  });

  const removeMutation = useMutation({
    mutationFn: (id) => venueAssignmentsApi.removeAssignment(id),
    onSuccess: () => {
      toast.success('Assignment removed.');
      qc.invalidateQueries({ queryKey: ['venueAssignments'] });
      setRemoveTargetState(null);
    },
    onError: (err) => toast.error(err.message || 'Failed to remove assignment.'),
  });

  const assignments = assignmentsQuery.data || [];
  const isLoading = assignmentsQuery.isLoading;

  const invigilator = assignments[0]?.invigilator;
  const invigilatorName = invigilator?.fullName || 'Invigilator';
  const invigilatorDept = invigilator?.departmentName || '—';
  const invigilatorStaffId = invigilator?.staffId || '—';

  const grouped = assignments.reduce((acc, a) => {
    const dateKey = new Date(a.slotAt).toDateString();
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(a);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));

  const sessionName = assignments[0]?.examinationSession?.name || '';

  return (
    <>
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm text-ink-500 mb-4">
        <Link to="/invigilator-assignments" className="hover:text-primary-700 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Invigilator Assignments
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-ink-300" />
        <span className="text-ink-900 font-medium truncate max-w-[200px]">{invigilatorName}</span>
      </nav>

      <PageHeader
        title={invigilatorName}
        description={`${invigilatorDept}${invigilatorStaffId !== '—' ? ` · Staff ID: ${invigilatorStaffId}` : ''}${sessionName ? ` · ${sessionName}` : ''}`}
      />

      {isLoading ? (
        <SkeletonCardGrid count={4} lines={3} label="Loading assignments…" />
      ) : assignments.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No assignments"
          description="This invigilator has not been assigned to any venues."
        />
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <div className="panel p-4 text-center">
              <div className="text-2xl font-bold text-ink-900">{assignments.length}</div>
              <div className="text-xs text-ink-500 mt-0.5">Total Slots</div>
            </div>
            <div className="panel p-4 text-center">
              <div className="text-2xl font-bold text-primary-700">{sortedDates.length}</div>
              <div className="text-xs text-ink-500 mt-0.5">Days Assigned</div>
            </div>
            <div className="panel p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {[...new Set(assignments.map((a) => a.venue?.id))].length}
              </div>
              <div className="text-xs text-ink-500 mt-0.5">Unique Venues</div>
            </div>
          </div>

          {/* Assignments grouped by date */}
          <div className="space-y-6">
            {sortedDates.map((dateKey) => {
              const dayAssignments = grouped[dateKey];
              const isToday = new Date().toDateString() === dateKey;
              const isPast = new Date(dateKey) < new Date() && !isToday;

              return (
                <div key={dateKey}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-2 h-2 rounded-full ${isToday ? 'bg-primary-600' : isPast ? 'bg-ink-300' : 'bg-emerald-500'}`} />
                    <h3 className="text-sm font-bold text-ink-900">
                      {isToday ? 'Today' : formatDateLong(dateKey)}
                    </h3>
                    <span className="text-xs text-ink-400">
                      {dayAssignments.length} slot{dayAssignments.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {dayAssignments.map((a) => {
                      const slotLabel = getTimeSlot(a.slotAt);
                      const courseList = a.courses || [];

                      return (
                        <div
                          key={a.id}
                          className={`card p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${
                            isToday ? 'ring-1 ring-primary-200' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2 sm:w-40 shrink-0">
                            <Clock className="w-4 h-4 text-ink-400 shrink-0" />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-ink-900">{slotLabel}</div>
                              <div className="text-xs text-ink-400">3 hrs</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 sm:w-48 shrink-0 min-w-0">
                            <Building className="w-4 h-4 text-ink-400 shrink-0" />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-ink-900 truncate">{a.venue?.name || '—'}</div>
                              {a.venue?.location && (
                                <div className="text-xs text-ink-400 truncate flex items-center gap-1">
                                  <MapPin className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{a.venue.location}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            {courseList.length > 0 ? (
                              <div className="space-y-1">
                                {courseList.map((c) => (
                                  <div key={c.id} className="text-sm text-ink-700">
                                    <span className="font-medium">{c.code}</span>
                                    <span className="text-ink-500"> — {c.title}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-sm text-ink-400 italic">No course assigned</div>
                            )}
                          </div>

                          <div className="shrink-0">
                            <button
                              className="btn btn-sm text-rose-700 border border-rose-200 hover:bg-rose-50"
                              onClick={() => setRemoveTargetState(a)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Remove confirmation */}
      <Modal
        open={!!removeTargetState}
        onClose={() => setRemoveTargetState(null)}
        title="Remove Assignment"
        size="sm"
      >
        {removeTargetState && (
          <div className="space-y-4">
            <p className="text-sm text-ink-700">
              Remove <strong>{removeTargetState.invigilator?.fullName}</strong> from{' '}
              <strong>{removeTargetState.venue?.name}</strong> on{' '}
              {formatDate(removeTargetState.slotAt)} ({getTimeSlot(removeTargetState.slotAt)})?
            </p>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setRemoveTargetState(null)}>Cancel</button>
              <button
                className="btn bg-rose-600 text-white hover:bg-rose-700"
                onClick={() => removeMutation.mutate(removeTargetState.id)}
                disabled={removeMutation.isPending}
              >
                {removeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Remove
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};
