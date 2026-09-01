import { useEffect, useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { QrCode, Printer, FileDown } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCardGrid } from '@/components/ui/Skeleton';
import { useAuth } from '@/context/AuthContext';
import { examinationSessionsApi } from '@/features/examinations/examinationSessionsApi';
import { timetableApi } from '@/features/timetable/timetableApi';
import { attendanceApi } from '@/features/attendance/attendanceApi';

export const VenueQrCodesPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN';
  const [sessionId, setSessionId] = useState('');
  const [qrCache, setQrCache] = useState({});

  const sessionsQuery = useQuery({
    queryKey: ['examinationSessions'],
    queryFn: () => examinationSessionsApi.list(),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  // Auto-select the first session so QR codes load without manual selection.
  useEffect(() => {
    if (!sessionId && sessionsQuery.data?.length) {
      setSessionId(sessionsQuery.data[0].id);
    }
  }, [sessionId, sessionsQuery.data]);

  const entriesQuery = useQuery({
    queryKey: ['timetable', 'entries', sessionId],
    queryFn: () => timetableApi.list({ examinationSessionId: sessionId }),
    enabled: !!sessionId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

  const sessions = sessionsQuery.data || [];
  const entries = entriesQuery.data || [];

  // Group timetable entries by venue -> slot (each entry has course + venue data)
  const venueSlots = useMemo(() => {
    const map = new Map();
    for (const entry of entries) {
      const vId = entry.venue?.id;
      if (!vId) continue;
      if (!map.has(vId)) {
        map.set(vId, { venue: entry.venue, entries: [] });
      }
      map.get(vId).entries.push(entry);
    }
    for (const [, val] of map) {
      val.entries.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
    }
    return [...map.entries()].map(([id, val]) => ({ id, ...val }));
  }, [entries]);

  // Generate QR codes for all venues — single batch API call, then render
  // each QR image locally in parallel.
  const generateAllQr = useCallback(async () => {
    if (!sessionId) return;
    try {
      const data = await attendanceApi.generateVenueQrBatch(sessionId);
      await Promise.allSettled(
        (data?.venues || []).map(async (v) => {
          try {
            const url = await QRCode.toDataURL(v.code || v.token, { width: 512, margin: 1 });
            setQrCache((prev) => ({ ...prev, [v.venueId]: { url, token: v.token, code: v.code } }));
          } catch {
            setQrCache((prev) => ({ ...prev, [v.venueId]: { error: true } }));
          }
        })
      );
    } catch {
      // Mark all visible venues as errored so the retry button shows.
      setQrCache((prev) => {
        const next = { ...prev };
        for (const vs of venueSlots) {
          if (!next[vs.id]?.url) next[vs.id] = { error: true };
        }
        return next;
      });
    }
  }, [venueSlots, sessionId]);

  useEffect(() => {
    if (venueSlots.length > 0) {
      generateAllQr();
    } else {
      setQrCache({});
    }
  }, [venueSlots.length, generateAllQr]);

  const printAll = () => {
    const badges = venueSlots.map((vs) => {
      const qr = qrCache[vs.id];

      return `<div style="page-break-inside:avoid;border:2px solid #000;padding:16px;margin:8px;width:340px;display:inline-block;vertical-align:top;text-align:center;">
        <div style="font-weight:800;font-size:22px;text-transform:uppercase;letter-spacing:0.04em;line-height:1.2;">${vs.venue?.name || 'Venue'}</div>
        <div style="font-size:11px;color:#333;margin-top:4px;">${vs.venue?.location || ''} · Cap: ${vs.venue?.capacity || '—'}</div>
        ${qr ? `<img src="${qr.url}" style="width:260px;height:260px;margin:12px auto 0;display:block;" />` : '<div style="width:260px;height:260px;margin:12px auto 0;background:#eee;display:flex;align-items:center;justify-content:center;font-size:11px;color:#999;">No QR</div>'}
      </div>`;
    }).join('');

    const html = `<!doctype html><html><head><title>Venue QR Badges</title><style>
      * { font-family: system-ui, sans-serif; box-sizing: border-box; }
      body { padding: 16px; color: #000; background: #fff; }
      h1 { font-size: 18px; text-align: center; margin-bottom: 8px; }
      .badges { display: flex; flex-wrap: wrap; gap: 8px; }
      @media print { body { padding: 0; } }
    </style></head><body>
      <h1>Venue QR Code Badges</h1>
      <div class="badges">${badges}</div>
      <script>window.onload = () => { window.print(); };</script>
    </body></html>`;

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  const exportPdf = () => {
    printAll();
  };

  const printSingle = (vs) => {
    const qr = qrCache[vs.id];

    const html = `<!doctype html><html><head><title>QR Badge - ${vs.venue?.name}</title><style>
      * { font-family: system-ui, sans-serif; box-sizing: border-box; }
      body { padding: 16px; color: #000; background: #fff; }
      .badge { border:2px solid #000;padding:24px;max-width:420px;margin:0 auto;text-align:center; }
      @media print { body { padding: 0; } }
    </style></head><body>
      <div class="badge">
        <div style="font-weight:800;font-size:28px;text-transform:uppercase;letter-spacing:0.04em;line-height:1.2;">${vs.venue?.name || 'Venue'}</div>
        <div style="font-size:12px;color:#333;margin-top:6px;">${vs.venue?.location || ''} · Cap: ${vs.venue?.capacity || '—'}</div>
        ${qr ? `<img src="${qr.url}" style="width:340px;height:340px;margin:16px auto 0;display:block;" />` : '<div style="width:340px;height:340px;margin:16px auto 0;background:#eee;"></div>'}
      </div>
      <script>window.onload = () => { window.print(); };</script>
    </body></html>`;

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Venue QR Codes" description="Access restricted to exam officers." />
        <EmptyState icon={QrCode} title="Access denied" description="Only exam officers can view venue QR codes." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Venue QR Codes"
        description="View, print, and export QR code badges for all venues with their invigilator assignments."
        actions={(
          <div className="flex items-center gap-2">
            {venueSlots.length > 0 && (
              <>
                <button className="btn-secondary" onClick={printAll}>
                  <Printer className="w-4 h-4" /> Print All
                </button>
                <button className="btn-secondary" onClick={exportPdf}>
                  <FileDown className="w-4 h-4" /> Export PDF
                </button>
              </>
            )}
          </div>
        )}
      />

      <div className="panel p-4 mb-6">
        <div className="w-full sm:w-72">
          <label className="label">Examination session</label>
          <select className="input" value={sessionId} onChange={(e) => { setSessionId(e.target.value); setQrCache({}); }}>
            <option value="">Select session</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.semester?.name ? `· ${s.semester.name}` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!sessionId ? (
        <EmptyState
          icon={QrCode}
          title="Select an examination session"
          description="Choose a session to view venue QR codes and invigilator assignments."
        />
      ) : entriesQuery.isLoading ? (
        <SkeletonCardGrid count={6} lines={4} />
      ) : venueSlots.length === 0 ? (
        <EmptyState
          icon={QrCode}
          title="No venue assignments found"
          description="Generate a timetable for this session to see venue QR codes here."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {venueSlots.map((vs) => {
            const qr = qrCache[vs.id];
            return (
              <div key={vs.id} className="panel p-5 flex flex-col items-center text-center">
                <div className="w-full flex items-start justify-between gap-2">
                  <h3 className="flex-1 text-xl font-extrabold uppercase tracking-wide text-ink-900 leading-tight">
                    {vs.venue?.name}
                  </h3>
                  <button
                    className="btn-secondary btn-sm shrink-0"
                    onClick={() => printSingle(vs)}
                    title="Print single badge"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex justify-center mt-4">
                  {qr?.url ? (
                    <img
                      src={qr.url}
                      alt={`QR for ${vs.venue?.name}`}
                      className="w-64 h-64 max-w-full rounded-lg border border-surface-border"
                    />
                  ) : qr?.error ? (
                    <div className="w-64 h-64 max-w-full rounded-lg border border-rose-200 bg-rose-50 grid place-items-center text-center px-3">
                      <span className="text-xs text-rose-600 font-medium">Failed to load QR.
                        <button type="button" className="block mx-auto mt-1 underline" onClick={generateAllQr}>Retry</button>
                      </span>
                    </div>
                  ) : (
                    <div className="w-64 h-64 max-w-full rounded-lg border border-surface-border bg-surface-subtle animate-pulse" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};
