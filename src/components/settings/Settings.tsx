import React, { useState, memo } from 'react';
import type { PetProfile, PetEvent } from '../../types';
import { getAllEvents } from '../../store/db';
import type { AppSettings } from '../../store/db';

interface SettingsProps {
  pet: PetProfile;
  settings: AppSettings;
  onSettingsChange: (updates: Partial<AppSettings>) => void;
  onResetData: () => void;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2
      className="text-xs font-semibold uppercase tracking-widest px-4 pb-1 pt-5"
      style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}
    >
      {title}
    </h2>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-3"
      style={{ borderBottom: '1px solid rgba(245,240,232,0.05)' }}
    >
      <div className="flex flex-col flex-1">
        <span className="text-sm" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}>
          {label}
        </span>
        {description && (
          <span className="text-xs" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', marginTop: 2 }}>
            {description}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => onChange(!value)}
      aria-pressed={value}
      aria-label={label}
      className="rounded-full shrink-0 transition-all duration-200"
      style={{
        width: 48, height: 28,
        background: value ? 'var(--color-accent)' : 'var(--color-surface)',
        border: '1px solid rgba(245,240,232,0.12)',
        position: 'relative',
      }}
    >
      <span
        className="absolute rounded-full transition-all duration-200"
        style={{ width: 20, height: 20, background: 'white', top: 3, left: value ? 25 : 3 }}
      />
    </button>
  );
}

function StatBadge({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl"
      style={{ background: 'var(--color-surface-overlay)' }}
    >
      <span
        className="text-lg"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
      >
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>
        {label}
      </span>
    </div>
  );
}

function PetProfileCard({ pet }: { pet: PetProfile }) {
  const ageYears = (pet.ageMonths / 12).toFixed(1);
  const mealTimesFormatted = pet.mealTimes.map((h) => {
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    const ampm = hh < 12 ? 'AM' : 'PM';
    const dh = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
    return `${dh}:${mm.toString().padStart(2, '0')} ${ampm}`;
  }).join(', ');

  return (
    <div
      className="mx-4 rounded-2xl overflow-hidden"
      style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(245,240,232,0.06)' }}
    >
      <div
        className="px-4 py-4 flex items-center gap-4"
        style={{ borderBottom: '1px solid rgba(245,240,232,0.05)' }}
      >
        <div
          className="flex items-center justify-center rounded-2xl shrink-0"
          style={{ width: 56, height: 56, background: 'var(--color-surface-overlay)', fontSize: 28 }}
        >
          {pet.species === 'dog' ? '🐕' : '🐈'}
        </div>
        <div>
          <div className="text-xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
            {pet.name}
          </div>
          <div className="text-sm" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
            {pet.breed}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 p-3">
        <StatBadge label="Age" value={`${ageYears}y`} />
        <StatBadge label="Weight" value={`${pet.weightKg}kg`} />
        <StatBadge label="Meals" value={pet.mealTimes.length} />
      </div>

      <div className="px-4 pb-3 flex flex-wrap gap-2">
        {pet.neutered && (
          <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--color-surface-overlay)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>
            Neutered
          </span>
        )}
        <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--color-surface-overlay)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>
          {pet.indoor ? 'Indoor' : 'Outdoor'}
        </span>
        <span className="text-[11px] px-2 py-0.5 rounded-full capitalize" style={{ background: 'var(--color-surface-overlay)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>
          {pet.dietType} food
        </span>
      </div>

      <div
        className="px-4 pb-3 text-xs"
        style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}
      >
        Meal times: {mealTimesFormatted}
      </div>
    </div>
  );
}

