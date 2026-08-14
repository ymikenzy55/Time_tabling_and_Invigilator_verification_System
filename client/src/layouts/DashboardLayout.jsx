import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { cn } from '@/lib/cn';

export const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-surface-muted">
      <Topbar onToggleSidebar={() => setSidebarOpen((v) => !v)} sidebarOpen={sidebarOpen} />
      <Sidebar open={sidebarOpen} />
      {/* Backdrop when sidebar overlays content (small screens) */}
      {sidebarOpen && (
        <div
          className="fixed left-0 right-0 top-14 bottom-0 z-20 bg-ink-900/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <div
        className={cn(
          'transition-[padding] duration-300 ease-in-out',
          sidebarOpen ? 'lg:pl-64' : 'lg:pl-16'
        )}
      >
        <main className="px-4 py-5 sm:px-6 sm:py-6 max-w-[1440px] mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
