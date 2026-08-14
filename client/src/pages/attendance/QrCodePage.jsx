import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { Loader2, QrCode } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { attendanceApi } from '@/features/attendance/attendanceApi';

export const QrCodePage = () => {
  const { invigilationId } = useParams();
  const [dataUrl, setDataUrl] = useState('');

  const query = useQuery({
    queryKey: ['attendance', 'qr', invigilationId],
    queryFn: () => attendanceApi.generateQr(invigilationId),
    enabled: !!invigilationId,
  });

  const { token, link, invigilation } = query.data || {};

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    QRCode.toDataURL(link || token, { width: 280, margin: 2 })
      .then((url) => { if (!cancelled) setDataUrl(url); })
      .catch(() => { if (!cancelled) setDataUrl(''); });
    return () => { cancelled = true; };
  }, [token, link]);

  return (
    <>
      <PageHeader
        title="Attendance QR Code"
        description="Show this code to the assigned invigilator to scan."
      />

      <div className="panel p-6 max-w-md mx-auto text-center">
        {query.isLoading ? (
          <div className="w-[280px] h-[280px] mx-auto rounded-lg bg-slate-200/80 animate-pulse" />
        ) : query.isError ? (
          <div className="text-sm text-rose-600">{query.error?.message || 'Failed to load QR code.'}</div>
        ) : (
          <>
            <div className="mb-4">
              <div className="text-sm font-medium text-ink-900">{invigilation?.examinationSession?.name}</div>
              <div className="text-xs text-ink-500">{invigilation?.course?.code} — {invigilation?.course?.title}</div>
            </div>
            {dataUrl ? (
              <img src={dataUrl} alt="Attendance QR" className="mx-auto rounded-lg border border-surface-border" />
            ) : (
              <div className="w-[280px] h-[280px] mx-auto bg-surface-subtle rounded-lg grid place-items-center text-ink-400">
                <QrCode className="w-12 h-12" />
              </div>
            )}
            <div className="mt-4 text-xs text-ink-500 break-all">{token}</div>
            <div className="mt-4 text-xs text-ink-400">
              The QR code refreshes automatically every 8 hours. Ask the invigilator to scan it within the attendance window.
            </div>
          </>
        )}
      </div>
    </>
  );
};
