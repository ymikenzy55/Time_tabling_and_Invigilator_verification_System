import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Html5Qrcode } from 'html5-qrcode';
import toast from 'react-hot-toast';
import { Loader2, QrCode, ScanLine, CheckCircle2, AlertCircle, AlertTriangle, MapPin, Clock, Navigation } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
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
  const [cameraError, setCameraError] = useState(null);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [locationData, setLocationData] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationAddress, setLocationAddress] = useState(null); // Human-readable address
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
    ? isDemoUser || fromAssignment.isDemo || (now >= examStart && now <= examEnd)
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

  // Reverse geocode coordinates to get human-readable address
  const reverseGeocode = async (lat, lng) => {
    try {
      // Using Nominatim (OpenStreetMap) - free, no API key needed
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'UENR-Exam-System', // Required by Nominatim
          },
        }
      );
      
      if (!response.ok) {
        console.warn('[Location] Reverse geocoding failed');
        return null;
      }
      
      const data = await response.json();
      
      // Build a readable address
      const address = data.address || {};
      const parts = [];
      
      if (address.road || address.street) parts.push(address.road || address.street);
      if (address.suburb || address.neighbourhood) parts.push(address.suburb || address.neighbourhood);
      if (address.city || address.town || address.village) parts.push(address.city || address.town || address.village);
      if (address.state || address.region) parts.push(address.state || address.region);
      if (address.country) parts.push(address.country);
      
      const readableAddress = parts.length > 0 
        ? parts.join(', ')
        : data.display_name || 'Location acquired';
      
      console.log('[Location] Reverse geocoded:', readableAddress);
      return readableAddress;
    } catch (error) {
      console.error('[Location] Reverse geocoding error:', error);
      return null;
    }
  };

  // Geolocation — must be obtained before scanning is allowed.
  const requestLocation = async () => {
    setLocationError(null);
    setLocationLoading(true);
    setLocationAddress(null);

    // Check if geolocation is supported
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser. Please use a modern browser like Chrome, Firefox, or Safari.');
      setLocationLoading(false);
      return;
    }

    console.log('[Location] Requesting location...');

    // For PWAs and modern browsers, check/request permission first
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
        console.log('[Location] Current permission status:', permissionStatus.state);

        if (permissionStatus.state === 'denied') {
          setLocationError(
            'Location permission is blocked. To enable:\n\n' +
            'Android: Go to Settings → Apps → [Your Browser/App] → Permissions → Location → Allow\n\n' +
            'iOS: Go to Settings → Privacy → Location Services → [Your Browser/App] → While Using App\n\n' +
            'After changing settings, refresh the page.'
          );
          setLocationLoading(false);
          return;
        }

        // Listen for permission changes
        permissionStatus.addEventListener('change', () => {
          console.log('[Location] Permission changed to:', permissionStatus.state);
          if (permissionStatus.state === 'granted') {
            // Auto-retry when permission is granted
            requestLocation();
          }
        });
      } catch (err) {
        console.log('[Location] Permission API not fully supported:', err);
        // Continue anyway - older browsers will show prompt via getCurrentPosition
      }
    }

    // Try to get location with a reasonable timeout
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        console.log('[Location] Success:', pos.coords);
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        
        setLocationData({
          latitude,
          longitude,
          locationAccuracy: pos.coords.accuracy,
        });
        
        // Get human-readable address
        const address = await reverseGeocode(latitude, longitude);
        if (address) {
          setLocationAddress(address);
        }
        
        setLocationLoading(false);
      },
      (err) => {
        console.error('[Location] Error:', err.code, err.message);
        let msg = 'Could not get your location.';
        
        switch (err.code) {
          case err.PERMISSION_DENIED:
            msg = 'Location permission denied.\n\n' +
                  'To enable location access:\n\n' +
                  '📱 Android:\n' +
                  '1. Open Settings → Apps\n' +
                  '2. Find this app or your browser\n' +
                  '3. Tap Permissions → Location\n' +
                  '4. Select "Allow all the time" or "Allow only while using the app"\n\n' +
                  '📱 iOS:\n' +
                  '1. Open Settings → Privacy & Security\n' +
                  '2. Tap Location Services\n' +
                  '3. Find this app or your browser\n' +
                  '4. Select "While Using the App"\n\n' +
                  'After changing settings, come back and tap "Retry Location".';
            break;
          case err.POSITION_UNAVAILABLE:
            msg = 'Location unavailable. Please ensure GPS/Location Services are enabled on your device and you have a good signal. Try moving to a location with better reception.';
            break;
          case err.TIMEOUT:
            msg = 'Location request timed out. Please ensure you have a good GPS/network signal and try again. You may need to move to a location with better reception.';
            break;
          default:
            msg = `Location error: ${err.message}. Please check your device settings and try again.`;
        }
        
        setLocationError(msg);
        setLocationLoading(false);
      },
      { 
        enableHighAccuracy: true, 
        timeout: 30000, // Increased to 30 seconds
        maximumAge: 0 
      }
    );
  };

  // Try to get location on mount
  useEffect(() => {
    // Small delay to let the page render first
    const timer = setTimeout(() => {
      requestLocation();
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  // Stage 1 — ask the server which venue this QR is for and whether the
  // invigilator is assigned there. This records nothing.
  const verifyMutation = useMutation({
    mutationFn: (token) => attendanceApi.previewVenueScan(token),
    onSuccess: (data, token) => {
      if (data.ok) {
        // Correct venue: automatically submit (no confirmation needed)
        console.log('[Scan] Verification successful, auto-submitting...');
        // Do NOT set pendingToken — that would open the confirmation modal.
        // Just submit directly.
        scanMutation.mutate(token);
        return;
      }

      // Wrong venue (or any other rejection): tell the invigilator right away
      const label = RESULT_LABELS[data.result] || data.result;
      toast.error(`${label}${data.message ? ': ' + data.message : ''}`);
      setResult({ ...data, previewOnly: true });
      allowRescan();
    },
    onError: (err) => {
      toast.error(err.message || 'Could not verify this QR code.');
      setResult({ error: err.message });
      allowRescan();
    },
  });

  // Stage 2 — actually record the attendance after venue verification passes.
  const scanMutation = useMutation({
    mutationFn: async (token) => {
      try {
        // Include human-readable address in location data
        const locationPayload = locationData ? {
          ...locationData,
          address: locationAddress || null,
        } : {};
        
        const data = await attendanceApi.scanVenue(token, locationPayload);
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
        toast.success('Scan successful — attendance recorded!');
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
    
    // Check if location is available
    if (!locationData) {
      if (locationLoading) {
        toast.error('Please wait for location to be acquired before scanning.');
      } else if (locationError) {
        toast.error('Location is required to scan. Please fix the location error and try again.');
      } else {
        toast.error('Location access is required. Please allow location access and try again.');
      }
      return;
    }
    
    setResult(null);
    verifyMutation.mutate(token);
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
    // Only start camera if location is available
    if (locationData) {
      startCamera();
    }
    
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [locationData]); // Re-run when location becomes available

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
                ? (isDemoUser || fromAssignment?.isDemo)
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
              <div className="flex-1">
                <div className="text-emerald-800 font-medium">✓ Location acquired successfully</div>
                {locationAddress && (
                  <div className="text-emerald-700 text-xs mt-0.5 font-medium">
                    📍 {locationAddress}
                  </div>
                )}
                <div className="text-emerald-600 text-xs mt-0.5">
                  Coordinates: {locationData.latitude.toFixed(6)}, {locationData.longitude.toFixed(6)}
                  {locationData.locationAccuracy && ` • Accuracy: ±${Math.round(locationData.locationAccuracy)}m`}
                </div>
              </div>
            </>
          ) : locationError ? (
            <>
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <div className="flex-1">
                <div className="text-rose-800 font-medium">Location Error</div>
                <div className="text-rose-700 text-xs mt-0.5 whitespace-pre-line">{locationError}</div>
              </div>
              <button 
                className="btn-secondary btn-sm shrink-0" 
                onClick={requestLocation} 
                disabled={locationLoading}
              >
                {locationLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Navigation className="w-3.5 h-3.5" />
                )}
                {locationLoading ? 'Retrying...' : 'Retry'}
              </button>
            </>
          ) : (
            <>
              <Loader2 className="w-4 h-4 shrink-0 text-amber-600 animate-spin" />
              <div className="flex-1">
                <div className="text-amber-800 font-medium">Getting your location...</div>
                <div className="text-amber-700 text-xs mt-0.5">
                  Please allow location access when prompted. This may take up to 30 seconds.
                </div>
              </div>
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
            {!locationData ? (
              <div className="panel p-6 text-center">
                {locationLoading ? (
                  <>
                    <Loader2 className="w-12 h-12 mx-auto mb-3 text-amber-500 animate-spin" />
                    <h3 className="text-lg font-bold text-ink-900 mb-2">
                      Getting Your Location
                    </h3>
                    <p className="text-sm text-ink-600 mb-4">
                      Please allow location access when prompted. This is required to verify you are at the correct venue.
                    </p>
                    <p className="text-xs text-ink-500">
                      This may take up to 30 seconds. If you're indoors or have weak signal, consider moving to a location with better GPS reception.
                    </p>
                  </>
                ) : locationError ? (
                  <>
                    <AlertCircle className="w-12 h-12 mx-auto mb-3 text-rose-500" />
                    <h3 className="text-lg font-bold text-ink-900 mb-2">
                      Location Access Required
                    </h3>
                    <div className="text-sm text-ink-600 mb-4 text-left max-w-md mx-auto bg-rose-50 border border-rose-200 rounded-lg p-4">
                      <p className="font-medium mb-2">📱 To enable location access:</p>
                      <div className="space-y-2 text-xs">
                        <div>
                          <strong>Android:</strong>
                          <ol className="list-decimal ml-4 mt-1 space-y-1">
                            <li>Go to Settings → Apps</li>
                            <li>Find this app or your browser</li>
                            <li>Tap Permissions → Location</li>
                            <li>Select "Allow all the time" or "While using"</li>
                          </ol>
                        </div>
                        <div>
                          <strong>iOS:</strong>
                          <ol className="list-decimal ml-4 mt-1 space-y-1">
                            <li>Go to Settings → Privacy & Security</li>
                            <li>Tap Location Services</li>
                            <li>Find this app or your browser</li>
                            <li>Select "While Using the App"</li>
                          </ol>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        className="btn-primary"
                        onClick={requestLocation}
                        disabled={locationLoading}
                      >
                        {locationLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Navigation className="w-4 h-4" />
                        )}
                        {locationLoading ? 'Getting Location...' : 'Retry Location Access'}
                      </button>
                      <p className="text-xs text-ink-500">
                        If the button doesn't work, you may need to manually enable location in your device settings (see instructions above), then come back and tap "Retry Location Access".
                      </p>
                    </div>
                  </>
                ) : null}
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
          </>
        )}

        {scanMutation.isPending && (
          <div className="panel p-4 text-center">
            <Loader2 className="w-8 h-8 mx-auto mb-3 text-primary-600 animate-spin" />
            <h3 className="text-base font-bold text-ink-900 mb-1">
              Sending Details to Exam Officer
            </h3>
            <p className="text-sm text-ink-600">
              Recording your attendance and location...
            </p>
          </div>
        )}

        {verifyMutation.isPending && !scanMutation.isPending && (
          <div className="panel p-4 flex items-center justify-center gap-2 text-sm text-ink-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            Verifying venue assignment…
          </div>
        )}

        {result && (
          <div className={`card p-4 text-center ${
            result.result === 'RECORDED'
              ? 'border-emerald-300 bg-emerald-50'
              : 'border-rose-300 bg-rose-50'
          }`}>
            {result.result === 'RECORDED' ? (
              <>
                <div className="flex items-center justify-center gap-2 text-lg font-bold text-emerald-700">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  Scan Successful
                </div>
                <div className="text-sm text-emerald-700 mt-2">
                  Your attendance has been recorded.
                </div>
                {result.venue && (
                  <div className="text-sm text-ink-700 mt-1">
                    Venue: <span className="font-medium">{result.venue.name}</span>
                  </div>
                )}
                {result.timeSlot && (
                  <div className="text-xs text-ink-500 mt-1">
                    Time slot: {result.timeSlot}
                  </div>
                )}
                {result.scan?.scannedAt && (
                  <div className="text-xs text-ink-500 mt-1">
                    Scanned at: {new Date(result.scan.scannedAt).toLocaleString()}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-center gap-2 text-lg font-bold text-rose-700">
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                  {RESULT_LABELS[result.result] || result.result || 'Error'}
                </div>
                {result.message && (
                  <div className="text-sm text-rose-700 mt-2 flex items-start justify-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{result.message}</span>
                  </div>
                )}
            {result.result === 'REJECTED_VENUE_MISMATCH' && (
              <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-center">
                <div className="flex items-center justify-center gap-2 text-sm font-bold text-amber-800">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  This is not the venue you are supposed to scan.
                </div>
                <div className="text-sm text-amber-700 mt-2">
                  Please move to your assigned venue and scan again.
                </div>
              </div>
            )}
            {result.result === 'REJECTED_VENUE_MISMATCH' && result.allAssignedVenues && result.allAssignedVenues.length > 0 && (
              <div className="mt-3 rounded-lg border border-primary-200 bg-primary-50 p-3 text-left">
                <div className="flex items-center gap-2 text-xs font-bold text-primary-800 uppercase tracking-wide">
                  <MapPin className="w-3.5 h-3.5" /> Your assigned venues
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
            {result.locationWarning && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <div className="flex-1 text-left">
                    <div className="font-medium text-amber-800">Location Warning</div>
                    <div className="text-xs text-amber-700 mt-1">{result.locationWarning}</div>
                    <div className="text-xs text-amber-600 mt-1">
                      This scan has been flagged for the exam officer to review.
                    </div>
                  </div>
                </div>
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
              </>
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
    </>
  );
};
