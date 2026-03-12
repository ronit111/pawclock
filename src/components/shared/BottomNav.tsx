import React, { memo } from 'react';

export type NavTab = 'dashboard' | 'history' | 'settings';

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

const DashboardIcon = () => (
  <svg width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <rect x="2" y="2" width="8" height="8" rx="2" fill="currentColor" opacity="0.9" />
    <rect x="12" y="2" width="8" height="8" rx="2" fill="currentColor" opacity="0.9" />
    <rect x="2" y="12" width="8" height="8" rx="2" fill="currentColor" opacity="0.9" />
    <rect x="12" y="12" width="8" height="3.5" rx="1.5" fill="currentColor" opacity="0.9" />
    <rect x="16.5" y="17" width="3.5" height="3" rx="1.5" fill="currentColor" opacity="0.9" />
  </svg>
);

const HistoryIcon = () => (
  <svg width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="8.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <path d="M11 6.5V11.5L14.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 7.5C5.2 5.2 7.9 3.5 11 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M4 7.5L3 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M4 7.5L6.5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden="true">
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
      className="sticky bottom-0 z-40"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'linear-gradient(180deg, rgba(246,239,231,0) 0%, rgba(246,239,231,0.92) 40%, rgba(246,239,231,0.98) 100%)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-[860px] items-stretch border-t px-4 py-1" style={{ borderColor: 'rgba(127,100,76,0.08)' }}>
        {tabs.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              type="button"
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className="btn-tactile flex flex-1 flex-col items-center gap-1 px-3 py-2.5"
              style={{
                color: isActive ? 'var(--color-accent)' : 'var(--color-text-muted)',
              }}
            >
              <Icon />
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.08em]"
                style={{ opacity: isActive ? 1 : 0.7 }}
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
