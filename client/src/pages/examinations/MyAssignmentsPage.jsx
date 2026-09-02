import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardList, MapPin, Clock, CheckCircle2,
  Building, BookOpen, Download, UserPlus, Send, Loader2, AlertCircle,
  ScanLine,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCardGrid } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { venueAssignmentsApi } from '@/features/venueAssignments/venueAssignmentsApi';
import { attendanceApi } from '@/features/attendance/attendanceApi';
import { usersApi } from '@/features/users/usersApi';
import { notificationsApi } from '@/features/notifications/notificationsApi';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

const INSTITUTION_NAME = 'University of Energy and Natural Resources';
const LOGO_IMAGE = '/assets/images/uenrLogo.png';

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

export const MyAssignmentsPage = () => {
  const { user } = useAuth();
  const isDemoUser = user?.isDemo === true;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [delegateModalOpen, setDelegateModalOpen] = useState(false);

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

  const isLoading = assignmentsQuery.isLoading;

  const handleExportPdf = () => {
    window.print();
  };

  // Mark today's duties as seen when visiting the page
  useEffect(() => {
    const today = new Date().toDateString();
    localStorage.setItem('invigilator-last-seen-duties', today);
    qc.invalidateQueries({ queryKey: ['venue-assignments', 'today-count'] });
  }, [qc]);

  // Delegate mutation: create invigilator + send notification to exam officer
  const delegateMutation = useMutation({
    mutationFn: async ({ delegateData, reason }) => {
      const newInvigilator = await usersApi.createDelegate({
        email: delegateData.email,
        fullName: delegateData.fullName,
        staffId: delegateData.staffId,
        phone: delegateData.phone,
        password: delegateData.password,
        createdById: user.id,
      });
      await notificationsApi.sendDelegateMessage({
        reason,
        delegateName: delegateData.fullName,
        delegateEmail: delegateData.email,
        originalInvigilator: user.fullName,
        originalInvigilatorStaffId: user.staffId,
      });
      return newInvigilator;
    },
    onSuccess: () => {
      toast.success('Delegate invigilator created. A message has been sent to the exam officer.');
      setDelegateModalOpen(false);
      qc.invalidateQueries({ queryKey: ['myVenueAssignments'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to create delegate.');
    },
  });

  return (
    <>
      {/* Print-only layout — hidden on screen, visible only when printing */}
      <div className="print-only">
        <PrintLayout assignments={assignments} user={user} sortedDates={sortedDates} grouped={grouped} />
      </div>

      {/* Screen layout — hidden when printing */}
      <div className="no-print">
        <PageHeader
          title="Invigilation Schedule"
          description="Your assigned examination venues, dates, and times."
          actions={(
            <div className="flex items-center gap-2">
              <button className="btn-primary" onClick={() => setDelegateModalOpen(true)}>
                <UserPlus className="w-4 h-4" />
                Delegate
              </button>
              {assignments.length > 0 && (
                <button className="btn-secondary" onClick={handleExportPdf}>
                  <Download className="w-4 h-4" />
                  Export PDF
                </button>
              )}
            </div>
          )}
        />

        {isLoading ? (
          <SkeletonCardGrid count={4} lines={3} label="Loading your assignments…" />
        ) : assignments.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No invigilation duties assigned"
            description="You have not been assigned to any examination venues. Once the exam officer assigns you, your schedule will appear here."
          />
        ) : (
          <>
            {/* Stats summary */}
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
                        {isToday ? 'Today' : formatDate(dateKey)}
                      </h3>
                      <span className="text-xs text-ink-400">
                        {dayAssignments.length} slot{dayAssignments.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {dayAssignments.map((a) => {
                        const scanned = isScanned(a.id);
                        const slotLabel = getTimeSlot(a.slotAt);
                        const courseList = a.courses || [];

                        return (
                          <div
                            key={a.id}
                            className={`card p-4 flex flex-col sm:flex-row sm:items-center gap-3 transition-all ${
                              scanned ? 'border-emerald-300 bg-emerald-50/30' : ''
                            } ${isToday && !scanned ? 'ring-1 ring-primary-200' : ''}`}
                          >
                            <div className="flex items-center gap-2 sm:w-40 shrink-0">
                              <Clock className="w-4 h-4 text-ink-400 shrink-0" />
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-ink-900">{slotLabel}</div>
                                <div className="text-xs text-ink-400">3 hrs</div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 sm:w-44 shrink-0 min-w-0">
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
                                    <div key={c.id} className="flex items-center gap-1.5 text-sm text-ink-700">
                                      <BookOpen className="w-3.5 h-3.5 text-ink-400 shrink-0" />
                                      <span className="font-medium">{c.code}</span>
                                      <span className="text-ink-500 truncate">— {c.title}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-sm text-ink-400 italic">No course assigned</div>
                              )}
                            </div>

                            <div className="shrink-0 flex items-center gap-2">
                              {scanned ? (
                                <Badge variant="success">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Checked In
                                </Badge>
                              ) : isPast ? (
                                <Badge variant="neutral">Missed</Badge>
                              ) : (
                                <Badge variant="info">Pending</Badge>
                              )}
                              {!scanned && !isPast && (
                                <button
                                  className="btn-primary btn-sm"
                                  onClick={() => navigate('/scan', {
                                    state: {
                                      fromAssignment: {
                                        ...a,
                                        examDurationMinutes: 180,
                                        isDemo: isDemoUser,
                                      },
                                    },
                                  })}
                                >
                                  <ScanLine className="w-3.5 h-3.5" />
                                  Scan
                                </button>
                              )}
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
      </div>

      {/* Delegate modal */}
      <DelegateModal
        open={delegateModalOpen}
        onClose={() => setDelegateModalOpen(false)}
        onSubmit={(data) => delegateMutation.mutate(data)}
        isPending={delegateMutation.isPending}
        user={user}
      />
    </>
  );
};

// ---------- Print Layout Component ----------
const PrintLayout = ({ assignments, user, sortedDates, grouped }) => {
  if (assignments.length === 0) return null;

  return (
    <div className="print-container">
      {/* Header */}
      <div className="print-header">
        <img src={LOGO_IMAGE} alt="UENR Logo" className="print-logo" />
        <div className="print-header-text">
          <h1>{INSTITUTION_NAME}</h1>
          <h2>Invigilation Schedule</h2>
        </div>
      </div>

      {/* Invigilator info */}
      <div className="print-info">
        <div><strong>Name:</strong> {user?.fullName || '—'}</div>
        <div><strong>Staff ID:</strong> {user?.staffId || '—'}</div>
        <div><strong>Generated:</strong> {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>

      <hr className="print-divider" />

      {/* Timetable table */}
      <table className="print-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Time Slot</th>
            <th>Venue</th>
            <th>Location</th>
            <th>Course(s)</th>
          </tr>
        </thead>
        <tbody>
          {sortedDates.map((dateKey) => {
            const dayAssignments = grouped[dateKey];
            return dayAssignments.map((a, idx) => {
              const courseList = a.courses || [];
              return (
                <tr key={a.id}>
                  {idx === 0 ? (
                    <td rowSpan={dayAssignments.length} className="print-date-cell">
                      {formatDateLong(dateKey)}
                    </td>
                  ) : null}
                  <td>{getTimeSlot(a.slotAt)}</td>
                  <td>{a.venue?.name || '—'}</td>
                  <td>{a.venue?.location || '—'}</td>
                  <td>
                    {courseList.length > 0
                      ? courseList.map((c) => `${c.code} — ${c.title}`).join('; ')
                      : '—'}
                  </td>
                </tr>
              );
            });
          })}
        </tbody>
      </table>

      {/* Footer */}
      <div className="print-footer">
        <p>This is an official invigilation schedule generated by the Examination Management System.</p>
        <p>{INSTITUTION_NAME}</p>
      </div>
    </div>
  );
};

// ---------- Delegate Tab ----------
const DelegateTab = ({ assignments, onOpenModal }) => {
  const upcoming = assignments.filter((a) => new Date(a.slotAt) >= new Date(new Date().toDateString()));

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 grid place-items-center shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-ink-900">Unable to attend?</h3>
            <p className="text-sm text-ink-600 mt-1">
              If you cannot attend an invigilation duty, you can create a delegate invigilator
              to take your place. A message will be sent to the exam officer notifying them of
              the change and your reason. The delegate can sign in immediately — exam officer
              approval is not required for the account to be created.
            </p>
          </div>
        </div>
      </div>

      {upcoming.length > 0 && (
        <div className="panel p-4">
          <h3 className="text-sm font-bold text-ink-900 mb-3">Upcoming Assignments</h3>
          <div className="space-y-2">
            {upcoming.map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface-subtle border border-surface-divider">
                <Clock className="w-4 h-4 text-ink-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink-900">
                    {formatDate(a.slotAt)} · {getTimeSlot(a.slotAt)}
                  </div>
                  <div className="text-xs text-ink-500">{a.venue?.name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button className="btn-primary w-full" onClick={onOpenModal}>
        <UserPlus className="w-4 h-4" />
        Create Delegate Invigilator
      </button>
    </div>
  );
};

// ---------- Delegate Modal ----------
const DelegateModal = ({ open, onClose, onSubmit, isPending, user }) => {
  const [form, setForm] = useState({
    fullName: '', email: '', staffId: '', phone: '', password: '',
  });
  const [reason, setReason] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.fullName || !form.email || !form.password || !reason) {
      toast.error('Please fill in all required fields.');
      return;
    }
    onSubmit({ delegateData: form, reason });
  };

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  return (
    <Modal open={open} onClose={onClose} title="Create Delegate Invigilator" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            A new invigilator account will be created and a notification sent to the exam officer.
            The delegate can sign in immediately. You are responsible for communicating the
            schedule details to your delegate.
          </span>
        </div>

        <div className="form-grid">
          <div>
            <label className="label">Full Name *</label>
            <input className="input" value={form.fullName} onChange={set('fullName')} placeholder="e.g. John Doe" required />
          </div>
          <div>
            <label className="label">Email *</label>
            <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="e.g. john@uenr.edu.gh" required />
          </div>
          <div>
            <label className="label">Staff ID</label>
            <input className="input" value={form.staffId} onChange={set('staffId')} placeholder="e.g. UENR/1234" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={set('phone')} placeholder="e.g. 024 123 4567" />
          </div>
        </div>

        <div>
          <label className="label">Password *</label>
          <div className="relative">
            <input
              className="input pr-20"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={set('password')}
              placeholder="Min 8 chars, 1 uppercase, 1 symbol"
              required
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-primary-700 font-bold"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div>
          <label className="label">Reason for delegation *</label>
          <textarea
            className="textarea min-h-[80px]"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why you are unable to attend and need a delegate..."
            required
          />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={isPending}>
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Create & Notify
          </button>
        </div>
      </form>
    </Modal>
  );
};
