import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Html5Qrcode } from 'html5-qrcode';
import toast from 'react-hot-toast';
import { Loader2, QrCode, ScanLine, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { attendanceApi } from '@/features/attendance/attendanceApi';

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
  const scannerRef = useRef(null);
  const scannedRef = useRef(false);
  const fromAssignment = location.state?.fromAssignment;

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

  useEffect(() => {
    let scanner;
    const start = async () => {
      try {
        scanner = new Html5Qrcode(SCANNER_ID);
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
        toast.error('Could not start camera scanner.');
      }
    };
    start();

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

      {/* Assignment context banner */}
      {fromAssignment && (
        <div className="panel p-3 mb-4 bg-primary-50 border-primary-200">
          <div className="flex items-center gap-2 text-sm text-primary-800">
            <ScanLine className="w-4 h-4 shrink-0" />
            <span>
              Scanning for: <strong>{fromAssignment.venue?.name}</strong> —{' '}
              {new Date(fromAssignment.slotAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto space-y-6">
        <div className="panel p-4">
          <div id={SCANNER_ID} className="w-full aspect-square rounded-lg overflow-hidden bg-black" />
          <div className="mt-4 flex items-center gap-2 text-xs text-ink-500">
            <ScanLine className="w-4 h-4" />
            Point the camera at the venue QR code.
          </div>
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
