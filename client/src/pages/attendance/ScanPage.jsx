import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Html5Qrcode } from 'html5-qrcode';
import toast from 'react-hot-toast';
import { Loader2, QrCode, ScanLine, CheckCircle2, AlertCircle, AlertTriangle, MapPin, Clock } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { attendanceApi } from '@/features/attendance/attendanceApi';
import { venueAssignmentsApi } from '@/features/venueAssignments/venueAssignmentsApi';

const SCANNER_ID = 'qr-scanner';

const RESULT_LABELS = {
  RECORDED: 'Attendance Recorded',
  REJECTED_INVALID_QR: 'Invalid QR Code',
  REJECTED_UNASSIGNED: 'Not Authorized',
  REJECTED_VENUE_MISMATCH: 'Wrong Venue',
  REJECTED_DUPLICATE: 'Already Checked In',
  REJECTED_WINDOW: 'Outside Time Window',
};

export const ScanPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [result, setResult] = useState(null);
  const [manualToken, setManualToken] = useState(searchParams.get('token') || '');
  const [pendingToken, setPendingToken] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [cameraStarting, setCameraStarting] = useState(false);
  const scannerRef = useRef(null);
  const scannedRef = useRef(false);
  const fromAssignment = location.state?.fromAssignment;

  // Fetch assignments to check scan window
  const assignmentsQuery = useQuery({
    queryKey: ['myVenueAssignments'],
    queryFn: venueAssignmentsApi.myAssignments,
    staleTime: 30_000,
  });

  const assignments = assignmentsQuery.data || [];

  // Check if scan is available (30 min before exam start, until exam end)
  const now = new Date();
  const isScanAvailable = fromAssignment ? (() => {
    const slotTime = new Date(fromAssignment.slotAt);
    const examDuration = fromAssignment.examDurationMinutes || 180;
    const scanOpenTime = new Date(slotTime.getTime() - 30 * 60 * 1000);
    const examEndTime = new Date(slotTime.getTime() + examDuration * 60 * 1000);
    return now >= scanOpenTime && now <= examEndTime;
  })() : false;

  const timeUntilScan = fromAssignment ? (() => {
    const slotTime = new Date(fromAssignment.slotAt);
    const scanOpenTime = new Date(slotTime.getTime() - 30 * 60 * 1000);
    const diffMs = scanOpenTime - now;
    if (diffMs <= 0) return null;
    const diffMins = Math.ceil(diffMs / (1000 * 60));
    if (diffMins < 60) return `${diffMins} min`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  })() : null;

  const scanMutation = useMutation({
    mutationFn: async (token) => {
      try {
        const data = await attendanceApi.scanVenue(token);
        if (data.result === 'RECORDED' || data.result?.startsWith('REJECTED')) return data;
      } catch (err) {
        if (err?.response?.status !== 400 && err?.response?.status !== 404) throw err;
      }
      return attendanceApi.scan(token);
    },
    onSuccess: (data) => {
      const isRecorded = data.result === 'RECORDED';
      if (isRecorded) {
        toast.success('Attendance recorded successfully!');
      } else {
        const label = RESULT_LABELS[data.result] || data.result;
        toast.error(`${label}${data.message ? ': ' + data.message : ''}`);
      }
      setResult(data);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to scan.');
      setResult({ error: err.message });
    },
  });

  const executeScan = (token) => {
    scanMutation.mutate(token);
  };

  const submitToken = (token) => {
    if (!token || scanMutation.isPending) return;
    if (!isScanAvailable && fromAssignment) {
      toast.error('Scan window is not open. Scanning opens 30 minutes before the exam and closes when the exam ends.');
      return;
    }
    // Show confirmation prompt before submitting
    setPendingToken(token);
  };

  const confirmSubmit = () => {
    if (!pendingToken) return;
    executeScan(pendingToken);
    setPendingToken(null);
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
                ? 'Scan window is open'
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

      <div className="max-w-md mx-auto space-y-6">
        {!isScanAvailable && fromAssignment ? (
          <div className="panel p-6 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-rose-500" />
            <h3 className="text-lg font-bold text-ink-900 mb-2">
              {timeUntilScan ? 'Scan Not Yet Available' : 'Scan Window Closed'}
            </h3>
            <p className="text-sm text-ink-600 mb-4">
              {timeUntilScan
                ? `Scanning opens 30 minutes before the exam. Please wait ${timeUntilScan}.`
                : 'The scan window has closed. Scanning is only available from 30 minutes before the exam until the exam ends.'}
            </p>
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
                disabled={!manualToken || scanMutation.isPending}
                onClick={() => submitToken(manualToken)}
              >
                {scanMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                Submit token
              </button>
            </div>
          </>
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
            {result.result === 'REJECTED_VENUE_MISMATCH' && result.assignedVenue && (
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
            {result.error && <div className="text-sm text-rose-700 mt-1">{result.error}</div>}
          </div>
        )}
      </div>

      {/* Confirmation modal before submitting attendance */}
      <Modal
        open={!!pendingToken}
        onClose={() => setPendingToken(null)}
        title="Confirm Attendance Submission"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2 text-sm text-ink-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
            <span>
              You are about to submit your attendance by scanning this QR code.
              Your check-in will be sent to the exam officer with a timestamp.
              Make sure you are scanning the QR code for your assigned venue.
            </span>
          </div>
          {fromAssignment && (
            <div className="rounded-lg bg-surface-subtle p-3 text-sm">
              <div className="font-medium text-ink-900">{fromAssignment.venue?.name}</div>
              <div className="text-xs text-ink-500 mt-0.5">
                {new Date(fromAssignment.slotAt).toLocaleDateString()} ·{' '}
                {new Date(fromAssignment.slotAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setPendingToken(null)}>
              Cancel
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
              Confirm & Submit
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
