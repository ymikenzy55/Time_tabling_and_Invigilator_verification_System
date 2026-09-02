import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardList, Loader2, Trash2, UserPlus, Users, Building, Clock,
  AlertCircle, CheckCircle2, Settings, MapPin, Search, ChevronRight,
  ChevronLeft,
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
  const navigate = useNavigate();
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [maxPerVenue, setMaxPerVenue] = useState(4);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [activeTab, setActiveTab] = useState('assignments');
  const [scanSearch, setScanSearch] = useState('');
  const [invigilatorSearch, setInvigilatorSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

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

  // Group assignments by invigilator for the invigilator list view
  const invigilatorGroups = useMemo(() => {
    const map = new Map();
    for (const a of assignments) {
      const invId = a.invigilator?.id;
      if (!invId) continue;
      if (!map.has(invId)) {
        map.set(invId, {
          id: invId,
          fullName: a.invigilator?.fullName || 'Unknown',
          departmentName: a.invigilator?.departmentName || '—',
          staffId: a.invigilator?.staffId || '—',
          assignmentCount: 0,
          venues: new Set(),
          dates: new Set(),
        });
      }
      const entry = map.get(invId);
      entry.assignmentCount++;
      if (a.venue?.name) entry.venues.add(a.venue.name);
      entry.dates.add(new Date(a.slotAt).toDateString());
    }
    return [...map.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [assignments]);

  // Filter invigilators by search
  const filteredInvigilators = useMemo(() => {
    if (!invigilatorSearch.trim()) return invigilatorGroups;
    const q = invigilatorSearch.toLowerCase();
    return invigilatorGroups.filter(
      (inv) =>
        inv.fullName.toLowerCase().includes(q) ||
        inv.departmentName.toLowerCase().includes(q) ||
        inv.staffId.toLowerCase().includes(q)
    );
  }, [invigilatorGroups, invigilatorSearch]);

  // Reset page when search or session changes
  useEffect(() => {
    setCurrentPage(1);
  }, [invigilatorSearch, selectedSession]);

  const totalPages = Math.ceil(filteredInvigilators.length / PAGE_SIZE);
  const paginatedInvigilators = filteredInvigilators.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Filter scans by search query
  const filteredScans = useMemo(() => {
    if (!scanSearch.trim()) return scans;
    const q = scanSearch.toLowerCase();
    return scans.filter((s) =>
      s.user?.fullName?.toLowerCase().includes(q) ||
      s.user?.staffId?.toLowerCase().includes(q) ||
      s.user?.email?.toLowerCase().includes(q) ||
      s.venue?.name?.toLowerCase().includes(q)
    );
  }, [scans, scanSearch]);

  // Group scans by date
  const scansGrouped = filteredScans.reduce((acc, s) => {
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

      {/* Semester selector */}
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

      {/* Assignments tab — Invigilator list */}
      {selectedSession && activeTab === 'assignments' && (
        <>
          {assignmentsQuery.isLoading ? (
            <SkeletonCardGrid count={4} lines={3} label="Loading assignments…" />
          ) : assignments.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No assignments yet"
              description="Use Auto-Assign to automatically distribute invigilators across all venues, or manually assign individual invigilators."
            />
          ) : (
            <>
              {/* Search */}
              <div className="relative max-w-md mb-4">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  className="input pl-9"
                  placeholder="Search by name, department, or staff ID..."
                  value={invigilatorSearch}
                  onChange={(e) => setInvigilatorSearch(e.target.value)}
                />
              </div>

              {/* Summary */}
              <div className="text-sm text-ink-500 mb-3">
                {filteredInvigilators.length} invigilator{filteredInvigilators.length === 1 ? '' : 's'} assigned
              </div>

              {filteredInvigilators.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="No matches"
                  description="No invigilators match your search."
                />
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto rounded-lg border border-surface-border">
                    <table className="min-w-full divide-y divide-surface-divider">
                      <thead className="bg-surface-subtle/50">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-bold text-ink-600">Invigilator</th>
                          <th className="px-4 py-2.5 text-left text-xs font-bold text-ink-600">Department</th>
                          <th className="px-4 py-2.5 text-left text-xs font-bold text-ink-600">Staff ID</th>
                          <th className="px-4 py-2.5 text-center text-xs font-bold text-ink-600">Slots</th>
                          <th className="px-4 py-2.5 text-center text-xs font-bold text-ink-600">Days</th>
                          <th className="px-4 py-2.5 text-center text-xs font-bold text-ink-600">Venues</th>
                          <th className="px-4 py-2.5 text-right text-xs font-bold text-ink-600"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-divider bg-white">
                        {paginatedInvigilators.map((inv) => (
                          <tr
                            key={inv.id}
                            className="hover:bg-surface-subtle/30 cursor-pointer transition-colors"
                            onClick={() => navigate(`/invigilator-assignments/${inv.id}`)}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 grid place-items-center text-xs font-bold shrink-0">
                                  {inv.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                                </div>
                                <span className="text-sm font-medium text-ink-900">{inv.fullName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-ink-700">{inv.departmentName}</td>
                            <td className="px-4 py-3 text-sm text-ink-500">{inv.staffId}</td>
                            <td className="px-4 py-3 text-center text-sm font-bold text-ink-900">{inv.assignmentCount}</td>
                            <td className="px-4 py-3 text-center text-sm text-ink-700">{inv.dates.size}</td>
                            <td className="px-4 py-3 text-center text-sm text-ink-700">{inv.venues.size}</td>
                            <td className="px-4 py-3 text-right">
                              <ChevronRight className="w-4 h-4 text-ink-400 inline" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="md:hidden space-y-2">
                    {paginatedInvigilators.map((inv) => (
                      <div
                        key={inv.id}
                        className="panel p-3 cursor-pointer active:bg-surface-subtle"
                        onClick={() => navigate(`/invigilator-assignments/${inv.id}`)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 grid place-items-center text-xs font-bold shrink-0">
                              {inv.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-ink-900 truncate">{inv.fullName}</div>
                              <div className="text-xs text-ink-500 truncate">{inv.departmentName}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="info">{inv.assignmentCount} slot{inv.assignmentCount === 1 ? '' : 's'}</Badge>
                            <ChevronRight className="w-4 h-4 text-ink-400" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-xs text-ink-500">
                        Page {currentPage} of {totalPages} · {filteredInvigilators.length} invigilator{filteredInvigilators.length === 1 ? '' : 's'}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          className="btn btn-sm border border-surface-border disabled:opacity-40 disabled:cursor-not-allowed"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter((p) => Math.abs(p - currentPage) <= 2 || p === 1 || p === totalPages)
                          .map((p, idx, arr) => (
                            <span key={p} className="flex items-center">
                              {idx > 0 && arr[idx - 1] !== p - 1 && (
                                <span className="text-ink-300 px-1">…</span>
                              )}
                              <button
                                className={`btn btn-sm min-w-[2rem] ${
                                  p === currentPage
                                    ? 'bg-primary-600 text-white border-primary-600'
                                    : 'border border-surface-border'
                                }`}
                                onClick={() => setCurrentPage(p)}
                              >
                                {p}
                              </button>
                            </span>
                          ))}
                        <button
                          className="btn btn-sm border border-surface-border disabled:opacity-40 disabled:cursor-not-allowed"
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
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
            <SkeletonCardGrid count={4} lines={3} label="Loading check-ins…" />
          ) : scans.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No check-ins yet"
              description="Invigilator check-ins will appear here once they scan venue QR codes."
            />
          ) : (
            <div className="space-y-4">
              <div className="relative max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  className="input pl-9"
                  placeholder="Search by name, staff ID, email, or venue..."
                  value={scanSearch}
                  onChange={(e) => setScanSearch(e.target.value)}
                />
              </div>
              {scanDates.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="No matches"
                  description="No check-ins match your search."
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
                            <th className="px-4 py-2.5 text-left text-xs font-bold text-ink-600">Location</th>
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
                              <td className="px-4 py-3 text-xs text-ink-500">
                                {s.latitude != null && s.longitude != null ? (
                                  <a
                                    href={`https://www.google.com/maps?q=${s.latitude},${s.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-primary-700 hover:text-primary-800"
                                  >
                                    <MapPin className="w-3 h-3" />
                                    {s.latitude.toFixed(6)}, {s.longitude.toFixed(6)}
                                  </a>
                                ) : '—'}
                                {s.locationAddress && (
                                  <div className="text-ink-400 mt-0.5">{s.locationAddress}</div>
                                )}
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
                              {s.latitude != null && s.longitude != null && (
                                <a
                                  href={`https://www.google.com/maps?q=${s.latitude},${s.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs text-primary-700 mt-0.5"
                                >
                                  <MapPin className="w-3 h-3" />
                                  {s.latitude.toFixed(6)}, {s.longitude.toFixed(6)}
                                </a>
                              )}
                              {s.locationAddress && (
                                <div className="text-xs text-ink-400 mt-0.5">{s.locationAddress}</div>
                              )}
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
