import React, { memo, useState } from 'react';
import type { PetEvent, PetProfile } from '../../types';
import { getAllEvents } from '../../store/db';
import type { AppSettings } from '../../store/db';

interface SettingsProps {
  pet: PetProfile;
  settings: AppSettings;
  onSettingsChange: (updates: Partial<AppSettings>) => void;
  onResetData: () => void;
}

function SectionIntro({
  eyebrow,
  title,
  aside,
}: {
  eyebrow: string;
  title: string;
  aside?: string;
}) {
  return (
    <div className="section-head">
      <div className="flex flex-col gap-1">
        <div className="section-label">{eyebrow}</div>
        <h2 className="section-title">{title}</h2>
      </div>
      {aside ? <div className="info-pill">{aside}</div> : null}
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
  border = true,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  border?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 px-5 py-4"
      style={{ borderBottom: border ? '1px solid rgba(127,100,76,0.08)' : 'none' }}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[15px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {label}
        </span>
        {description ? (
          <span className="text-sm leading-6" style={{ color: 'var(--color-text-secondary)' }}>
            {description}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      aria-pressed={value}
      aria-label={label}
      type="button"
      className="toggle-switch btn-tactile shrink-0"
      data-active={value}
    >
      <span className="toggle-thumb" />
    </button>
  );
}

function StatBadge({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric-card p-4">
      <span className="metric-label">{label}</span>
      <span className="metric-value text-[1.7rem]">{value}</span>
    </div>
  );
}

function PetProfileCard({ pet }: { pet: PetProfile }) {
  const ageYears = (pet.ageMonths / 12).toFixed(1);
  const mealTimesFormatted = pet.mealTimes
    .map((hour) => {
      const hh = Math.floor(hour);
      const mm = Math.round((hour - hh) * 60);
      const ampm = hh < 12 ? 'AM' : 'PM';
      const displayHour = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
      return `${displayHour}:${mm.toString().padStart(2, '0')} ${ampm}`;
    })
    .join(', ');

  return (
    <section className="surface-card-hero overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="icon-badge"
              style={{
                width: 64,
                height: 64,
                borderRadius: 22,
                background: pet.species === 'dog' ? 'var(--color-pee-soft)' : 'var(--color-sleep-soft)',
                fontSize: 32,
              }}
            >
              {pet.species === 'dog' ? '🐕' : '🐈'}
            </div>
            <div className="flex flex-col gap-1">
              <div className="page-title text-[2rem]">{pet.name}</div>
              <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {pet.breed}
              </div>
            </div>
          </div>

          <div className="info-pill capitalize">{pet.species}</div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <StatBadge label="Age" value={`${ageYears}y`} />
          <StatBadge label="Weight" value={`${pet.weightKg}kg`} />
          <StatBadge label="Meals" value={pet.mealTimes.length} />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {pet.neutered ? (
            <span className="info-pill" style={{ background: 'rgba(255,255,255,0.84)' }}>
              Neutered
            </span>
          ) : null}
          <span className="info-pill" style={{ background: 'rgba(255,255,255,0.84)' }}>
            {pet.indoor ? 'Indoor' : 'Outdoor'}
          </span>
          <span className="info-pill capitalize" style={{ background: 'rgba(255,255,255,0.84)' }}>
            {pet.dietType} food
          </span>
          <span className="info-pill capitalize" style={{ background: 'rgba(255,255,255,0.84)' }}>
            {pet.sizeClass}
          </span>
        </div>
      </div>

      <div className="border-t px-6 py-4" style={{ borderColor: 'rgba(127,100,76,0.08)' }}>
        <div className="metric-label">Meal times</div>
        <div className="mt-2 text-sm leading-6" style={{ color: 'var(--color-text-secondary)' }}>
          {mealTimesFormatted}
        </div>
      </div>
    </section>
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
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `pawclock-${pet.name.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="page-scroll page-scroll--tight" role="main" aria-label="Settings">
      <section className="surface-card-hero animate-entrance animate-entrance-1 p-6">
        <div className="flex flex-col gap-3">
          <div className="eyebrow-pill w-fit" style={{ color: 'var(--color-accent)' }}>
            Preferences
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="page-title">
              Product <em>settings</em>
            </h1>
            <p className="page-subtitle">
              Tune notifications, review profile details, export your data, and keep the app running the way you want.
            </p>
          </div>
        </div>
      </section>

      <section className="section-stack animate-entrance animate-entrance-2">
        <SectionIntro eyebrow="Pet profile" title="Current companion" />
        <PetProfileCard pet={pet} />
      </section>

      <section className="section-stack animate-entrance animate-entrance-3">
        <SectionIntro eyebrow="Notifications" title="Reminder behavior" />
        <div className="surface-card overflow-hidden">
          <SettingRow
            label="Push notifications"
            description="Get reminded before the next predicted bathroom window."
            border={!settings.notificationsEnabled}
          >
            <Toggle
              value={settings.notificationsEnabled}
              onChange={(value) => onSettingsChange({ notificationsEnabled: value })}
              label="Toggle push notifications"
            />
          </SettingRow>

          {settings.notificationsEnabled ? (
            <div className="px-5 py-4">
              <div className="surface-card-inset p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="metric-label">Notify before</span>
                    <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      Choose how much lead time feels useful.
                    </span>
                  </div>
                  <div className="font-data text-[1.8rem]" style={{ color: 'var(--color-accent)' }}>
                    {settings.notifyMinutesBefore}
                  </div>
                </div>

                <input
                  type="range"
                  min={5}
                  max={60}
                  step={5}
                  value={settings.notifyMinutesBefore}
                  onChange={(e) => onSettingsChange({ notifyMinutesBefore: Number(e.target.value) })}
                  className="mt-5 w-full"
                  style={{ accentColor: 'var(--color-accent)' }}
                  aria-label={`Notify ${settings.notifyMinutesBefore} minutes before`}
                  aria-valuemin={5}
                  aria-valuemax={60}
                  aria-valuenow={settings.notifyMinutesBefore}
                />

                <div className="mt-2 flex justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  <span>5 min</span>
                  <span>60 min</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="section-stack animate-entrance animate-entrance-4">
        <SectionIntro eyebrow="Data" title="Export and review" />
        <div className="surface-card overflow-hidden">
          <button
            onClick={handleExport}
            disabled={isExporting}
            type="button"
            className="btn-tactile flex w-full items-center gap-4 px-5 py-5 text-left"
            style={{ opacity: isExporting ? 0.7 : 1 }}
            aria-label="Export data as JSON"
          >
            <div
              className="icon-badge shrink-0"
              style={{ background: 'var(--color-accent-dim)', color: 'var(--color-accent)' }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M9 3v9M5 8l4 4 4-4M3 14h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[15px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {isExporting ? 'Exporting data...' : 'Export all data as JSON'}
              </span>
              <span className="text-sm leading-6" style={{ color: 'var(--color-text-secondary)' }}>
                Download your pet profile and every logged event in a single file.
              </span>
            </div>
          </button>
        </div>
      </section>

      <section className="section-stack animate-entrance animate-entrance-5">
        <SectionIntro eyebrow="About PawClock" title="What powers the predictions" aside="v0.1.0" />
        <div className="surface-card overflow-hidden">
          <SettingRow label="Prediction engine" description="Gamma-Dirichlet-Multinomial cycle modeling" border>
            <div className="info-pill">Bayesian</div>
          </SettingRow>
          <SettingRow label="Storage" description="All data stays in local IndexedDB on this device" border>
            <div className="info-pill">Private</div>
          </SettingRow>
          <SettingRow label="Guidance" description="Predictions improve as more events are logged" border={false}>
            <div className="info-pill">Learns over time</div>
          </SettingRow>
          <div className="border-t px-5 py-4 text-sm leading-6" style={{ borderColor: 'rgba(127,100,76,0.08)', color: 'var(--color-text-secondary)' }}>
            PawClock uses statistical patterns to estimate likely biological cycles. It is not a substitute for veterinary care or diagnosis.
          </div>
        </div>
      </section>

      <section className="section-stack">
        <SectionIntro eyebrow="Danger zone" title="Reset the local app state" />
        {!showResetConfirm ? (
          <button
            onClick={() => setShowResetConfirm(true)}
            type="button"
            className="ghost-button btn-tactile w-full"
            style={{
              color: 'var(--color-danger)',
              background: 'rgba(207,107,99,0.08)',
              border: '1px solid rgba(207,107,99,0.18)',
            }}
            aria-label="Reset all data"
          >
            Reset all data
          </button>
        ) : (
          <div
            className="surface-card p-5"
            style={{
              background: 'linear-gradient(180deg, rgba(255,244,243,0.96), rgba(255,248,247,0.96))',
              borderColor: 'rgba(207,107,99,0.22)',
            }}
          >
            <p className="text-sm leading-6" style={{ color: 'var(--color-text-secondary)' }}>
              This permanently deletes all events, the pet profile, and the model state stored on this device. It cannot be undone.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                type="button"
                className="secondary-button btn-tactile flex-1"
                aria-label="Cancel reset"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowResetConfirm(false);
                  onResetData();
                }}
                type="button"
                className="danger-button btn-tactile flex-1"
                aria-label="Confirm data reset"
              >
                Yes, reset
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
});

export default Settings;
