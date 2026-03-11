import React, { memo } from 'react';

export type NavTab = 'dashboard' | 'history' | 'settings';

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

const DashboardIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <rect x="2" y="2" width="8" height="8" rx="2" fill="currentColor" opacity="0.9" />
    <rect x="12" y="2" width="8" height="8" rx="2" fill="currentColor" opacity="0.9" />
    <rect x="2" y="12" width="8" height="8" rx="2" fill="currentColor" opacity="0.9" />
    <rect x="12" y="12" width="8" height="3.5" rx="1.5" fill="currentColor" opacity="0.9" />
    <rect x="16.5" y="17" width="3.5" height="3" rx="1.5" fill="currentColor" opacity="0.9" />
  </svg>
);

const HistoryIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="8.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <path d="M11 6.5V11.5L14.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 7.5C5.2 5.2 7.9 3.5 11 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M4 7.5L3 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M4 7.5L6.5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <path
      d="M11 2.5v2M11 17.5v2M2.5 11h2M17.5 11h2M4.7 4.7l1.4 1.4M15.9 15.9l1.4 1.4M4.7 17.3l1.4-1.4M15.9 6.1l1.4-1.4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const tabs: Array<{ id: NavTab; label: string; Icon: React.FC }> = [
  { id: 'dashboard', label: 'Dashboard', Icon: DashboardIcon },
  { id: 'history', label: 'History', Icon: HistoryIcon },
  { id: 'settings', label: 'Settings', Icon: SettingsIcon },
];

const BottomNav = memo(function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'rgba(15, 14, 12, 0.85)',
        backdropFilter: 'blur(20px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
        borderTop: '1px solid rgba(245, 240, 232, 0.06)',
      }}
      aria-label="Main navigation"
    >
      <div className="flex items-stretch justify-around">
        {tabs.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className="btn-tactile flex flex-col items-center justify-center gap-1 flex-1 py-3 relative"
              style={{
                color: isActive ? 'var(--color-accent)' : 'var(--color-text-muted)',
                minHeight: '60px',
              }}
            >
              {/* Active indicator dot */}
              {isActive && (
                <span
                  className="absolute top-2 w-1 h-1 rounded-full"
                  style={{
                    background: 'var(--color-accent)',
                    boxShadow: '0 0 8px var(--color-accent)',
                  }}
                />
              )}
              <span
                style={{
                  filter: isActive ? 'drop-shadow(0 0 8px var(--color-accent))' : 'none',
                  transition: 'filter 250ms ease, transform 250ms ease',
                  transform: isActive ? 'scale(1.1)' : 'scale(1)',
                }}
              >
                <Icon />
              </span>
              <span
                className="text-[10px] font-medium"
                style={{
                  fontFamily: 'var(--font-body)',
                  opacity: isActive ? 1 : 0.5,
                  letterSpacing: isActive ? '0.06em' : '0.03em',
                  transition: 'all 250ms ease',
                }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
});

export default BottomNav;
