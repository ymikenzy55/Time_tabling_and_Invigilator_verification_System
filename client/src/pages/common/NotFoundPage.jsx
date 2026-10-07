import { Link, useLocation } from 'react-router-dom';
import { Lock } from 'lucide-react';

export const NotFoundPage = () => {
  const location = useLocation();
  const isUnauthorized = location.state?.reason === 'not-authorized';

  return (
    <div className="min-h-screen grid place-items-center bg-surface-muted p-6">
      <div className="panel p-10 text-center max-w-md">
        {isUnauthorized ? (
          <>
            <div className="w-14 h-14 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 grid place-items-center mx-auto mb-4">
              <Lock className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-ink-900">Access Restricted</h1>
            <p className="mt-2 text-sm text-ink-500">
              You must be a registered invigilator and logged in to scan QR codes.
              If you believe this is an error, please contact the Examination Office.
            </p>
            <Link to="/login" className="btn-primary mt-6 inline-flex">Sign in</Link>
          </>
        ) : (
          <>
            <div className="text-5xl font-bold text-primary-600">404</div>
            <h1 className="mt-2 text-xl font-bold text-ink-900">Page not found</h1>
            <p className="mt-1 text-sm text-ink-500">
              The page you are looking for does not exist or has been moved.
            </p>
            <Link to="/dashboard" className="btn-primary mt-6 inline-flex">Back to dashboard</Link>
          </>
        )}
      </div>
    </div>
  );
};
