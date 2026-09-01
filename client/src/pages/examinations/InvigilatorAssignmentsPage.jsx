import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardList, Loader2, Trash2, UserPlus, Users, Building, Clock,
  AlertCircle, CheckCircle2, Settings,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { SkeletonCardGrid, Skeleton } from '@/components/ui/Skeleton';
import { examinationSessionsApi } from '@/features/examinations/examinationSessionsApi';
import { semestersApi } from '@/features/academics/semestersApi';
import { venuesApi } from '@/features/venues/venuesApi';
import { usersApi } from '@/features/users/usersApi';
import { venueAssignmentsApi } from '@/features/venueAssignments/venueAssignmentsApi';
import { attendanceApi } from '@/features/attendance/attendanceApi';
import toast from 'react-hot-toast';

const SEMESTER_ORDER = ['First Semester', 'Second Semester'];

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

const TIME_SLOTS = [
  { label: '8:00 AM – 11:00 AM', hour: 8 },
  { label: '11:00 AM – 2:00 PM', hour: 11 },
  { label: '2:00 PM – 5:00 PM', hour: 14 },
];

export const InvigilatorAssignmentsPage = () => {
  const qc = useQueryClient();
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [maxPerVenue, setMaxPerVenue] = useState(4);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [activeTab, setActiveTab] = useState('assignments');

  // Fetch semesters and filter to only First/Second, sorted with First first
  const semestersQuery = useQuery({
    queryKey: ['semesters'],
    queryFn: () => semestersApi.list(),
    staleTime: 5 * 60_000,
  });

  const filteredSemesters = useMemo(() => {
    if (!semestersQuery.data) return [];
    return semestersQuery.data
      .filter((s) => SEMESTER_ORDER.includes(s.name))
      .sort((a, b) => SEMESTER_ORDER.indexOf(a.name) - SEMESTER_ORDER.indexOf(b.name));
  }, [semestersQuery.data]);

  // Auto-select First Semester when semesters load
  useEffect(() => {
    if (!selectedSemester && filteredSemesters.length > 0) {
      setSelectedSemester(filteredSemesters[0].id);
    }
  }, [filteredSemesters, selectedSemester]);

  // Queries
  const sessionsQuery = useQuery({
    queryKey: ['examinationSessions'],
    queryFn: examinationSessionsApi.list,
    staleTime: 5 * 60_000,
  });

  // Filter sessions by selected semester
  const filteredSessions = useMemo(() => {
    if (!sessionsQuery.data) return [];
    if (!selectedSemester) return sessionsQuery.data;
    return sessionsQuery.data.filter((s) => s.semester?.id === selectedSemester);
  }, [sessionsQuery.data, selectedSemester]);

  // Auto-select first session when filtered sessions change
  useEffect(() => {
    if (filteredSessions.length > 0 && !filteredSessions.some((s) => s.id === selectedSession)) {
      setSelectedSession(filteredSessions[0].id);
    } else if (filteredSessions.length === 0) {
      setSelectedSession('');
    }
  }, [filteredSessions, selectedSession]);

  const assignmentsQuery = useQuery({
    queryKey: ['venueAssignments', { examinationSessionId: selectedSession }],
    queryFn: () => venueAssignmentsApi.list({ examinationSessionId: selectedSession }),
    enabled: !!selectedSession,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const scansQuery = useQuery({
    queryKey: ['venueScans', { examinationSessionId: selectedSession }],
    queryFn: () => attendanceApi.listVenueScans({ examinationSessionId: selectedSession }),
    enabled: !!selectedSession,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const venuesQuery = useQuery({
    queryKey: ['venues'],
    queryFn: () => venuesApi.list(),
    enabled: manualModalOpen,
  });

  const invigilatorsQuery = useQuery({
    queryKey: ['users', { role: 'INVIGILATOR', status: 'ACTIVE' }],
    queryFn: () => usersApi.list({ role: 'INVIGILATOR', status: 'ACTIVE' }),
    enabled: manualModalOpen,
  });

  // Mutations
  const assignMutation = useMutation({
    mutationFn: () => venueAssignmentsApi.assign(selectedSession, maxPerVenue),
    onSuccess: (data) => {
      toast.success(`Assigned ${data.assigned} invigilator slots across ${data.slots} time slots.`);
      qc.invalidateQueries({ queryKey: ['venueAssignments'] });
      setAssignModalOpen(false);
    },
    onError: (err) => toast.error(err.message || 'Failed to assign invigilators.'),
  });

  const manualAssignMutation = useMutation({
    mutationFn: (payload) => venueAssignmentsApi.manualAssign(payload),
    onSuccess: () => {
      toast.success('Invigilator assigned successfully.');
      qc.invalidateQueries({ queryKey: ['venueAssignments'] });
      setManualModalOpen(false);
    },
    onError: (err) => toast.error(err.message || 'Failed to assign invigilator.'),
  });

  const removeMutation = useMutation({
    mutationFn: (id) => venueAssignmentsApi.removeAssignment(id),
    onSuccess: () => {
      toast.success('Assignment removed.');
      qc.invalidateQueries({ queryKey: ['venueAssignments'] });
      setRemoveTarget(null);
    },
    onError: (err) => toast.error(err.message || 'Failed to remove assignment.'),
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

  // Group scans by date
  const scansGrouped = scans.reduce((acc, s) => {
    const dateKey = new Date(s.scannedAt).toDateString();
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(s);
    return acc;
  }, {});
  const scanDates = Object.keys(scansGrouped).sort((a, b) => new Date(b) - new Date(a));

  return (
    <>
      <PageHeader
        title="Invigilator Assignments"
        description="Assign invigilators to venues, manage constraints, and view check-ins."
      />

      {/* Semester + Session selector */}
      <div className="panel p-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <label className="label">Semester</label>
            <select
              className="input"
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
            >
              <option value="">Select semester…</option>
              {filteredSemesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.academicYear ? ` — ${s.academicYear.name}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="label">Examination Session</label>
            <select
              className="input"
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
            >
              <option value="">Select a session…</option>
              {filteredSessions.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          {selectedSession && (
            <div className="flex gap-2">
              <button
                className="btn-secondary btn-sm flex items-center gap-1.5"
                onClick={() => setAssignModalOpen(true)}
              >
                <Users className="w-4 h-4" /> Auto-Assign All
              </button>
              <button
                className="btn-primary btn-sm flex items-center gap-1.5"
                onClick={() => setManualModalOpen(true)}
              >
                <UserPlus className="w-4 h-4" /> Manual Assign
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      {selectedSession && (
        <div className="flex gap-1 mb-4 border-b border-surface-border">
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'assignments'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-ink-500 hover:text-ink-700'
            }`}
            onClick={() => setActiveTab('assignments')}
          >
            Assignments ({assignments.length})
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'checkins'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-ink-500 hover:text-ink-700'
            }`}
            onClick={() => setActiveTab('checkins')}
          >
            Check-ins ({scans.filter((s) => s.result === 'RECORDED').length})
          </button>
        </div>
      )}

      {/* Assignments tab */}
      {selectedSession && activeTab === 'assignments' && (
        <>
          {assignmentsQuery.isLoading ? (
            <SkeletonCardGrid count={4} lines={3} />
          ) : assignments.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No assignments yet"
              description="Use Auto-Assign to automatically distribute invigilators across all venues, or manually assign individual invigilators."
            />
          ) : (
            <div className="space-y-6">
              {sortedDates.map((dateKey) => {
                const dayAssignments = grouped[dateKey];
                const isToday = new Date().toDateString() === dateKey;

                return (
                  <div key={dateKey}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-2 h-2 rounded-full ${isToday ? 'bg-primary-600' : 'bg-ink-300'}`} />
                      <h3 className="text-sm font-bold text-ink-900">
                        {isToday ? 'Today' : formatDate(dateKey)}
                      </h3>
                      <span className="text-xs text-ink-400">
                        {dayAssignments.length} assignment{dayAssignments.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    {/* Desktop table / mobile cards */}
                    <div className="hidden md:block overflow-x-auto rounded-lg border border-surface-border">
                      <table className="min-w-full divide-y divide-surface-divider">
                        <thead className="bg-surface-subtle/50">
                          <tr>
                            <th className="px-4 py-2.5 text-left text-xs font-bold text-ink-600">Time Slot</th>
                            <th className="px-4 py-2.5 text-left text-xs font-bold text-ink-600">Venue</th>
                            <th className="px-4 py-2.5 text-left text-xs font-bold text-ink-600">Invigilator</th>
                            <th className="px-4 py-2.5 text-left text-xs font-bold text-ink-600">Staff ID</th>
                            <th className="px-4 py-2.5 text-right text-xs font-bold text-ink-600">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-divider bg-white">
                          {dayAssignments.map((a) => (
                            <tr key={a.id} className="hover:bg-surface-subtle/30">
                              <td className="px-4 py-3 text-sm text-ink-700">{getTimeSlot(a.slotAt)}</td>
                              <td className="px-4 py-3 text-sm font-medium text-ink-900">{a.venue?.name}</td>
                              <td className="px-4 py-3 text-sm text-ink-700">{a.invigilator?.fullName}</td>
                              <td className="px-4 py-3 text-sm text-ink-500">{a.invigilator?.staffId || '—'}</td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  className="btn btn-sm text-rose-700 border border-rose-200 hover:bg-rose-50"
                                  onClick={() => setRemoveTarget(a)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden space-y-2">
                      {dayAssignments.map((a) => (
                        <div key={a.id} className="panel p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 text-sm font-bold text-ink-900">
                                <Building className="w-4 h-4 shrink-0 text-ink-400" />
                                <span className="truncate">{a.venue?.name}</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-ink-500 mt-1">
                                <Clock className="w-3 h-3" />
                                {getTimeSlot(a.slotAt)}
                              </div>
                              <div className="text-xs text-ink-700 mt-1">{a.invigilator?.fullName}</div>
                              {a.invigilator?.staffId && (
                                <div className="text-xs text-ink-400">{a.invigilator.staffId}</div>
                              )}
                            </div>
                            <button
                              className="btn btn-sm text-rose-700 border border-rose-200 hover:bg-rose-50 shrink-0"
                              onClick={() => setRemoveTarget(a)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Check-ins tab */}
      {selectedSession && activeTab === 'checkins' && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="panel p-4 text-center">
              <div className="text-2xl font-bold text-ink-900">{assignments.length}</div>
              <div className="text-xs text-ink-500 mt-0.5">Total Assigned</div>
            </div>
            <div className="panel p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {scans.filter((s) => s.result === 'RECORDED').length}
              </div>
              <div className="text-xs text-ink-500 mt-0.5">Checked In</div>
            </div>
            <div className="panel p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">
                {Math.max(0, assignments.length - scans.filter((s) => s.result === 'RECORDED').length)}
              </div>
              <div className="text-xs text-ink-500 mt-0.5">Pending</div>
            </div>
            <div className="panel p-4 text-center">
              <div className="text-2xl font-bold text-rose-600">
                {scans.filter((s) => s.result !== 'RECORDED').length}
              </div>
              <div className="text-xs text-ink-500 mt-0.5">Rejected</div>
            </div>
          </div>

          {scansQuery.isLoading ? (
            <SkeletonCardGrid count={4} lines={3} />
          ) : scans.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No check-ins yet"
              description="Invigilator check-ins will appear here once they scan venue QR codes."
            />
          ) : (
            <div className="space-y-6">
              {scanDates.map((dateKey) => {
                const dayScans = scansGrouped[dateKey];
                const isToday = new Date().toDateString() === dateKey;
                const recordedCount = dayScans.filter((s) => s.result === 'RECORDED').length;

                return (
                  <div key={dateKey}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-2 h-2 rounded-full ${isToday ? 'bg-emerald-500' : 'bg-ink-300'}`} />
                      <h3 className="text-sm font-bold text-ink-900">
                        {isToday ? 'Today' : formatDate(dateKey)}
                      </h3>
                      <span className="text-xs text-ink-400">
                        {recordedCount} checked in
                      </span>
                    </div>

                    <div className="hidden md:block overflow-x-auto rounded-lg border border-surface-border">
                      <table className="min-w-full divide-y divide-surface-divider">
                        <thead className="bg-surface-subtle/50">
                          <tr>
                            <th className="px-4 py-2.5 text-left text-xs font-bold text-ink-600">Invigilator</th>
                            <th className="px-4 py-2.5 text-left text-xs font-bold text-ink-600">Staff ID</th>
                            <th className="px-4 py-2.5 text-left text-xs font-bold text-ink-600">Venue</th>
                            <th className="px-4 py-2.5 text-left text-xs font-bold text-ink-600">Time Slot</th>
                            <th className="px-4 py-2.5 text-left text-xs font-bold text-ink-600">Check-in Time</th>
                            <th className="px-4 py-2.5 text-left text-xs font-bold text-ink-600">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-divider bg-white">
                          {dayScans.map((s) => (
                            <tr key={s.id} className={`hover:bg-surface-subtle/30 ${s.result === 'RECORDED' ? 'bg-emerald-50/30' : 'bg-rose-50/20'}`}>
                              <td className="px-4 py-3 text-sm font-medium text-ink-900">
                                <div className="flex items-center gap-2">
                                  {s.result === 'RECORDED' ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                  ) : (
                                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                                  )}
                                  {s.user?.fullName}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-ink-500">{s.user?.staffId || '—'}</td>
                              <td className="px-4 py-3 text-sm text-ink-700">{s.venue?.name}</td>
                              <td className="px-4 py-3 text-sm text-ink-500">
                                {s.slotAt ? getTimeSlot(s.slotAt) : '—'}
                              </td>
                              <td className="px-4 py-3 text-sm text-ink-500">
                                {new Date(s.scannedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </td>
                              <td className="px-4 py-3">
                                {s.result === 'RECORDED' ? (
                                  <Badge variant="success">Checked In</Badge>
                                ) : (
                                  <Badge variant="danger">{s.result.replace('REJECTED_', '')}</Badge>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden space-y-2">
                      {dayScans.map((s) => (
                        <div key={s.id} className={`card p-3 ${s.result === 'RECORDED' ? 'border-emerald-200' : 'border-rose-200'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                {s.result === 'RECORDED' ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                ) : (
                                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                                )}
                                <span className="text-sm font-bold text-ink-900 truncate">{s.user?.fullName}</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-ink-500 mt-1">
                                <Building className="w-3 h-3" />
                                {s.venue?.name}
                              </div>
                              {s.slotAt && (
                                <div className="flex items-center gap-1 text-xs text-ink-400 mt-0.5">
                                  <Clock className="w-3 h-3" />
                                  {getTimeSlot(s.slotAt)}
                                </div>
                              )}
                              <div className="flex items-center gap-1 text-xs text-ink-400 mt-0.5">
                                <CheckCircle2 className="w-3 h-3" />
                                {new Date(s.scannedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </div>
                            </div>
                            {s.result === 'RECORDED' ? (
                              <Badge variant="success" className="shrink-0">Checked In</Badge>
                            ) : (
                              <Badge variant="danger" className="shrink-0">{s.result.replace('REJECTED_', '')}</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Auto-assign modal */}
      <Modal
        open={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title="Auto-Assign Invigilators"
        size="sm"
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              This will <strong>replace all existing assignments</strong> for this session.
              Invigilators will be distributed across venues with constraint enforcement:
              no double-booking, one time frame per day per invigilator.
            </span>
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5" />
              Max invigilators per venue (for large venues)
            </label>
            <input
              type="number"
              min={1}
              max={10}
              className="input"
              value={maxPerVenue}
              onChange={(e) => setMaxPerVenue(Math.max(1, Math.min(10, parseInt(e.target.value) || 4)))}
            />
            <p className="text-xs text-ink-500 mt-1">
              Large venues with more students will get up to this many invigilators per time slot.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setAssignModalOpen(false)}>Cancel</button>
            <button
              className="btn-primary"
              onClick={() => assignMutation.mutate()}
              disabled={assignMutation.isPending}
            >
              {assignMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
              Auto-Assign
            </button>
          </div>
        </div>
      </Modal>

      {/* Manual assign modal */}
      <ManualAssignModal
        open={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        session={selectedSession}
        venues={venuesQuery.data || []}
        invigilators={invigilatorsQuery.data || []}
        venuesLoading={venuesQuery.isLoading}
        invigilatorsLoading={invigilatorsQuery.isLoading}
        onAssign={(payload) => manualAssignMutation.mutate(payload)}
        loading={manualAssignMutation.isPending}
      />

      {/* Remove confirmation */}
      <Modal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title="Remove Assignment"
        size="sm"
      >
        {removeTarget && (
          <div className="space-y-4">
            <p className="text-sm text-ink-700">
              Remove <strong>{removeTarget.invigilator?.fullName}</strong> from{' '}
              <strong>{removeTarget.venue?.name}</strong> on{' '}
              {formatDate(removeTarget.slotAt)} ({getTimeSlot(removeTarget.slotAt)})?
            </p>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setRemoveTarget(null)}>Cancel</button>
              <button
                className="btn bg-rose-600 text-white hover:bg-rose-700"
                onClick={() => removeMutation.mutate(removeTarget.id)}
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

const ManualAssignModal = ({ open, onClose, session, venues, invigilators, venuesLoading, invigilatorsLoading, onAssign, loading }) => {
  const [venueId, setVenueId] = useState('');
  const [invigilatorId, setInvigilatorId] = useState('');
  const [date, setDate] = useState('');
  const [slotHour, setSlotHour] = useState(8);

  const handleSubmit = () => {
    if (!venueId || !invigilatorId || !date) {
      toast.error('Please fill in all fields.');
      return;
    }
    const slotAt = new Date(date);
    slotAt.setHours(slotHour, 0, 0, 0);
    onAssign({
      examinationSessionId: session,
      venueId,
      invigilatorId,
      slotAt: slotAt.toISOString(),
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Manual Assignment"
      description="Assign a specific invigilator to a venue. Constraints will be enforced."
      size="sm"
    >
      <div className="space-y-3">
        <div>
          <label className="label">Invigilator</label>
          {invigilatorsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
            <select className="input" value={invigilatorId} onChange={(e) => setInvigilatorId(e.target.value)}>
              <option value="">Select invigilator…</option>
              {invigilators.map((u) => (
                <option key={u.id} value={u.id}>{u.fullName} {u.staffId ? `(${u.staffId})` : ''}</option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="label">Venue</label>
          {venuesLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
            <select className="input" value={venueId} onChange={(e) => setVenueId(e.target.value)}>
              <option value="">Select venue…</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{v.name} (cap: {v.capacity})</option>
              ))}
            </select>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Time Slot</label>
            <select className="input" value={slotHour} onChange={(e) => setSlotHour(parseInt(e.target.value))}>
              {TIME_SLOTS.map((s) => (
                <option key={s.hour} value={s.hour}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="rounded-lg bg-surface-subtle p-3 text-xs text-ink-600 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Constraints: invigilator cannot be at two venues at the same time, and can only have
            one time frame per day.
          </span>
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Assign
          </button>
        </div>
      </div>
    </Modal>
  );
};
