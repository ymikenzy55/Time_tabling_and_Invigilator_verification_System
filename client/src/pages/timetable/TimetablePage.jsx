import { useMemo, useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  Loader2, CalendarRange, AlertCircle, CheckCircle2, Clock, ShieldAlert,
  FileDown, MapPin, User, Building, QrCode, Users, Pencil, Trash2, X, Upload,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonTimetable } from '@/components/ui/Skeleton';
import { ImportPreviewModal } from '@/components/ui/ImportPreviewModal';
import { useAuth } from '@/context/AuthContext';
import { examinationSessionsApi } from '@/features/examinations/examinationSessionsApi';
import { departmentsApi } from '@/features/academics/departmentsApi';
import { semestersApi } from '@/features/academics/semestersApi';
import { venuesApi } from '@/features/venues/venuesApi';
import { timetableApi } from '@/features/timetable/timetableApi';
import { venueAssignmentsApi } from '@/features/venueAssignments/venueAssignmentsApi';
import { attendanceApi } from '@/features/attendance/attendanceApi';
import { coursesApi } from '@/features/courses/coursesApi';
import { parseSpreadsheet, rowsToCourses } from '@/utils/fileImport';

const PERIODS = [
  { hour: 8, label: '8:00 AM – 11:00 AM' },
  { hour: 11, label: '11:00 AM – 2:00 PM' },
  { hour: 14, label: '2:00 PM – 5:00 PM' },
];

const INSTITUTION_NAME = 'University of Energy and Natural Resources';
const LOGO_IMAGE = '/assets/images/uenrLogo.png';

const generateSchema = z.object({
  semesterId: z.string().min(1, 'Semester is required.'),
  startDate: z.string().min(1, 'Start date is required.'),
  durationWeeks: z.coerce.number().int().min(1, 'At least 1 week required.').max(10, 'Maximum 10 weeks.'),
  skipWeekends: z.boolean().default(true),
  assignInvigilators: z.boolean().default(false),
});

const isWeekendDate = (dateStr) => {
  if (!dateStr) return false;
  const day = new Date(dateStr).getDay();
  return day === 0 || day === 6;
};

const editSchema = z.object({
  venueId: z.string().min(1, 'Venue is required.'),
  scheduledAt: z.string().min(1, 'Date and time is required.'),
});