const Settings = memo(function Settings({
  pet,
  settings,
  onSettingsChange,
  onResetData,
}: SettingsProps) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    try {
      const events: PetEvent[] = await getAllEvents(pet.id);
      const data = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        pet,
        events,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pawclock-${pet.name.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div
      className="flex flex-col pb-8"
      style={{ minHeight: '100%' }}
      role="main"
      aria-label="Settings"
    >
      {/* Header */}
      <div
        className="px-4 pt-6 pb-4"
        style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}
      >
        <h1
          className="text-2xl"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
        >
          Settings
        </h1>
      </div>

      {/* Pet profile */}
      <SectionHeader title="Pet Profile" />
      <PetProfileCard pet={pet} />

      {/* Notifications */}
      <SectionHeader title="Notifications" />
      <div
        className="mx-4 rounded-2xl overflow-hidden"
        style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(245,240,232,0.06)' }}
      >
        <SettingRow label="Push Notifications" description="Get alerts before predicted bathroom events">
          <Toggle
            value={settings.notificationsEnabled}
            onChange={(v) => onSettingsChange({ notificationsEnabled: v })}
            label="Toggle push notifications"
          />
        </SettingRow>

        {settings.notificationsEnabled && (
          <div
            className="px-4 py-3"
            style={{ borderBottom: '1px solid rgba(245,240,232,0.05)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}>
                Notify before
              </span>
              <span
                className="text-base"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--color-accent)' }}
              >
                {settings.notifyMinutesBefore} min
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={60}
              step={5}
              value={settings.notifyMinutesBefore}
              onChange={(e) => onSettingsChange({ notifyMinutesBefore: Number(e.target.value) })}
              className="w-full"
              style={{ accentColor: 'var(--color-accent)' }}
              aria-label={`Notify ${settings.notifyMinutesBefore} minutes before`}
              aria-valuemin={5}
              aria-valuemax={60}
              aria-valuenow={settings.notifyMinutesBefore}
            />
            <div className="flex justify-between text-[10px] mt-1" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>
              <span>5 min</span>
              <span>60 min</span>
            </div>
          </div>
        )}
      </div>

      {/* Data */}
      <SectionHeader title="Data" />
      <div
        className="mx-4 rounded-2xl overflow-hidden"
        style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(245,240,232,0.06)' }}
      >
        <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(245,240,232,0.05)' }}>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full flex items-center gap-3 text-left"
            style={{ minHeight: 44, opacity: isExporting ? 0.6 : 1 }}
            aria-label="Export data as JSON"
          >
            <div
              className="flex items-center justify-center rounded-xl"
              style={{ width: 36, height: 36, background: 'var(--color-accent-dim)', color: 'var(--color-accent)', shrink: 0 } as React.CSSProperties}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M9 3v9M5 8l4 4 4-4M3 14h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}>
                {isExporting ? 'Exporting...' : 'Export Data (JSON)'}
              </span>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>
                All logged events and pet profile
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* About */}
      <SectionHeader title="About PawClock" />
      <div
        className="mx-4 rounded-2xl overflow-hidden"
        style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(245,240,232,0.06)' }}
      >
        <div className="px-4 py-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>Version</span>
            <span className="text-sm" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>0.1.0</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>Engine</span>
            <span className="text-sm" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>Gamma-Dirichlet-Multinomial</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>Storage</span>
            <span className="text-sm" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>Local IndexedDB only</span>
          </div>
        </div>
        <div
          className="px-4 py-3 text-xs"
          style={{
            color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-body)',
            borderTop: '1px solid rgba(245,240,232,0.05)',
            lineHeight: 1.6,
          }}
        >
          PawClock uses Bayesian statistical models to predict biological cycles. Predictions improve with more logged events. Not a substitute for veterinary advice.
        </div>
      </div>

      {/* Danger zone */}
      <SectionHeader title="Danger Zone" />
      <div className="mx-4">
        {!showResetConfirm ? (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="w-full rounded-2xl py-3 text-sm font-medium"
            style={{
              background: 'rgba(196,91,91,0.08)',
              border: '1px solid rgba(196,91,91,0.2)',
              color: 'var(--color-danger)',
              fontFamily: 'var(--font-body)',
              minHeight: 52,
            }}
            aria-label="Reset all data"
          >
            Reset All Data
          </button>
        ) : (
          <div
            className="rounded-2xl p-4 flex flex-col gap-3"
            style={{
              background: 'rgba(196,91,91,0.08)',
              border: '1px solid rgba(196,91,91,0.3)',
            }}
          >
            <p className="text-sm" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}>
              This will permanently delete all events, the pet profile, and reset the prediction model. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 rounded-xl py-2 text-sm font-medium"
                style={{
                  background: 'var(--color-surface-raised)',
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-body)',
                  minHeight: 44,
                }}
                aria-label="Cancel reset"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowResetConfirm(false); onResetData(); }}
                className="flex-1 rounded-xl py-2 text-sm font-bold"
                style={{
                  background: 'var(--color-danger)',
                  color: 'white',
                  fontFamily: 'var(--font-body)',
                  minHeight: 44,
                }}
                aria-label="Confirm data reset"
              >
                Yes, Reset
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom padding for nav */}
      <div style={{ height: 100 }} />
    </div>
  );
});

export default Settings;
