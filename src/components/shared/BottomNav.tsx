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
      className="sticky bottom-0 z-40 px-3 pt-2"
      style={{
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)',
        background: 'linear-gradient(180deg, rgba(245,237,229,0) 0%, rgba(245,237,229,0.78) 34%, rgba(245,237,229,0.96) 100%)',
      }}
      aria-label="Main navigation"
    >
      <div
        className="mx-auto flex items-stretch gap-2 rounded-[30px] p-2"
        style={{
          background: 'rgba(255,255,255,0.86)',
          border: '1px solid rgba(255,255,255,0.82)',
          boxShadow: 'var(--shadow-lg)',
          backdropFilter: 'blur(20px) saturate(1.1)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.1)',
        }}
      >
        {tabs.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              type="button"
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className="btn-tactile flex min-h-[64px] flex-1 items-center justify-center rounded-[24px] px-3 py-3"
              style={{
                background: isActive ? 'rgba(235,125,98,0.12)' : 'transparent',
                color: isActive ? 'var(--color-accent)' : 'var(--color-text-muted)',
                boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                border: `1px solid ${isActive ? 'rgba(235,125,98,0.16)' : 'transparent'}`,
              }}
            >
              <div className="flex flex-col items-center gap-1">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.9)' : 'transparent',
                    transform: isActive ? 'translateY(-1px)' : 'none',
                  }}
                >
                  <Icon />
                </div>
                <span
                  className="text-[11px] font-semibold uppercase tracking-[0.12em]"
                  style={{ opacity: isActive ? 1 : 0.86 }}
                >
                  {label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
});

export default BottomNav;