const dateKey = (d) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const formatDay = (d) => new Date(d).toLocaleDateString(undefined, {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

const periodIndex = (scheduledAt) => {
  const h = new Date(scheduledAt).getHours();
  if (h < 10) return 0;
  if (h < 13) return 1;
  return 2;
};

export const TimetablePage = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN';

  const [sessionId, setSessionId] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterVenue, setFilterVenue] = useState('');
  const [sortBy, setSortBy] = useState('date'); // date | venue | time
  const [generateOpen, setGenerateOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [venueQrData, setVenueQrData] = useState(null);
  const [venueQrLoading, setVenueQrLoading] = useState(null);
  const [editEntry, setEditEntry] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // null = whole timetable, entry object = single entry
  const courseFileRef = useRef(null);
  const [importingCourses, setImportingCourses] = useState(false);
  const [coursePreview, setCoursePreview] = useState(null);

  const location = useLocation();
  const pendingGenerate = useRef(false);

  useEffect(() => {
    if (location.state?.generate && isAdmin) {
      pendingGenerate.current = true;
    }
  }, [location.state, isAdmin]);

  // Single round-trip that fetches sessions + default session entries + readiness.
  // This eliminates the sessions → setSessionId → entries waterfall.
  const initialQuery = useQuery({
    queryKey: ['timetable', 'initial'],
    queryFn: () => timetableApi.initialData(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // Seed sessionId from the initial response as soon as it arrives.
  useEffect(() => {
    if (!sessionId && initialQuery.data?.defaultSessionId) {
      setSessionId(initialQuery.data.defaultSessionId);
    }
  }, [sessionId, initialQuery.data]);

  // Sessions — uses initialData as placeholder so it renders instantly.
  const sessionsQuery = useQuery({
    queryKey: ['examinationSessions'],
    queryFn: () => examinationSessionsApi.list(),
    initialData: initialQuery.data?.sessions,
    enabled: !!initialQuery.data,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const semestersQuery = useQuery({
    queryKey: ['semesters'],
    queryFn: () => semestersApi.list(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const departmentsQuery = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list(),
    enabled: isAdmin,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

  const venuesQuery = useQuery({
    queryKey: ['venues'],
    queryFn: () => venuesApi.list(),
    enabled: isAdmin,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

  // Entries — uses initialData for the default session so it shows instantly.
  const entriesQuery = useQuery({
    queryKey: ['timetable', 'entries', sessionId],
    queryFn: () => timetableApi.list({ examinationSessionId: sessionId }),
    enabled: !!sessionId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
    initialData: initialQuery.data?.defaultSessionId && initialQuery.data.defaultSessionId === sessionId
      ? initialQuery.data.entries
      : undefined,
  });

  const readinessQuery = useQuery({
    queryKey: ['timetable', 'readiness', sessionId],
    queryFn: () => timetableApi.readiness(sessionId),
    enabled: isAdmin && !!sessionId,
    initialData: initialQuery.data?.defaultSessionId && initialQuery.data.defaultSessionId === sessionId
      ? initialQuery.data.readiness
      : undefined,
    refetchInterval: 30_000,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const readiness = readinessQuery.data;
  const isReady = !!readiness?.ready;

  const generateMutation = useMutation({
    mutationFn: timetableApi.generate,
    onSuccess: (data) => {
      toast.success(`Timetable generated: ${data.created}/${data.total} courses scheduled.`);
      qc.invalidateQueries({ queryKey: ['timetable'] });
      qc.invalidateQueries({ queryKey: ['invigilations'] });
      setResult(data);
      setGenerateOpen(false);
      // If user chose to assign invigilators during generation, do it now
      if (generateAssignInvigilators && hasInvigilators) {
        assignMutation.mutate(sessionId);
      }
      setGenerateAssignInvigilators(false);
    },
    onError: (err) => toast.error(err.message || 'Failed to generate timetable.'),
  });

  const [generateAssignInvigilators, setGenerateAssignInvigilators] = useState(false);

  const invigilatorCountQuery = useQuery({
    queryKey: ['venue-assignments', 'invigilator-count'],
    queryFn: () => venueAssignmentsApi.invigilatorCount(),
    enabled: isAdmin,
    staleTime: 60_000,
  });

  const hasInvigilators = (invigilatorCountQuery.data || 0) > 0;

  const assignMutation = useMutation({
    mutationFn: (sid) => venueAssignmentsApi.assign(sid),
    onSuccess: (data) => {
      toast.success(`Invigilators assigned: ${data.assigned} assignments across ${data.invigilators} invigilators.`);
      qc.invalidateQueries({ queryKey: ['venue-assignments'] });
    },
    onError: (err) => toast.error(err.message || 'Failed to assign invigilators.'),
  });

  const updateEntryMutation = useMutation({
    mutationFn: ({ entryId, payload }) => timetableApi.updateEntry(entryId, payload),
    onSuccess: () => {
      toast.success('Entry updated successfully.');
      qc.invalidateQueries({ queryKey: ['timetable'] });
      setEditEntry(null);
    },
    onError: (err) => toast.error(err.message || 'Failed to update entry.'),
  });

  const deleteEntryMutation = useMutation({
    mutationFn: (entryId) => timetableApi.deleteEntry(entryId),
    onSuccess: () => {
      toast.success('Entry deleted.');
      qc.invalidateQueries({ queryKey: ['timetable'] });
      setDeleteConfirm(false);
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(err.message || 'Failed to delete entry.'),
  });

  const deleteTimetableMutation = useMutation({
    mutationFn: (sid) => timetableApi.deleteTimetable(sid),
    onSuccess: (data) => {
      toast.success(`Timetable deleted: ${data.deleted} entries removed.`);
      qc.invalidateQueries({ queryKey: ['timetable'] });
      qc.invalidateQueries({ queryKey: ['venue-assignments'] });
      setDeleteConfirm(false);
      setDeleteTarget(null);
      setResult(null);
    },
    onError: (err) => toast.error(err.message || 'Failed to delete timetable.'),
  });

  const generateVenueQr = async (venueId) => {
    if (!sessionId || !venueId) return;
    setVenueQrLoading(venueId);
    try {
      const data = await attendanceApi.generateVenueQr(venueId, sessionId);
      // Pre-generate QR image so modal opens instantly
      const dataUrl = await QRCode.toDataURL(data.link, { width: 280, margin: 2 });
      setVenueQrData({ ...data, _dataUrl: dataUrl });
    } catch (err) {
      toast.error(err.message || 'Failed to generate venue QR code.');
    } finally {
      setVenueQrLoading(null);
    }
  };

  const {
    register: registerGen, handleSubmit: handleGenSubmit, reset: resetGen,
    watch: watchGen, setValue: setGenValue,
    formState: { errors: genErrors },
  } = useForm({
    resolver: zodResolver(generateSchema),
    defaultValues: { semesterId: '', startDate: '', durationWeeks: 3, skipWeekends: true, assignInvigilators: false },
  });

  const watchSemesterId = watchGen('semesterId');
  const watchStartDate = watchGen('startDate');
  const watchDurationWeeks = watchGen('durationWeeks');
  const watchSkipWeekends = watchGen('skipWeekends');

  // Auto-fill start date when semester changes
  useEffect(() => {
    if (!watchSemesterId || !semestersQuery.data) return;
    const sem = semestersQuery.data.find((s) => s.id === watchSemesterId);
    if (sem) {
      // Find first non-weekend day from semester start
      let sd = new Date(sem.startDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (sd < today) sd = today;
      // Skip to next weekday if weekend
      while (sd.getDay() === 0 || sd.getDay() === 6) {
        sd.setDate(sd.getDate() + 1);
      }
      setGenValue('startDate', dateKey(sd));
    }
  }, [watchSemesterId, semestersQuery.data, setGenValue]);

  const openGenerate = () => {
    if (!sessionId) {
      toast.error('Select an examination session first.');
      return;
    }
    // Pre-fill semester from the selected session
    const session = sessions.find((s) => s.id === sessionId);
    const semId = session?.semester?.id || '';
    resetGen({
      semesterId: semId,
      startDate: '',
      durationWeeks: 3,
      skipWeekends: true,
      assignInvigilators: false,
    });
    setGenerateOpen(true);
  };

  // Auto-select fallback: if initialData didn't set sessionId, use sessions list.
  useEffect(() => {
    if (!sessionId && sessionsQuery.data?.length) {
      setSessionId(sessionsQuery.data[0].id);
    }
  }, [sessionId, sessionsQuery.data]);

  // Auto-open generate modal when navigated with location.state.generate
  useEffect(() => {
    if (!pendingGenerate.current || !isAdmin) return;
    if (sessionsQuery.isLoading || !sessionsQuery.data?.length) return;
    if (!sessionId) return;
    openGenerate();
    pendingGenerate.current = false;
  }, [isAdmin, sessionId, sessionsQuery.isLoading, sessionsQuery.data]);

  const sessions = sessionsQuery.data || [];
  const allEntries = entriesQuery.data || [];

  const handleCourseImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const session = sessions.find((s) => s.id === sessionId);
    const semesterId = session?.semester?.id;
    if (!semesterId) {
      toast.error('Select an examination session first.');
      return;
    }
    setImportingCourses(true);
    try {
      const rows = await parseSpreadsheet(file);
      const courses = rowsToCourses(rows);
      if (courses.length === 0) {
        toast.error('No valid course rows found. Ensure columns: code, title, department, level, etc.');
        return;
      }
      setCoursePreview({ courses, semesterId });
    } catch (err) {
      toast.error(err.message || 'Failed to parse file.');
    } finally {
      setImportingCourses(false);
      if (courseFileRef.current) courseFileRef.current.value = '';
    }
  };

  const confirmCourseImport = async () => {
    if (!coursePreview) return;
    setImportingCourses(true);
    try {
      const result = await coursesApi.bulkImport({ semesterId: coursePreview.semesterId, courses: coursePreview.courses });
      toast.success(`Imported ${result.created} course(s)${result.skipped > 0 ? `, skipped ${result.skipped} duplicate(s)` : ''}.`);
      qc.invalidateQueries({ queryKey: ['courses'] });
      qc.invalidateQueries({ queryKey: ['timetable'] });
      setCoursePreview(null);
    } catch (err) {
      toast.error(err.message || 'Failed to import courses.');
    } finally {
      setImportingCourses(false);
    }
  };

  const onGenerate = (values) => {
    const { assignInvigilators: assignNow, durationWeeks, ...rest } = values;
    // Compute endDate from startDate + durationWeeks
    const start = new Date(rest.startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + (durationWeeks * 7) - 1);
    const options = { ...rest, endDate: dateKey(end) };
    setGenerateAssignInvigilators(assignNow);
    generateMutation.mutate({ examinationSessionId: sessionId, options });
  };

  // Apply department, venue filter and sort — all client-side for instant results
  const applyFilters = (raw) => {
    let filtered = raw;
    if (filterDept) {
      filtered = filtered.filter((e) => e.course?.department?.id === filterDept);
    }
    if (filterVenue) {
      filtered = filtered.filter((e) => e.venue?.id === filterVenue);
    }
    if (sortBy === 'venue') {
      return [...filtered].sort((a, b) => (a.venue?.name || '').localeCompare(b.venue?.name || '') || new Date(a.scheduledAt) - new Date(b.scheduledAt));
    }
    if (sortBy === 'time') {
      return [...filtered].sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt) || (a.venue?.name || '').localeCompare(b.venue?.name || ''));
    }
    if (sortBy === 'department') {
      return [...filtered].sort((a, b) => (a.course?.department?.name || '').localeCompare(b.course?.department?.name || '') || new Date(a.scheduledAt) - new Date(b.scheduledAt));
    }
    return filtered; // default: date order (already sorted by backend)
  };

  const entries = useMemo(() => applyFilters(allEntries), [allEntries, filterDept, filterVenue, sortBy]);

  // Detect clashes: same dept+level in the same slot (day+period)
  const clashes = useMemo(() => {
    const clashSet = new Set();
    const slotMap = new Map(); // slotKey -> Map(deptLevelKey -> count)
    for (const entry of entries) {
      const slotKey = `${dateKey(entry.scheduledAt)}-${periodIndex(entry.scheduledAt)}`;
      const deptLevelKey = `${entry.course?.department?.id}:${entry.course?.level}`;
      if (!slotMap.has(slotKey)) slotMap.set(slotKey, new Map());
      const deptMap = slotMap.get(slotKey);
      deptMap.set(deptLevelKey, (deptMap.get(deptLevelKey) || 0) + 1);
      if (deptMap.get(deptLevelKey) > 1) {
        clashSet.add(entry.id);
      }
    }
    return clashSet;
  }, [entries]);

  const hasClashes = clashes.size > 0;

  // Group entries into a day x period grid.
  const grid = useMemo(() => {
    const days = new Map();
    for (const entry of entries) {
      const key = dateKey(entry.scheduledAt);
      if (!days.has(key)) days.set(key, { date: entry.scheduledAt, periods: [[], [], []] });
      days.get(key).periods[periodIndex(entry.scheduledAt)].push(entry);
    }
    return [...days.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({ key, ...value }));
  }, [entries]);

  // Group entries by department → level, then build a day×period grid per dept+level.
  const buildDeptGrids = (rawEntries) => {
    const byDept = new Map();
    for (const entry of rawEntries) {
      const deptId = entry.course?.department?.id || 'unknown';
      const deptName = entry.course?.department?.name || 'Unassigned';
      const level = entry.course?.level || 0;
      if (!byDept.has(deptId)) byDept.set(deptId, { deptId, deptName, levels: new Map() });
      const dept = byDept.get(deptId);
      if (!dept.levels.has(level)) dept.levels.set(level, { level, entries: [] });
      dept.levels.get(level).entries.push(entry);
    }
    return [...byDept.entries()]
      .sort(([, a], [, b]) => a.deptName.localeCompare(b.deptName))
      .map(([id, val]) => ({
        id,
        deptName: val.deptName,
        levels: [...val.levels.entries()]
          .sort(([a], [b]) => a - b)
          .map(([level, lv]) => {
            const days = new Map();
            for (const entry of lv.entries) {
              const key = dateKey(entry.scheduledAt);
              if (!days.has(key)) days.set(key, { date: entry.scheduledAt, periods: [[], [], []] });
              days.get(key).periods[periodIndex(entry.scheduledAt)].push(entry);
            }
            return {
              level,
              days: [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({ key, ...value })),
            };
          }),
      }));
  };

  const deptGrids = useMemo(() => buildDeptGrids(entries), [entries]);

  const exportPdf = async () => {
    if (!grid.length) {
      toast.error('Nothing to export yet.');
      return;
    }

    // If entries are being fetched (e.g. right after generation), wait for
    // the fresh data before building the PDF to avoid exporting stale data.
    let freshEntries = entries;
    if (entriesQuery.isFetching) {
      toast.loading('Updating timetable data…', { id: 'pdf-export' });
      const result = await entriesQuery.refetch();
      toast.success('Data updated. Opening PDF…', { id: 'pdf-export' });
      freshEntries = applyFilters(result.data || []);
    }
    const session = sessions.find((s) => s.id === sessionId);
    const semName = session?.semester?.name || '';
    const ayName = session?.semester?.academicYear?.name || '';
    const sessionName = session?.name || '';

    // Build clash count map for PDF highlighting
    const clashCountMap = new Map();
    for (const entry of freshEntries) {
      const slotKey = `${dateKey(entry.scheduledAt)}-${periodIndex(entry.scheduledAt)}`;
      const deptLevelKey = `${entry.course?.department?.id}:${entry.course?.level}`;
      const key = `${slotKey}:${deptLevelKey}`;
      clashCountMap.set(key, (clashCountMap.get(key) || 0) + 1);
    }

    // --- Build the flat day-grouped structure used by the official layout ---
    // Merge entries with the same course code + title in the same slot into a
    // single row (shared courses sit at the same time in different venues).
    const classLabel = (e) => {
      const dept = e.course?.department;
      const deptTag = (dept?.code || dept?.name || '').toUpperCase();
      return `L${e.course?.level ?? ''} ${deptTag}`.trim();
    };

    const mergedRows = new Map(); // key: date|period|code|title -> row
    for (const e of freshEntries) {
      const code = (e.course?.code || '').trim().toUpperCase();
      const title = (e.course?.title || '').trim();
      const dk = dateKey(e.scheduledAt);
      const pi = periodIndex(e.scheduledAt);
      const key = `${dk}|${pi}|${code}|${title.toUpperCase()}`;

      const deptLevelKey = `${e.course?.department?.id}:${e.course?.level}`;
      const slotKey = `${dk}-${pi}`;
      const isClashing = clashCountMap.get(`${slotKey}:${deptLevelKey}`) > 1;

      if (!mergedRows.has(key)) {
        mergedRows.set(key, {
          dateKey: dk,
          period: pi,
          scheduledAt: e.scheduledAt,
          code,
          title,
          classes: [],
          students: 0,
          examiners: new Set(),
          venues: new Set(),
          clash: false,
        });
      }
      const row = mergedRows.get(key);
      const cls = classLabel(e);
      if (cls && !row.classes.includes(cls)) row.classes.push(cls);
      row.students += e.course?.studentCount || 0;
      if (e.course?.instructorName) row.examiners.add(e.course.instructorName);
      if (e.venue?.name) row.venues.add(e.venue.name);
      if (isClashing) row.clash = true;
    }

    // Group merged rows by day.
    const dayGroups = new Map(); // dateKey -> { date, rows: [] }
    for (const row of mergedRows.values()) {
      if (!dayGroups.has(row.dateKey)) dayGroups.set(row.dateKey, { date: row.scheduledAt, rows: [] });
      dayGroups.get(row.dateKey).rows.push(row);
    }
    const sortedDays = [...dayGroups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({
        key,
        date: val.date,
        rows: val.rows.sort((a, b) => a.period - b.period || a.code.localeCompare(b.code)),
      }));

    // Exam period range for the sub-header.
    const allDates = sortedDays.map((d) => new Date(d.date));
    const rangeStart = allDates[0];
    const rangeEnd = allDates[allDates.length - 1];
    const fmtLong = (d) => {
      const day = d.getDate();
      const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th';
      const month = d.toLocaleDateString('en-US', { month: 'long' }).toUpperCase();
      const weekday = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
      return `${weekday}, ${day}${suffix} ${month}, ${d.getFullYear()}`;
    };
    const fmtShort = (d) => {
      const dt = new Date(d);
      return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
    };

    const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Render body rows: for each day — a day-name row, then one row per course.
    const bodyRows = sortedDays.map((day) => {
      const dayName = new Date(day.date).toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();

      const courseRows = day.rows.map((row, idx) => {
        const clashStyle = row.clash ? ' style="background:#fee2e1;"' : '';
        const dateCell = idx === Math.max(0, Math.floor((day.rows.length - 1) / 2))
          ? `<td class="date-cell date-value">${fmtShort(day.date)}</td>`
          : '<td class="date-cell"></td>';
        const timeLabel = PERIODS[row.period]?.label?.split('–')[0]?.trim() || '';
        return `<tr${clashStyle}>
          ${dateCell}
          <td class="code-cell">${esc(row.code)}<div class="time-tag">${esc(timeLabel)}</div></td>
          <td class="title-cell">${esc(row.title)}${row.clash ? ' <span class="clash-tag">&#9888; CLASH</span>' : ''}</td>
          <td class="class-cell">${esc(row.classes.join(', '))}</td>
          <td class="stds-cell">${row.students || ''}</td>
          <td class="examiner-cell">${esc([...row.examiners].join(', '))}</td>
          <td class="venue-cell">${esc([...row.venues].join(', '))}</td>
        </tr>`;
      }).join('');

      // Day header row (7 columns: date + 6 others)
      const dayHeader = `<tr class="day-row">
        <td class="date-cell day-name">${dayName}</td>
        <td></td><td></td><td></td><td></td><td></td><td></td>
      </tr>`;

      return dayHeader + courseRows;
    }).join('');

    const semLabel = (semName || '').toUpperCase();
    const html = `<!doctype html><html><head><title>Examination Timetable</title><style>
      @page { size: A4 landscape; margin: 1cm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: 'Times New Roman', 'Cambria', serif;
        color: #000;
        background: #fff;
      }
      .document { width: 100%; border: 2pt solid #000; }
      .head-block { border-bottom: 1.5pt solid #000; text-align: center; padding: 0.12cm 0.2cm; }
      .head-block.institution { font-size: 16pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.03em; }
      .head-block.doc-title { font-size: 11.5pt; font-weight: bold; }
      .head-block.doc-title .provisional { color: #c00; }
      .head-block.doc-title .highlight { color: #c00; }
      .head-block.date-range { font-size: 11pt; font-weight: bold; }
      .main-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      .main-table thead { display: table-header-group; }
      .main-table th {
        border: 1pt solid #000; padding: 0.08cm 0.06cm;
        font-size: 8.5pt; font-weight: bold; text-align: center;
      }
      .main-table td {
        border: 1pt solid #000; padding: 0.07cm 0.08cm;
        font-size: 8.5pt; vertical-align: middle; word-wrap: break-word;
      }
      .main-table .day-row td { border-bottom: none; height: 0.42cm; }
      .main-table .day-name { font-weight: bold; font-size: 9pt; }
      .main-table .date-cell { text-align: left; font-weight: bold; }
      .main-table .date-value { font-weight: bold; }
      .main-table .code-cell { font-weight: bold; text-align: left; }
      .main-table .code-cell .time-tag { font-weight: normal; font-size: 7pt; color: #444; }
      .main-table .title-cell { font-weight: bold; text-align: left; }
      .main-table .class-cell { font-weight: bold; text-align: center; }
      .main-table .stds-cell { text-align: center; font-weight: bold; }
      .main-table .examiner-cell { text-align: center; }
      .main-table .venue-cell { text-align: center; font-weight: bold; }
      .clash-tag { color: #c00; font-size: 7pt; font-weight: bold; }
      .main-table tbody tr { page-break-inside: avoid; }
      @media print {
        @page { size: A4 landscape; }
        html, body { width: 100%; height: auto; }
        .main-table thead { display: table-header-group; }
        .main-table tbody tr { page-break-inside: avoid; }
      }
    </style></head><body>
      <div class="document">
        <div class="head-block institution">${INSTITUTION_NAME}, SUNYANI</div>
        <div class="head-block doc-title">
          <span class="provisional">PROVISIONAL</span> TIMETABLE FOR
          <span class="highlight">END OF ${esc(semLabel)}</span> EXAMINATIONS${ayName ? `, ${esc(ayName)} ACADEMIC YEAR` : ''}
        </div>
        ${rangeStart && rangeEnd ? `<div class="head-block date-range">${fmtLong(rangeStart)} &nbsp;-&nbsp; ${fmtLong(rangeEnd)}</div>` : ''}
        ${sessionName ? `<div class="head-block date-range" style="font-size:9.5pt;">${esc(sessionName)}</div>` : ''}
        <table class="main-table">
          <colgroup>
            <col style="width:11%" />
            <col style="width:10%" />
            <col style="width:29%" />
            <col style="width:13%" />
            <col style="width:6%" />
            <col style="width:15%" />
            <col style="width:16%" />
          </colgroup>
          <thead>
            <tr>
              <th>DATE/ TIME</th>
              <th>CODE</th>
              <th>COURSE CODE/ TITLE</th>
              <th>CLASS</th>
              <th>STDS</th>
              <th>EXAMINER</th>
              <th>VENUE</th>
            </tr>
          </thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
    </body></html>`;

    // Use a hidden iframe for printing — avoids pop-up blockers, Blob URL
    // corruption issues, and cross-origin restrictions. The iframe is
    // same-origin so the browser can reliably render and save as PDF.
    const iframe = document.createElement('iframe');
    // Give the iframe real A4 portrait dimensions so the browser's print
    // engine doesn't auto-rotate to landscape. Visually hidden but sized.
    iframe.style.cssText = 'position:fixed;right:-9999px;top:0;width:297mm;height:210mm;border:0;opacity:0;pointer-events:none;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    const cleanup = () => {
      setTimeout(() => {
        if (iframe.parentNode) document.body.removeChild(iframe);
      }, 1000);
    };

    const triggerPrint = () => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch {
        toast.error('Failed to open print dialog.');
      }
      cleanup();
    };

    // Wait for the logo image to load, then print.
    const img = doc.querySelector('img');
    if (img && !img.complete) {
      img.onload = () => setTimeout(triggerPrint, 200);
      img.onerror = () => setTimeout(triggerPrint, 200);
    } else {
      setTimeout(triggerPrint, 300);
    }
  };

  return (
    <>
      <PageHeader
        title="Examination Timetable"
        description="View, filter, and export the generated examination timetable."
        actions={(
          <div className="flex items-center gap-2">
            <button className="btn-secondary" onClick={exportPdf} disabled={!grid.length || entriesQuery.isFetching}>
              <FileDown className="w-4 h-4" /> Export PDF
            </button>
            {isAdmin && (
              <>
                <button className="btn-secondary" onClick={() => courseFileRef.current?.click()} disabled={importingCourses}>
                  {importingCourses ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Import Courses
                </button>
                <input ref={courseFileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleCourseImport} />
              </>
            )}
            {isAdmin && hasInvigilators && grid.length > 0 && (
              <button
                className="btn-secondary"
                onClick={() => assignMutation.mutate(sessionId)}
                disabled={assignMutation.isPending}
              >
                {assignMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                Assign Invigilators
              </button>
            )}
            {isAdmin && grid.length > 0 && (
              <button
                className="btn-primary"
                onClick={openGenerate}
              >
                <CalendarRange className="w-4 h-4" /> Regenerate Timetable
              </button>
            )}
            {isAdmin && grid.length > 0 && (
              <button
                className="btn-secondary text-rose-600 hover:text-rose-700"
                onClick={() => { setDeleteTarget(null); setDeleteConfirm(true); }}
              >
                <Trash2 className="w-4 h-4" /> Delete Timetable
              </button>
            )}
          </div>
        )}
      />

      {/* Filters */}
      <div className="panel p-4 mb-6 flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-72">
          <label className="label">Examination session</label>
          <select className="input" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.semester?.academicYear?.name} — {s.semester?.name})
              </option>
            ))}
          </select>
        </div>
        {isAdmin && (
          <div className="w-full sm:w-60">
            <label className="label">Department</label>
            <select className="input" value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
              <option value="">All departments</option>
              {(departmentsQuery.data || []).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}
        {isAdmin && (
          <div className="w-full sm:w-56">
            <label className="label">Venue</label>
            <select className="input" value={filterVenue} onChange={(e) => setFilterVenue(e.target.value)}>
              <option value="">All venues</option>
              {(venuesQuery.data || []).map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
        )}
        {isAdmin && (
          <div className="w-full sm:w-48">
            <label className="label">Sort by</label>
            <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="date">Date (default)</option>
              <option value="department">Department</option>
              <option value="venue">Venue</option>
              <option value="time">Time</option>
            </select>
          </div>
        )}
      </div>

      {/* Readiness banner (admin) */}
      {isAdmin && sessionId && readiness && !isReady && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2">
          {readiness.pending > 0 ? (
            <>
              <Clock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-900">
                <span className="font-bold">{readiness.pending}</span> course{readiness.pending === 1 ? '' : 's'} still awaiting approval — generation is locked until all are approved or rejected.
              </p>
            </>
          ) : readiness.venues < readiness.minVenues ? (
            <>
              <Building className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-900">
                Only <span className="font-bold">{readiness.venues}</span> active venue{readiness.venues === 1 ? '' : 's'} — at least {readiness.minVenues} are required. Add venues in the Venues tab.
              </p>
            </>
          ) : (
            <>
              <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-900">No approved courses in this session's semester yet.</p>
            </>
          )}
        </div>
      )}

      {/* Generation result summary */}
      {result && (
        <div className="panel p-5 mb-6 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-surface-subtle p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-ink-900">{result.total}</div>
              <div className="text-xs text-ink-500">Total courses</div>
            </div>
            <div className="bg-emerald-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-emerald-700">{result.created}</div>
              <div className="text-xs text-emerald-600">Scheduled</div>
            </div>
            <div className="bg-amber-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-amber-700">{result.unscheduled?.length || 0}</div>
              <div className="text-xs text-amber-600">Unscheduled</div>
            </div>
            <div className="bg-primary-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-primary-700">
                {result.total ? Math.round((result.created / result.total) * 100) : 0}%
              </div>
              <div className="text-xs text-primary-600">Coverage</div>
            </div>
          </div>

          {result.unscheduled?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-amber-800 font-medium text-sm mb-2">
                <AlertCircle className="w-4 h-4" /> Could not schedule
              </div>
              <ul className="list-disc list-inside text-xs text-amber-700 space-y-1">
                {result.unscheduled.map((c) => (
                  <li key={c.id}>{c.code} — {c.title} {c.reason ? `(${c.reason})` : ''}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end">
            <button type="button" className="btn-secondary" onClick={() => setResult(null)}>Dismiss</button>
          </div>
        </div>
      )}

      {/* Clash warning banner */}
      {hasClashes && grid.length > 0 && (
        <div className="mb-6 rounded-lg border-2 border-rose-500 bg-rose-50 px-4 py-3 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-rose-800">
              {clashes.size} clash{clashes.size === 1 ? '' : 'es'} detected — {clashes.size} course{clashes.size === 1 ? '' : 's'} share the same department and level in the same time slot.
            </p>
            <p className="text-xs text-rose-700 mt-0.5">
              Clashing entries are highlighted with a red border. Click <span className="font-bold">Regenerate Timetable</span> to reschedule.
            </p>
          </div>
        </div>
      )}

      {/* Timetable grid */}
      {!sessionId && initialQuery.isLoading ? (
        <SkeletonTimetable />
      ) : !sessionId ? (
        <div className="card">
          <EmptyState
            icon={CalendarRange}
            title="Select a session"
            description="Choose an examination session above to view its timetable."
          />
        </div>
      ) : entriesQuery.isLoading && !entriesQuery.data ? (
        <SkeletonTimetable />
      ) : grid.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={CalendarRange}
            title="No timetable yet"
            description={isAdmin
              ? 'Generate a timetable for this session using the button above.'
              : 'The examination timetable has not been generated yet.'}
          />
        </div>
      ) : (
        <div className="bg-white border border-slate-300 mx-auto print:border-none print:shadow-none" style={{ fontFamily: "'Times New Roman', Cambria, Calibri, serif", maxWidth: '27cm' }}>
          {/* Document header with logo */}
          <div className="text-center py-6 border-b-2 border-black">
            <img src={LOGO_IMAGE} alt="UENR" className="mx-auto mb-2" style={{ width: '70px', height: '70px', objectFit: 'contain' }} />
            <div className="text-[17pt] font-bold text-black leading-snug">{INSTITUTION_NAME}</div>
            <div className="text-[15pt] font-bold text-black uppercase tracking-wide mt-1">Examination Timetable</div>
            <div className="text-[12pt] text-black italic mt-0.5">
              {sessions.find((s) => s.id === sessionId)?.semester?.name || ''}
              {sessions.find((s) => s.id === sessionId)?.semester?.academicYear?.name ? ` — ${sessions.find((s) => s.id === sessionId)?.semester?.academicYear?.name}` : ''}
            </div>
          </div>

          {/* Department sections */}
          {deptGrids.map((dg) => (
            <div key={dg.id} className="mt-6 mb-8">
              {/* Department heading */}
              <div className="text-center border-t border-b border-black py-2">
                <div className="text-[13pt] font-bold text-black uppercase tracking-wider">{dg.deptName}</div>
              </div>

              {/* Level sections */}
              {dg.levels.map((lv) => (
                <div key={lv.level} className="mt-4 mb-5">
                  {/* Level heading */}
                  <div className="flex items-center gap-2 mb-2 pl-2">
                    <div className="border-l-[3px] border-black pl-2 text-[11pt] font-bold text-black uppercase tracking-wide">
                      Level {lv.level}
                    </div>
                  </div>

                  {/* Day × Period grid table */}
                  <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                    <thead>
                      <tr>
                        <th className="border border-black border-b-2 px-2 py-1.5 text-[10pt] font-bold text-black text-center" style={{ width: '16%' }}>Date</th>
                        {PERIODS.map((p) => (
                          <th key={p.hour} className="border border-black border-b-2 px-2 py-1.5 text-[10pt] font-bold text-black text-center">
                            {p.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lv.days.map((day) => {
                        const dayName = new Date(day.date).toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
                        const dateStr = new Date(day.date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
                        return (
                          <tr key={day.key} className="align-top">
                            <td className="border border-black px-2 py-1.5 text-[10pt] font-bold text-black text-center align-middle bg-slate-50">
                              {dayName}<br />{dateStr}
                            </td>
                            {day.periods.map((list, i) => (
                              <td key={i} className="border border-black px-1 py-1 align-top">
                                {list.length === 0 ? (
                                  <div className="text-center text-slate-400 text-[10pt]">—</div>
                                ) : (
                                  <table className="w-full border-collapse">
                                    <tbody>
                                      {list.map((entry) => {
                                        const isClashing = clashes.has(entry.id);
                                        return (
                                          <tr key={entry.id} className={`group relative border-b border-black last:border-b-0 ${isClashing ? 'bg-rose-50' : ''}`}>
                                            <td className={`px-1 py-1 text-[9pt] text-black ${isClashing ? 'border-l-[3px] border-l-rose-600' : ''}`}>
                                              <div className="font-bold">{entry.course?.code}</div>
                                              <div>{entry.course?.title}</div>
                                              <div className="font-bold text-black">{entry.course?.studentCount ?? 0} students</div>
                                              <div className="font-bold text-black">{entry.venue?.name || ''}</div>
                                              <div className="text-slate-600">{entry.course?.instructorName || ''}</div>
                                              {isClashing && (
                                                <div className="text-rose-600 font-bold text-[8pt] mt-0.5">⚠ CLASH</div>
                                              )}
                                              {isAdmin && (
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 mt-0.5 print:hidden">
                                                  <button
                                                    type="button"
                                                    className="p-0.5 hover:bg-slate-100 text-slate-500 hover:text-primary-700 rounded"
                                                    onClick={() => setEditEntry(entry)}
                                                    title="Edit entry"
                                                  >
                                                    <Pencil className="w-3 h-3" />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className="p-0.5 hover:bg-slate-100 text-slate-500 hover:text-rose-600 rounded"
                                                    onClick={() => { setDeleteTarget(entry); setDeleteConfirm(true); }}
                                                    title="Delete entry"
                                                  >
                                                    <Trash2 className="w-3 h-3" />
                                                  </button>
                                                  {entry.venue?.id && (
                                                    <button
                                                      type="button"
                                                      className="p-0.5 hover:bg-slate-100 text-slate-500 hover:text-primary-700 rounded"
                                                      onClick={() => generateVenueQr(entry.venue.id)}
                                                      disabled={venueQrLoading === entry.venue.id}
                                                      title="Venue QR"
                                                    >
                                                      {venueQrLoading === entry.venue.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <QrCode className="w-3 h-3" />}
                                                    </button>
                                                  )}
                                                </div>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                )}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Generate modal */}
      <Modal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        title="Generate timetable"
        description="Set the examination period. Courses will be scheduled into the 8-11am, 11am-2pm, and 2-5pm slots with venue capacity and clash constraints."
      >
        <form onSubmit={handleGenSubmit(onGenerate)} className="space-y-4" noValidate>
          {readiness && isReady && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <p className="text-xs text-emerald-800">
                <span className="font-bold">{readiness.approved}</span> approved course{readiness.approved === 1 ? '' : 's'} and{' '}
                <span className="font-bold">{readiness.venues}</span> active venue{readiness.venues === 1 ? '' : 's'} ready.
              </p>
            </div>
          )}
          <div>
            <label className="label">Semester</label>
            <select className="input" {...registerGen('semesterId')}>
              <option value="" disabled hidden>Select semester</option>
              {(() => {
                const sems = semestersQuery.data || [];
                const byYear = new Map();
                for (const s of sems) {
                  const yName = s.academicYear?.name || 'No Academic Year';
                  if (!byYear.has(yName)) byYear.set(yName, []);
                  byYear.get(yName).push(s);
                }
                return [...byYear.entries()].map(([yearName, yearSems]) => (
                  <optgroup key={yearName} label={yearName}>
                    {yearSems.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                ));
              })()}
            </select>
            {genErrors.semesterId && <p className="field-error">{genErrors.semesterId.message}</p>}
            <p className="mt-1 text-xs text-ink-500">Dates auto-fill from the selected semester's active dates.</p>
          </div>
          <div>
            <label className="label">Exam start date</label>
            <input
              type="date"
              className="input"
              min={dateKey(new Date())}
              {...registerGen('startDate')}
              onChange={(e) => setGenValue('startDate', e.target.value)}
            />
            {genErrors.startDate && <p className="field-error">{genErrors.startDate.message}</p>}
            {watchStartDate && isWeekendDate(watchStartDate) && (
              <p className="field-error">This date falls on a weekend. Please choose a weekday.</p>
            )}
          </div>
          <div>
            <label className="label">Exam duration (weeks)</label>
            <select
              className="input"
              {...registerGen('durationWeeks')}
              onChange={(e) => setGenValue('durationWeeks', Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((w) => (
                <option key={w} value={w}>{w} week{w === 1 ? '' : 's'}</option>
              ))}
            </select>
            {genErrors.durationWeeks && <p className="field-error">{genErrors.durationWeeks.message}</p>}
            {watchStartDate && watchDurationWeeks && (() => {
              const end = new Date(watchStartDate);
              end.setDate(end.getDate() + (Number(watchDurationWeeks) * 7) - 1);
              return (
                <p className="mt-1 text-xs text-ink-600">
                  Exams will run from <span className="font-bold">{new Date(watchStartDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  {' '}to{' '}
                  <span className="font-bold">{end.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  {' '}({Number(watchDurationWeeks) * 7} days).
                </p>
              );
            })()}
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" {...registerGen('skipWeekends')} />
            Skip weekends
          </label>
          <p className="text-xs text-ink-500">Weekends are skipped when the option above is checked, so the period may extend across more calendar days.</p>
          {hasInvigilators && (
            <div className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2.5 space-y-2">
              <label className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
                <input type="checkbox" {...registerGen('assignInvigilators')} />
                Assign invigilators to venues now
              </label>
              <p className="text-xs text-ink-500">
                {hasInvigilators
                  ? 'Invigilators are registered. Check to auto-assign them during generation, or leave unchecked to assign later.'
                  : 'No invigilators registered. You can assign them later after registration.'}
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setGenerateOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={generateMutation.isPending}>
              {generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Generate
            </button>
          </div>
        </form>
      </Modal>

      {/* Venue QR modal */}
      <VenueQrModal data={venueQrData} onClose={() => setVenueQrData(null)} />

      {/* Edit entry modal */}
      <EditEntryModal
        entry={editEntry}
        venues={venuesQuery.data || []}
        onClose={() => setEditEntry(null)}
        onSubmit={(payload) => updateEntryMutation.mutate({ entryId: editEntry.id, payload })}
        isPending={updateEntryMutation.isPending}
      />

      {/* Delete confirmation modal */}
      <Modal
        open={deleteConfirm}
        onClose={() => { setDeleteConfirm(false); setDeleteTarget(null); }}
        title={deleteTarget ? 'Delete this entry?' : 'Delete entire timetable?'}
        description={deleteTarget
          ? `This will remove ${deleteTarget.course?.code} — ${deleteTarget.course?.title} from the timetable.`
          : 'This will permanently delete all timetable entries and venue assignments for this session.'}
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
            <p className="text-xs text-rose-800">
              This action cannot be undone. {deleteTarget ? 'The entry will be removed.' : 'All scheduled exams will be removed.'}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => { setDeleteConfirm(false); setDeleteTarget(null); }}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary bg-rose-600 hover:bg-rose-700 text-white"
              disabled={deleteEntryMutation.isPending || deleteTimetableMutation.isPending}
              onClick={() => {
                if (deleteTarget) {
                  deleteEntryMutation.mutate(deleteTarget.id);
                } else {
                  deleteTimetableMutation.mutate(sessionId);
                }
              }}
            >
              {(deleteEntryMutation.isPending || deleteTimetableMutation.isPending)
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Trash2 className="w-4 h-4" />}
              Delete
            </button>
          </div>
        </div>
      </Modal>

      <ImportPreviewModal
        open={!!coursePreview}
        onClose={() => setCoursePreview(null)}
        title="Preview Course Import"
        columns={[
          { key: 'code', label: 'Code' },
          { key: 'title', label: 'Title' },
          { key: 'departmentName', label: 'Department' },
          { key: 'level', label: 'Level' },
          { key: 'studentCount', label: 'Students' },
          { key: 'instructorName', label: 'Instructor' },
        ]}
        rows={coursePreview?.courses || []}
        onConfirm={confirmCourseImport}
        loading={importingCourses}
      />
    </>
  );
};

const VenueQrModal = ({ data, onClose }) => {
  const [dataUrl, setDataUrl] = useState(data?._dataUrl || '');

  useEffect(() => {
    if (data?._dataUrl) {
      setDataUrl(data._dataUrl);
      return;
    }
    if (!data?.link) return;
    let cancelled = false;
    QRCode.toDataURL(data.link, { width: 280, margin: 2 })
      .then((url) => { if (!cancelled) setDataUrl(url); })
      .catch(() => { if (!cancelled) setDataUrl(''); });
    return () => { cancelled = true; };
  }, [data?.link, data?._dataUrl]);

  if (!data) return null;

  return (
    <Modal
      open={!!data}
      onClose={onClose}
      title={`QR Code — ${data.venue?.name || 'Venue'}`}
      description={data.session?.name || ''}
    >
      <div className="text-center space-y-4">
        <div className="text-sm text-ink-700">
          <span className="font-bold">{data.venue?.name}</span>
          {data.venue?.location && <span className="text-ink-500"> · {data.venue.location}</span>}
          <span className="text-ink-500"> · Capacity: {data.venue?.capacity}</span>
        </div>
        {dataUrl ? (
          <img src={dataUrl} alt="Venue QR Code" className="mx-auto rounded-lg border border-surface-border" />
        ) : (
          <div className="w-[280px] h-[280px] mx-auto bg-surface-subtle rounded-lg grid place-items-center">
            <Loader2 className="w-8 h-8 animate-spin text-ink-400" />
          </div>
        )}
        <p className="text-xs text-ink-500">
          Show this QR code to invigilators assigned to this venue. They scan it to record their attendance.
          The code is valid for 24 hours.
        </p>
        <button className="btn-secondary" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
};

const toLocalInputValue = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
};

const EditEntryModal = ({ entry, venues, onClose, onSubmit, isPending }) => {
  const [venueId, setVenueId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');

  useEffect(() => {
    if (entry) {
      setVenueId(entry.venue?.id || '');
      setScheduledAt(toLocalInputValue(entry.scheduledAt));
    }
  }, [entry]);

  if (!entry) return null;

  return (
    <Modal
      open={!!entry}
      onClose={onClose}
      title="Edit timetable entry"
      description={`${entry.course?.code || ''} — ${entry.course?.title || ''}`}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const dt = new Date(scheduledAt);
          onSubmit({
            venueId,
            scheduledAt: dt.toISOString(),
          });
        }}
        className="space-y-4"
        noValidate
      >
        <div>
          <label className="label">Venue</label>
          <select className="input" value={venueId} onChange={(e) => setVenueId(e.target.value)}>
            <option value="">Select venue</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} (Cap: {v.capacity}){v.location ? ` · ${v.location}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Date & time</label>
          <input
            type="datetime-local"
            className="input"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
          <p className="mt-1 text-xs text-ink-500">
            Exam slots: 8:00 AM, 11:00 AM, or 2:00 PM. The hour determines which slot this entry appears in.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={isPending}>
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
            Save changes
          </button>
        </div>
      </form>
    </Modal>
  );
};
