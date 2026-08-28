import { Outlet } from 'react-router-dom';

const BACKGROUND_IMAGE = '/assets/images/uenr-login.webp';
const LOGO_IMAGE = '/assets/images/uenrLogo.png';

export const AuthLayout = () => {
  return (
    <div className="relative min-h-screen text-white">
      <div className="absolute inset-0">
        <img
          src={BACKGROUND_IMAGE}
          alt="Examination hall"
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm" />
      </div>

      <div className="relative z-10 min-h-screen font-sans">
        {/* Form — centered in the viewport */}
        <div className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-10">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-[0_8px_30px_rgba(15,23,42,0.25)] border border-surface-border">
            {/* Green header */}
            <div className="relative bg-chrome px-6 pt-8 pb-20 text-center">
              <div className="mx-auto h-14 w-14 rounded-lg bg-white grid place-items-center border border-surface-border">
                <img src={LOGO_IMAGE} alt="UENR" className="h-10 w-10 object-contain" />
              </div>
              <h1 className="mt-3 text-lg sm:text-xl font-bold leading-tight text-white tracking-wide">Examination Manager</h1>
              <p className="text-[11px] sm:text-xs text-chrome-text leading-tight">University of Energy and Natural Resources</p>
            </div>

            {/* White card overlapping the header */}
            <div className="relative z-10 -mt-12 px-4 sm:px-6 pb-8">
              <div className="rounded-lg bg-white px-6 py-7 sm:px-8 text-ink-900 border border-surface-border min-h-[420px]">
                <Outlet />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
