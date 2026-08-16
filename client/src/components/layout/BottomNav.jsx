import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ScanLine, MoreHorizontal, X, Grid2x2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuth } from '@/context/AuthContext';
import { bottomNavItems } from '@/config/nav';

/**
 * Mobile-only bottom navigation bar.
 * - Shows 3-4 primary items as icon + label tabs
 * - Scan QR (for invigilators) is a raised, prominent center button
 * - A "More" button opens a slide-up sheet with overflow items
 * - No overlays on tab switches — the sheet is dismissible and never blocks route changes
 */
export const BottomNav = () => {
  const { user } = useAuth();
  const { primary, overflow, scanItem } = bottomNavItems(user?.role);
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();

  const isMoreActive = overflow.some((item) => location.pathname === item.to);

  return (
    <>
      {/* Slide-up "More" sheet */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl border-t border-surface-border shadow-2xl pb-safe animate-slide-up">
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
              <span className="text-sm font-bold text-ink-900">More</span>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-1.5 rounded-md hover:bg-surface-subtle text-ink-500"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1 p-3 max-h-[50vh] overflow-y-auto">
              {overflow.map((item) => {
                const Icon = item.icon || Grid2x2;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMoreOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium transition-colors',
                        isActive
                          ? 'bg-primary-50 text-primary-800'
                          : 'text-ink-600 hover:bg-surface-subtle'
                      )
                    }
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-center leading-tight line-clamp-2">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom navigation bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white border-t border-surface-border pb-safe">
        <div className="flex items-stretch justify-around h-16">
          {/* Primary items — first half */}
          {primary.slice(0, 2).map((item) => (
            <BottomTab key={item.to} item={item} />
          ))}

          {/* Center: Scan QR prominent button (invigilators) OR a primary item */}
          {scanItem ? (
            <NavLink
              to={scanItem.to}
              className="flex flex-col items-center justify-start relative -mt-5"
              aria-label="Scan QR"
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'w-12 h-12 rounded-full grid place-items-center shadow-lg ring-4 ring-white transition-colors',
                      isActive
                        ? 'bg-primary-700 text-white'
                        : 'bg-primary-600 text-white'
                    )}
                  >
                    <ScanLine className="w-6 h-6" />
                  </span>
                  <span
                    className={cn(
                      'text-[11px] font-bold mt-0.5 leading-none',
                      isActive ? 'text-primary-800' : 'text-primary-700'
                    )}
                  >
                    Scan
                  </span>
                </>
              )}
            </NavLink>
          ) : (
            primary[2] && <BottomTab key={primary[2].to} item={primary[2]} />
          )}

          {/* Primary items — second half */}
          {primary.slice(scanItem ? 2 : 3).map((item) => (
            <BottomTab key={item.to} item={item} />
          ))}

          {/* More button */}
          {overflow.length > 0 && (
            <button
              onClick={() => setMoreOpen(true)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 transition-colors',
                isMoreActive
                  ? 'text-primary-800 font-bold'
                  : 'text-ink-500 hover:text-ink-700'
              )}
              aria-label="More navigation"
            >
              <MoreHorizontal
                className={cn('w-5 h-5', isMoreActive && 'text-primary-600')}
              />
              <span className="text-[11px] font-medium leading-none">More</span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
};

const BottomTab = ({ item }) => {
  const Icon = item.icon;
  const label = item.shortLabel || item.label;
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        cn(
          'flex flex-col items-center justify-center gap-1 flex-1 min-w-0 transition-colors',
          isActive
            ? 'text-primary-800 font-bold'
            : 'text-ink-500 hover:text-ink-700'
        )
      }
    >
      {({ isActive }) => (
        <>
          {Icon && (
            <Icon
              className={cn(
                'w-5 h-5 shrink-0',
                isActive ? 'text-primary-600' : 'text-ink-400'
              )}
            />
          )}
          <span className="text-[11px] font-medium leading-none truncate max-w-full px-0.5">
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
};
