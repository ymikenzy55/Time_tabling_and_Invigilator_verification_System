import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Html5Qrcode } from 'html5-qrcode';
import toast from 'react-hot-toast';
import { Loader2, QrCode, ScanLine, CheckCircle2, AlertCircle, AlertTriangle, MapPin, Clock, Navigation } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { attendanceApi } from '@/features/attendance/attendanceApi';
import { venueAssignmentsApi } from '@/features/venueAssignments/venueAssignmentsApi';
import { useAuth } from '@/context/AuthContext';

const SCANNER_ID = 'qr-scanner';

const RESULT_LABELS = {
  RECORDED: 'Attendance Recorded',
  REJECTED_INVALID_QR: 'Invalid QR Code',
  REJECTED_UNASSIGNED: 'Not Authorized',
  REJECTED_VENUE_MISMATCH: 'Wrong Venue',
  REJECTED_DUPLICATE: 'Already Checked In',
  REJECTED_WINDOW: 'Outside Exam Time Window',
  ABSENT: 'Marked Absent',
};

const CountdownUnit = ({ value, label }) => {
  const v = Math.max(0, value);
  return (
    <div className="flex flex-col items-center">
      <div className="w-20 h-20 rounded-xl bg-amber-50 border-2 border-amber-200 grid place-items-center">
        <span className="text-3xl font-bold text-amber-700 tabular-nums">
          {String(v).padStart(2, '0')}
        </span>
      </div>
      <span className="text-xs font-medium text-ink-500 mt-1.5 uppercase tracking-wide">{label}</span>
    </div>
  );
};

