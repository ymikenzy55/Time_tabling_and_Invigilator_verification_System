import { Link } from 'react-router-dom';

export const NotFoundPage = () => (
  <div className="min-h-screen grid place-items-center bg-surface-muted p-6">
    <div className="panel p-10 text-center max-w-md">
      <div className="text-5xl font-bold text-primary-600">404</div>
      <h1 className="mt-2 text-xl font-bold text-ink-900">Page not found</h1>
      <p className="mt-1 text-sm text-ink-500">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link to="/dashboard" className="btn-primary mt-6 inline-flex">Back to dashboard</Link>
    </div>
  </div>
);
