import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { cn } from '@/lib/cn';

export const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-surface-muted">
      <Topbar onToggleSidebar={() => setSidebarOpen((v) => !v)} sidebarOpen={sidebarOpen} />
      <Sidebar open={sidebarOpen} />
      <div
        className={cn(
          'transition-[padding] duration-300 ease-in-out',
          sidebarOpen ? 'lg:pl-64' : 'lg:pl-16'
        )}
      >
        <main className="px-4 py-5 sm:px-6 sm:py-6 max-w-[1440px] mx-auto pb-24 lg:pb-6">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  );
};