export const ScanPage = () => {
  const { user } = useAuth();
  const isDemoUser = user?.isDemo === true;
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [result, setResult] = useState(null);
  const [manualToken, setManualToken] = useState(searchParams.get('token') || '');
  const [pendingToken, setPendingToken] = useState(null);
  const [verification, setVerification] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [locationData, setLocationData] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const scannerRef = useRef(null);
  const scannedRef = useRef(false);
  const fromAssignment = location.state?.fromAssignment;

  // Fetch the invigilator's own scan history so they can see past scans.
  const scanHistoryQuery = useQuery({
    queryKey: ['myVenueScans'],
    queryFn: () => attendanceApi.listVenueScans(),
    staleTime: 10_000,
  });

  // Fetch assignments to check scan window
  const assignmentsQuery = useQuery({
    queryKey: ['myVenueAssignments'],
    queryFn: venueAssignmentsApi.myAssignments,
    staleTime: 30_000,
  });

  const assignments = assignmentsQuery.data || [];

  // Real-time clock for countdown — updates every second so the invigilator
  // sees the window status change without needing to refresh the page.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Scan window: opens at exam start, closes at exam end.
  const examStart = fromAssignment ? new Date(fromAssignment.slotAt) : null;
  const examEnd = fromAssignment
    ? new Date(new Date(fromAssignment.slotAt).getTime() + (fromAssignment.examDurationMinutes || 180) * 60 * 1000)
    : null;

  const isScanAvailable = fromAssignment
    ? isDemoUser || (now >= examStart && now <= examEnd)
    : false;

  const formatCountdown = useCallback((ms) => {
    if (ms <= 0) return null;
    const totalSec = Math.ceil(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }, []);

  const timeUntilScan = fromAssignment && examStart
    ? formatCountdown(examStart - now)
    : null;

  const timeUntilClose = fromAssignment && examEnd && isScanAvailable
    ? formatCountdown(examEnd - now)
    : null;

  const allowRescan = () => {
    scannedRef.current = false;
  };

  // Geolocation — must be obtained before scanning is allowed.
  const requestLocation = () => {
    setLocationError(null);
    setLocationLoading(true);
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser. Please use a modern browser.');
      setLocationLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationData({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          locationAccuracy: pos.coords.accuracy,
        });
        setLocationLoading(false);
      },
      (err) => {
        let msg = 'Could not get your location.';
        if (err.name === 'NotAllowedError') {
          msg = 'Location permission denied. You must allow location access to scan QR codes. Please enable it in your browser settings and try again.';
        } else if (err.name === 'PositionUnavailableError') {
          msg = 'Your location is unavailable. Please check your GPS/network and try again.';
        } else if (err.name === 'TimeoutError') {
          msg = 'Location request timed out. Please try again.';
        }
        setLocationError(msg);
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  // Stage 1 — ask the server which venue this QR is for and whether the
  // invigilator is assigned there. This records nothing.
  const verifyMutation = useMutation({
    mutationFn: (token) => attendanceApi.previewVenueScan(token),
    onSuccess: (data, token) => {
      if (data.ok) {
        // Correct venue: hold the token and ask for confirmation.
        setPendingToken(token);
        setVerification(data);
        return;
      }

      // Not a venue QR — it may still be a per-invigilation QR, which the
      // preview endpoint cannot evaluate. Ask for confirmation and let the
      // legacy endpoint decide.
      if (data.result === 'REJECTED_INVALID_QR') {
        setPendingToken(token);
        setVerification({ ok: false, unverified: true });
        return;
      }

      // Wrong venue (or any other rejection): tell the invigilator right away
      // and never reach the confirmation step.
      const label = RESULT_LABELS[data.result] || data.result;
      toast.error(`${label}${data.message ? ': ' + data.message : ''}`);
      setResult({ ...data, previewOnly: true });
      setPendingToken(null);
      setVerification(null);
      allowRescan();
    },
    onError: (err) => {
      toast.error(err.message || 'Could not verify this QR code.');
      setResult({ error: err.message });
      allowRescan();
    },
  });

  // Stage 2 — actually record the attendance, only after an explicit Yes.
  const scanMutation = useMutation({
    mutationFn: async (token) => {
      try {
        const data = await attendanceApi.scanVenue(token, locationData || {});
        if (data.result === 'RECORDED' || data.result?.startsWith('REJECTED')) return data;
      } catch (err) {
        if (err?.status !== 400 && err?.status !== 404) throw err;
      }
      // Fall back to the per-invigilation QR endpoint.
      return attendanceApi.scan(token);
    },
    onSuccess: (data) => {
      const isRecorded = data.result === 'RECORDED';
      if (isRecorded) {
        toast.success('Attendance recorded successfully!');
        scanHistoryQuery.refetch();
      } else {
        const label = RESULT_LABELS[data.result] || data.result;
        toast.error(`${label}${data.message ? ': ' + data.message : ''}`);
        allowRescan();
      }
      setResult(data);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to record attendance.');
      setResult({ error: err.message });
      allowRescan();
    },
  });

  const isBusy = verifyMutation.isPending || scanMutation.isPending;

  const submitToken = (token) => {
    if (!token || isBusy) return;
    if (!locationData) {
      toast.error('Location access is required to scan. Please allow location access and try again.');
      return;
    }
    setResult(null);
    verifyMutation.mutate(token);
  };

  const confirmSubmit = () => {
    if (!pendingToken) return;
    const token = pendingToken;
    setPendingToken(null);
    setVerification(null);
    scanMutation.mutate(token);
  };

  const cancelSubmit = () => {
    setPendingToken(null);
    setVerification(null);
    allowRescan();
  };

  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    if (tokenFromUrl && !scannedRef.current) {
      scannedRef.current = true;
      submitToken(tokenFromUrl);
    }
  }, [searchParams]);

  const startCamera = async () => {
    setCameraError(null);
    setCameraStarting(true);

    if (!window.isSecureContext) {
      setCameraError('Camera requires HTTPS or localhost. The app must be served over a secure connection.');
      setCameraStarting(false);
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera API not available in this browser. Try Chrome, Firefox, or Safari.');
      setCameraStarting(false);
      return;
    }

    if (scannerRef.current) {
      if (scannerRef.current.isScanning) {
        try { await scannerRef.current.stop(); } catch {}
      }
      try { scannerRef.current.clear(); } catch {}
      scannerRef.current = null;
    }

    const el = document.getElementById(SCANNER_ID);
    if (el) el.innerHTML = '';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.getTracks().forEach((t) => t.stop());
    } catch (permErr) {
      if (permErr.name === 'NotAllowedError') {
        setCameraError('Camera permission denied. Please allow camera access in your browser settings and retry.');
      } else if (permErr.name === 'NotFoundError' || permErr.name === 'OverconstrainedError') {
        setCameraError('No camera found. Connect a camera or use the manual token input below.');
      } else if (permErr.name === 'NotReadableError') {
        setCameraError('Camera is in use by another application. Close it and retry.');
      } else {
        setCameraError(`Camera error: ${permErr.message || permErr.name}`);
      }
      setCameraStarting(false);
      return;
    }

    await new Promise((r) => setTimeout(r, 100));

    try {
      const scanner = new Html5Qrcode(SCANNER_ID);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (scannedRef.current) return;
          scannedRef.current = true;
          setManualToken(decodedText);
          setSearchParams({ token: decodedText });
          submitToken(decodedText);
          scanner.stop().catch(() => {});
        },
        () => {},
      );
    } catch (err) {
      setCameraError(`Failed to start scanner: ${err.message || err.name || 'Unknown error'}`);
    } finally {
      setCameraStarting(false);
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <>
      <PageHeader
        title="Scan QR Code"
        description="Scan the venue QR code to record your attendance."
      />

      {/* Scan window status banner */}
      {fromAssignment && (
        <div className={`panel p-3 mb-4 ${
          isScanAvailable
            ? 'bg-emerald-50 border-emerald-200'
            : timeUntilScan
            ? 'bg-amber-50 border-amber-200'
            : 'bg-rose-50 border-rose-200'
        }`}>
          <div className="flex items-center gap-2 text-sm">
            {isScanAvailable ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : timeUntilScan ? (
              <Clock className="w-4 h-4 shrink-0 text-amber-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span className={
              isScanAvailable
                ? 'text-emerald-800'
                : timeUntilScan
                ? 'text-amber-800'
                : 'text-rose-800'
            }>
              {isScanAvailable
                ? isDemoUser
                  ? 'Demo mode — scanning is available at any time'
                  : timeUntilClose
                  ? `Scan window is open — closes in ${timeUntilClose}`
                  : 'Scan window is open'
                : timeUntilScan
                ? `Scan opens in ${timeUntilScan}`
                : 'Scan window is closed'}
            </span>
          </div>
        </div>
      )}

      {/* Assignment context banner */}
      {fromAssignment && (
        <div className="panel p-3 mb-4 bg-primary-50 border-primary-200">
          <div className="flex items-center gap-2 text-sm text-primary-800">
            <MapPin className="w-4 h-4 shrink-0" />
            <span>
              Venue: <strong>{fromAssignment.venue?.name}</strong> —{' '}
              {new Date(fromAssignment.slotAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>
      )}

      {/* Location status banner */}
      <div className={`panel p-3 mb-4 ${
        locationData
          ? 'bg-emerald-50 border-emerald-200'
          : locationError
          ? 'bg-rose-50 border-rose-200'
          : 'bg-amber-50 border-amber-200'
      }`}>
        <div className="flex items-center gap-2 text-sm">
          {locationData ? (
            <>
              <Navigation className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="text-emerald-800">
                Location acquired — Lat: {locationData.latitude.toFixed(6)}, Lng: {locationData.longitude.toFixed(6)}
                {locationData.locationAccuracy ? ` (±${Math.round(locationData.locationAccuracy)}m)` : ''}
              </span>
            </>
          ) : locationError ? (
            <>
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span className="text-rose-800 flex-1">{locationError}</span>
              <button className="btn-secondary btn-sm" onClick={requestLocation} disabled={locationLoading}>
                {locationLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                Retry
              </button>
            </>
          ) : (
            <>
              <Loader2 className="w-4 h-4 shrink-0 text-amber-600 animate-spin" />
              <span className="text-amber-800">Getting your location…</span>
            </>
          )}
        </div>
      </div>

      <div className="max-w-md mx-auto space-y-6">
        {!isScanAvailable && fromAssignment ? (
          <div className="panel p-6 text-center">
            {timeUntilScan ? (
              <>
                <Clock className="w-12 h-12 mx-auto mb-3 text-amber-500" />
                <h3 className="text-lg font-bold text-ink-900 mb-2">
                  Scan Opens In
                </h3>
                <div className="my-6 flex items-center justify-center gap-2">
                  <CountdownUnit value={Math.floor((examStart - now) / 3600000)} label="Hours" />
                  <span className="text-3xl font-bold text-ink-300">:</span>
                  <CountdownUnit value={Math.floor(((examStart - now) % 3600000) / 60000)} label="Minutes" />
                  <span className="text-3xl font-bold text-ink-300">:</span>
                  <CountdownUnit value={Math.ceil(((examStart - now) % 60000) / 1000)} label="Seconds" />
                </div>
                <p className="text-sm text-ink-600 mb-4">
                  Scanning opens when the exam starts. The scanner will unlock automatically.
                </p>
              </>
            ) : (
              <>
                <AlertCircle className="w-12 h-12 mx-auto mb-3 text-rose-500" />
                <h3 className="text-lg font-bold text-ink-900 mb-2">
                  Scan Window Closed
                </h3>
                <p className="text-sm text-ink-600 mb-4">
                  The scan window has closed. Scanning is only available during the exam.
                </p>
              </>
            )}
            <button
              className="btn-secondary"
              onClick={() => window.location.reload()}
            >
              Refresh Status
            </button>
          </div>
        ) : (
          <>
            <div className="panel p-4">
              <div id={SCANNER_ID} className="w-full aspect-square rounded-lg overflow-hidden bg-black" />
              {cameraStarting && (
                <div className="mt-3 flex items-center gap-2 text-sm text-ink-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Starting camera…
                </div>
              )}
              {cameraError && (
                <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium">Camera unavailable</div>
                      <div className="text-xs mt-1">{cameraError}</div>
                      <button
                        className="mt-2 btn-secondary btn-sm"
                        onClick={startCamera}
                        disabled={cameraStarting}
                      >
                        {cameraStarting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanLine className="w-3.5 h-3.5" />}
                        Retry Camera
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {!cameraError && !cameraStarting && (
                <div className="mt-4 flex items-center gap-2 text-xs text-ink-500">
                  <ScanLine className="w-4 h-4" />
                  Point the camera at the venue QR code.
                </div>
              )}
            </div>

            <div className="panel p-4 space-y-3">
              <label className="label">Or paste the token manually</label>
              <textarea
                className="input min-h-[80px] text-xs"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="Paste the token from the QR code..."
              />
              <button
                className="btn-primary w-full"
                disabled={!manualToken || isBusy}
                onClick={() => submitToken(manualToken)}
              >
                {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                {verifyMutation.isPending ? 'Checking venue…' : scanMutation.isPending ? 'Recording…' : 'Submit token'}
              </button>
            </div>
          </>
        )}

        {verifyMutation.isPending && (
          <div className="panel p-4 flex items-center justify-center gap-2 text-sm text-ink-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking whether you are at the right venue…
          </div>
        )}

        {result && (
          <div className={`card p-4 text-center ${
            result.result === 'RECORDED'
              ? 'border-emerald-300 bg-emerald-50'
              : 'border-rose-300 bg-rose-50'
          }`}>
            <div className="flex items-center justify-center gap-2 text-lg font-bold">
              {result.result === 'RECORDED'
                ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                : <AlertCircle className="w-5 h-5 text-rose-600" />
              }
              {result.result === 'RECORDED'
                ? 'Attendance Recorded'
                : RESULT_LABELS[result.result] || result.result || 'Error'}
            </div>
            {result.message && (
              <div className="text-sm text-rose-700 mt-2 flex items-start justify-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{result.message}</span>
              </div>
            )}
            {result.result === 'REJECTED_VENUE_MISMATCH' && result.allAssignedVenues && result.allAssignedVenues.length > 0 && (
              <div className="mt-3 rounded-lg border border-primary-200 bg-primary-50 p-3 text-left">
                <div className="flex items-center gap-2 text-xs font-bold text-primary-800 uppercase tracking-wide">
                  <MapPin className="w-3.5 h-3.5" /> Your assigned venues today
                </div>
                <div className="mt-2 space-y-1.5">
                  {result.allAssignedVenues.map((v, i) => (
                    <div key={i} className="text-sm">
                      <span className="font-bold text-ink-900">{v.name}</span>
                      {v.location && <span className="text-ink-600"> · {v.location}</span>}
                      {v.slotAt && (
                        <span className="text-xs text-ink-500 ml-1">
                          at {new Date(v.slotAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="text-xs text-primary-700 mt-2">
                  Please head to your assigned venue and scan the QR code there.
                </div>
              </div>
            )}
            {result.result === 'REJECTED_VENUE_MISMATCH' && result.assignedVenue && !result.allAssignedVenues && (
              <div className="mt-3 rounded-lg border border-primary-200 bg-primary-50 p-3 text-left">
                <div className="flex items-center gap-2 text-xs font-bold text-primary-800 uppercase tracking-wide">
                  <MapPin className="w-3.5 h-3.5" /> Your assigned venue today
                </div>
                <div className="mt-1.5 text-base font-bold text-ink-900">{result.assignedVenue.name}</div>
                {result.assignedVenue.location && (
                  <div className="text-sm text-ink-600">{result.assignedVenue.location}</div>
                )}
                {result.assignedVenue.slotAt && (
                  <div className="text-xs text-ink-500 mt-1">
                    Slot: {new Date(result.assignedVenue.slotAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
                <div className="text-xs text-primary-700 mt-2">
                  Please head there and scan the QR code posted at that venue.
                </div>
              </div>
            )}
            {result.venue && (
              <div className="text-sm text-ink-700 mt-2">
                Venue: <span className="font-medium">{result.venue.name}</span>
                {result.venue.location ? ` · ${result.venue.location}` : ''}
              </div>
            )}
            {result.invigilator && (
              <div className="text-sm text-ink-700 mt-0.5">
                {result.invigilator.fullName}
                {result.invigilator.staffId ? ` · ${result.invigilator.staffId}` : ''}
              </div>
            )}
            {result.scan?.scannedAt && (
              <div className="text-xs text-ink-500 mt-1">
                Scanned at: {new Date(result.scan.scannedAt).toLocaleString()}
              </div>
            )}
            {result.result === 'RECORDED' && result.timeSlot && (
              <div className="text-xs text-ink-500 mt-1">
                Time slot: {result.timeSlot}
              </div>
            )}
            {result.error && <div className="text-sm text-rose-700 mt-1">{result.error}</div>}
            {result.previewOnly && (
              <div className="text-xs text-ink-500 mt-3">
                No attendance was recorded. Scan the QR code at your assigned venue.
              </div>
            )}
            {result.result !== 'RECORDED' && (
              <button
                className="btn-secondary btn-sm mt-3"
                onClick={() => {
                  setResult(null);
                  allowRescan();
                  startCamera();
                }}
              >
                <ScanLine className="w-3.5 h-3.5" /> Scan again
              </button>
            )}
            {result.result === 'RECORDED' && (
              <button
                className="btn-secondary btn-sm mt-3"
                onClick={() => {
                  setResult(null);
                  allowRescan();
                  startCamera();
                }}
              >
                <ScanLine className="w-3.5 h-3.5" /> Scan again
              </button>
            )}
          </div>
        )}

        {/* Scan history */}
        {scanHistoryQuery.data && scanHistoryQuery.data.length > 0 && (
          <div className="panel p-4">
            <h3 className="text-sm font-bold text-ink-900 mb-3">Your recent scans</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {scanHistoryQuery.data.slice(0, 10).map((scan) => (
                <div key={scan.id} className="flex items-center justify-between text-xs border-b border-surface-divider pb-2 last:border-0">
                  <div>
                    <span className="font-medium text-ink-900">{scan.venue?.name || 'Unknown venue'}</span>
                    {scan.venue?.location && <span className="text-ink-500"> · {scan.venue.location}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      scan.result === 'RECORDED'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}>
                      {scan.result === 'RECORDED' ? 'Present' : scan.result.replace('REJECTED_', '')}
                    </span>
                    <span className="text-ink-400">
                      {new Date(scan.scannedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Shown only once the venue has been verified as correct. */}
      <Modal
        open={!!pendingToken}
        onClose={cancelSubmit}
        title={verification?.unverified ? 'Confirm Attendance Submission' : 'You are at the correct venue'}
        size="sm"
      >
        <div className="space-y-4">
          {verification?.unverified ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                This is not a venue QR code, so the venue could not be verified in
                advance. Make sure you are scanning the code for your assigned venue.
              </span>
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Venue verified
              </div>
              <div className="mt-2 text-base font-bold text-ink-900">
                {verification?.venue?.name || fromAssignment?.venue?.name}
              </div>
              {verification?.venue?.location && (
                <div className="text-sm text-ink-600">{verification.venue.location}</div>
              )}
              {verification?.slotAt && (
                <div className="text-xs text-ink-500 mt-1">
                  Slot: {new Date(verification.slotAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
          )}

          <p className="text-sm text-ink-700">
            Send your attendance to the exam officer now?
          </p>

          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={cancelSubmit} disabled={scanMutation.isPending}>
              No, cancel
            </button>
            <button
              className="btn-primary"
              onClick={confirmSubmit}
              disabled={scanMutation.isPending}
            >
              {scanMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <CheckCircle2 className="w-4 h-4" />
              }
              Yes, send attendance
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
