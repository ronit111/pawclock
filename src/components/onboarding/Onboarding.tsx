import { useState, memo } from 'react';
import type { Species, PetProfile, SizeClass, DietType } from '../../types';
import { DOG_BREEDS, CAT_BREEDS, isBrachycephalic } from '../../data/breeds';
import { generateId } from '../../store/db';

interface OnboardingProps {
  onComplete: (pet: PetProfile) => void;
}

interface FormData {
  name: string;
  species: Species | null;
  breed: string;
  ageMonths: number;
  weightKg: number;
  neutered: boolean;
  indoor: boolean;
  dietType: DietType;
  mealTimes: number[]; // decimal hours
}

const INITIAL_FORM: FormData = {
  name: '',
  species: null,
  breed: '',
  ageMonths: 24,
  weightKg: 4.0,
  neutered: true,
  indoor: true,
  dietType: 'dry',
  mealTimes: [7.5, 18.0],
};

const TOTAL_STEPS = 6;

function sizeClassFromWeight(kg: number, species: Species): SizeClass {
  if (species === 'cat') {
    if (kg < 2.5) return 'small';
    if (kg < 5.5) return 'medium';
    return 'large';
  }
  if (kg < 3) return 'teacup';
  if (kg < 10) return 'small';
  if (kg < 25) return 'medium';
  if (kg < 45) return 'large';
  return 'giant';
}

function formatDecimalHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  const ampm = hh < 12 ? 'AM' : 'PM';
  const displayH = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${displayH}:${mm.toString().padStart(2, '0')} ${ampm}`;
}

function timeInputValue(h: number): string {
  const hh = Math.floor(h).toString().padStart(2, '0');
  const mm = Math.round((h - Math.floor(h)) * 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

function parseTimeInput(val: string): number {
  const [hh, mm] = val.split(':').map(Number);
  return hh + mm / 60;
}

// ─── Step components ──────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center gap-8 py-10 px-6 text-center">
      {/* Logo/wordmark */}
      <div className="flex flex-col items-center gap-4">
        <div
          className="flex items-center justify-center rounded-3xl"
          style={{ width: 80, height: 80, background: 'var(--color-surface-raised)', border: '1px solid rgba(245,240,232,0.08)' }}
        >
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true">
            <path d="M22 6C22 6 12 17 12 27a10 10 0 0020 0C32 17 22 6 22 6z" fill="var(--color-pee)" opacity="0.3" />
            <path d="M22 6C22 6 16 14 16 22a6 6 0 0012 0C28 14 22 6 22 6z" fill="var(--color-pee)" opacity="0.7" />
            <circle cx="22" cy="10" r="2.5" fill="var(--color-sleep)" />
            <circle cx="28" cy="14" r="1.5" fill="var(--color-sleep)" opacity="0.7" />
            <circle cx="16" cy="14" r="1" fill="var(--color-poop)" opacity="0.7" />
          </svg>
        </div>

        <h1
          className="text-3xl font-medium"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
        >
          PawClock
        </h1>
        <p
          className="text-base max-w-[280px]"
          style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', lineHeight: 1.6 }}
        >
          Learn your pet's natural rhythms. Predict sleep, bathroom, and meal needs before they happen.
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-[320px]">
        <div
          className="rounded-2xl px-4 py-3.5 flex items-center gap-3"
          style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(245,240,232,0.04)' }}
        >
          <span style={{ color: 'var(--color-sleep)' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M16 11A7 7 0 119 4a5 5 0 107 7z" fill="currentColor" /></svg>
          </span>
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
            Track sleep patterns automatically
          </span>
        </div>
        <div
          className="rounded-2xl px-4 py-3.5 flex items-center gap-3"
          style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(245,240,232,0.04)' }}
        >
          <span style={{ color: 'var(--color-pee)' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2C10 2 6 8 6 13a4 4 0 008 0C14 8 10 2 10 2z" fill="currentColor" /></svg>
          </span>
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
            Predict bathroom windows before they're urgent
          </span>
        </div>
        <div
          className="rounded-2xl px-4 py-3.5 flex items-center gap-3"
          style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(245,240,232,0.04)' }}
        >
          <span style={{ color: 'var(--color-success)' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 10l5 5 9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
            No cloud. All data stays on your device
          </span>
        </div>
      </div>

      <button
        onClick={onNext}
        className="w-full max-w-[320px] rounded-2xl font-semibold text-base"
        style={{
          minHeight: 52,
          background: 'var(--color-accent)',
          color: 'var(--color-surface)',
          fontFamily: 'var(--font-body)',
        }}
        aria-label="Get started"
      >
        Get Started
      </button>
    </div>
  );
}

function SpeciesStep({
  value,
  onChange,
}: {
  value: Species | null;
  onChange: (s: Species) => void;
}) {
  return (
    <div className="flex flex-col gap-8 px-6">
      <div>
        <h2
          className="text-2xl mb-2"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
        >
          What kind of pet?
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
          We'll use species-specific biological priors.
        </p>
      </div>
      <div className="flex gap-4">
        {(['dog', 'cat'] as Species[]).map((s) => (
          <button
            key={s}
            onClick={() => onChange(s)}
            aria-pressed={value === s}
            className="flex-1 flex flex-col items-center justify-center gap-3 rounded-2xl transition-all duration-200"
            style={{
              minHeight: 150,
              background: value === s ? 'var(--color-surface-overlay)' : 'var(--color-surface-raised)',
              border: `2px solid ${value === s ? 'var(--color-accent)' : 'rgba(245,240,232,0.08)'}`,
              color: value === s ? 'var(--color-accent)' : 'var(--color-text-secondary)',
            }}
          >
            <span style={{ fontSize: 48 }}>{s === 'dog' ? '🐕' : '🐈'}</span>
            <span
              className="text-base font-semibold capitalize"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {s}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function BreedStep({
  species,
  value,
  onChange,
}: {
  species: Species;
  value: string;
  onChange: (b: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const breeds = species === 'dog' ? DOG_BREEDS : CAT_BREEDS;
  const filtered = query
    ? breeds.filter((b) => b.toLowerCase().includes(query.toLowerCase()))
    : breeds;

  return (
    <div className="flex flex-col gap-5 px-6">
      <div>
        <h2 className="text-2xl mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
          What breed?
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
          Breed affects physiological priors. "Mixed/Unknown" works great.
        </p>
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); }}
        placeholder="Search breed..."
        className="rounded-2xl px-4 py-3 text-base outline-none"
        style={{
          background: 'var(--color-surface-raised)',
          border: '1px solid rgba(245,240,232,0.1)',
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-body)',
          minHeight: 52,
        }}
        autoComplete="off"
        aria-label="Search breed"
      />
      <div
        className="flex flex-col overflow-y-auto rounded-2xl"
        style={{
          maxHeight: 260,
          background: 'var(--color-surface-raised)',
          border: '1px solid rgba(245,240,232,0.06)',
        }}
      >
        {filtered.slice(0, 20).map((b) => (
          <button
            key={b}
            onClick={() => { setQuery(b); onChange(b); }}
            className="text-left px-4 py-3 text-sm transition-colors duration-100"
            style={{
              color: value === b ? 'var(--color-accent)' : 'var(--color-text-primary)',
              background: value === b ? 'var(--color-surface-overlay)' : 'transparent',
              borderBottom: '1px solid rgba(245,240,232,0.04)',
              fontFamily: 'var(--font-body)',
              minHeight: 44,
            }}
            aria-pressed={value === b}
            aria-label={`Select breed: ${b}`}
          >
            {b}
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>
            No breeds match. You can type your own.
          </div>
        )}
      </div>
    </div>
  );
}

function DetailsStep({
  form,
  onChange,
}: {
  form: FormData;
  onChange: (updates: Partial<FormData>) => void;
}) {
  const ageYears = (form.ageMonths / 12).toFixed(1);

  return (
    <div className="flex flex-col gap-6 px-6">
      <div>
        <h2 className="text-2xl mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
          A few details
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
          These affect biological timing priors.
        </p>
      </div>

      {/* Age */}
      <div
        className="flex flex-col gap-3 rounded-2xl px-4 py-4"
        style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(245,240,232,0.04)' }}
      >
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>
            Age
          </label>
          <span className="text-base" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
            {ageYears} years ({form.ageMonths} mo)
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={240}
          value={form.ageMonths}
          onChange={(e) => onChange({ ageMonths: Number(e.target.value) })}
          className="w-full"
          style={{ accentColor: 'var(--color-accent)' }}
          aria-label={`Age: ${ageYears} years`}
          aria-valuemin={1}
          aria-valuemax={240}
          aria-valuenow={form.ageMonths}
        />
        <div className="flex justify-between text-[10px]" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>
          <span>1 month</span>
          <span>20 years</span>
        </div>
      </div>

      {/* Weight */}
      <div
        className="flex flex-col gap-3 rounded-2xl px-4 py-4"
        style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(245,240,232,0.04)' }}
      >
        <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>
          Weight
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={0.5}
            max={100}
            step={0.1}
            value={form.weightKg}
            onChange={(e) => onChange({ weightKg: parseFloat(e.target.value) || 0 })}
            className="rounded-xl px-4 py-3 text-base outline-none w-28"
            style={{
              background: 'var(--color-surface-overlay)',
              border: '1px solid rgba(245,240,232,0.1)',
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-display)',
              minHeight: 48,
            }}
            aria-label="Weight in kg"
          />
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>kg</span>
        </div>
      </div>

      {/* Toggles group */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(245,240,232,0.04)' }}
      >
        <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: '1px solid rgba(245,240,232,0.05)' }}>
          <span className="text-sm" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}>
            Neutered / Spayed
          </span>
          <button
            onClick={() => onChange({ neutered: !form.neutered })}
            aria-pressed={form.neutered}
            aria-label="Toggle neutered"
            className="rounded-full transition-all duration-200"
            style={{
              width: 48, height: 28,
              background: form.neutered ? 'var(--color-accent)' : 'var(--color-surface)',
              border: '1px solid rgba(245,240,232,0.12)',
              position: 'relative',
            }}
          >
            <span className="absolute rounded-full transition-all duration-200" style={{ width: 20, height: 20, background: 'white', top: 3, left: form.neutered ? 25 : 3 }} />
          </button>
        </div>
        <div className="flex items-center justify-between px-4 py-3.5">
          <span className="text-sm" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}>
            Indoor only
          </span>
          <button
            onClick={() => onChange({ indoor: !form.indoor })}
            aria-pressed={form.indoor}
            aria-label="Toggle indoor"
            className="rounded-full transition-all duration-200"
            style={{
              width: 48, height: 28,
              background: form.indoor ? 'var(--color-accent)' : 'var(--color-surface)',
              border: '1px solid rgba(245,240,232,0.12)',
              position: 'relative',
            }}
          >
            <span className="absolute rounded-full transition-all duration-200" style={{ width: 20, height: 20, background: 'white', top: 3, left: form.indoor ? 25 : 3 }} />
          </button>
        </div>
      </div>

      {/* Diet type */}
      <div className="flex flex-col gap-3">
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>
          Diet Type
        </span>
        <div className="flex gap-2.5 flex-wrap">
          {(['dry', 'wet', 'raw', 'mixed'] as DietType[]).map((d) => (
            <button
              key={d}
              onClick={() => onChange({ dietType: d })}
              aria-pressed={form.dietType === d}
              className="px-4 py-2.5 rounded-xl text-sm font-medium capitalize transition-all"
              style={{
                minHeight: 42,
                background: form.dietType === d ? 'var(--color-accent-dim)' : 'var(--color-surface-raised)',
                color: form.dietType === d ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                border: `1px solid ${form.dietType === d ? 'var(--color-accent)40' : 'rgba(245,240,232,0.06)'}`,
                fontFamily: 'var(--font-body)',
              }}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MealsStep({
  mealTimes,
  onChange,
}: {
  mealTimes: number[];
  onChange: (times: number[]) => void;
}) {
  function updateTime(index: number, val: string) {
    const updated = [...mealTimes];
    updated[index] = parseTimeInput(val);
    onChange(updated);
  }

  function addMeal() {
    if (mealTimes.length < 4) onChange([...mealTimes, 12.0]);
  }

  function removeMeal(index: number) {
    onChange(mealTimes.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-6 px-6">
      <div>
        <h2 className="text-2xl mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
          Meal schedule
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
          Meal timing predicts post-meal bathroom windows.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {mealTimes.map((t, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
            style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(245,240,232,0.04)' }}
          >
            <div className="flex items-center justify-center rounded-full" style={{ width: 32, height: 32, background: 'var(--color-accent-dim)' }}>
              <span className="text-xs font-bold" style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-body)' }}>
                {i + 1}
              </span>
            </div>
            <div className="flex-1">
              <input
                type="time"
                value={timeInputValue(t)}
                onChange={(e) => updateTime(i, e.target.value)}
                className="text-base outline-none"
                style={{
                  background: 'transparent',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-display)',
                  colorScheme: 'dark',
                  border: 'none',
                  minHeight: 36,
                }}
                aria-label={`Meal ${i + 1} time`}
              />
              <div className="text-xs" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>
                {formatDecimalHour(t)}
              </div>
            </div>
            {mealTimes.length > 1 && (
              <button
                onClick={() => removeMeal(i)}
                className="p-2 rounded-full"
                style={{ color: 'var(--color-danger)', background: 'rgba(196,91,91,0.1)' }}
                aria-label={`Remove meal ${i + 1}`}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M4 8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        ))}

        {mealTimes.length < 4 && (
          <button
            onClick={addMeal}
            className="flex items-center gap-2 px-4 py-3.5 rounded-2xl text-sm"
            style={{
              background: 'var(--color-surface-raised)',
              border: '1px dashed rgba(245,240,232,0.12)',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
              minHeight: 52,
            }}
            aria-label="Add another meal time"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Add another meal
          </button>
        )}
      </div>
    </div>
  );
}

function NameStep({ name, onChange }: { name: string; onChange: (n: string) => void }) {
  return (
    <div className="flex flex-col gap-6 px-6">
      <div>
        <h2 className="text-2xl mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
          What's their name?
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
          The name that'll appear on your dashboard.
        </p>
      </div>
      <input
        type="text"
        value={name}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Luna, Max, Charlie..."
        className="rounded-2xl px-5 py-4 text-xl outline-none"
        style={{
          background: 'var(--color-surface-raised)',
          border: '1px solid rgba(245,240,232,0.1)',
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-display)',
          minHeight: 60,
        }}
        autoFocus
        aria-label="Pet name"
        autoComplete="off"
      />
    </div>
  );
}

function DoneStep({ name, onStart }: { name: string; onStart: () => void }) {
  return (
    <div className="flex flex-col items-center gap-8 py-10 px-6 text-center">
      <div
        className="flex items-center justify-center rounded-full"
        style={{ width: 80, height: 80, background: 'var(--color-success)', opacity: 0.9 }}
      >
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <path d="M8 20l9 9 16-16" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div>
        <h2 className="text-2xl mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
          {name ? `${name} is all set!` : 'All set!'}
        </h2>
        <p className="text-base max-w-[280px]" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', lineHeight: 1.6 }}>
          Start logging sleep, bathroom, and meal events. PawClock will learn{name ? ` ${name}'s` : ''} patterns in just a few days.
        </p>
      </div>

      <div
        className="rounded-2xl p-5 text-left w-full max-w-[320px]"
        style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(245,240,232,0.04)' }}
      >
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-body)' }}>
          Getting started
        </p>
        <ul className="flex flex-col gap-2">
          {[
            'Tap Sleep when your pet settles down',
            'Tap Wake when they get up',
            'Log Pee and Poop after bathroom trips',
            'Predictions improve after 3–5 days',
          ].map((tip, i) => (
            <li key={i} className="text-sm flex items-start gap-2" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
              <span style={{ color: 'var(--color-accent)', marginTop: 2 }}>·</span>
              {tip}
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={onStart}
        className="w-full max-w-[320px] rounded-2xl font-semibold text-base"
        style={{
          minHeight: 52,
          background: 'var(--color-accent)',
          color: 'var(--color-surface)',
          fontFamily: 'var(--font-body)',
        }}
        aria-label="Start using PawClock"
      >
        Start Logging
      </button>
    </div>
  );
}

// ─── Main Onboarding Wizard ───────────────────────────────────

const Onboarding = memo(function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);

  function updateForm(updates: Partial<FormData>) {
    setForm((prev) => ({ ...prev, ...updates }));
  }

  function canProceed(): boolean {
    switch (step) {
      case 0: return true;
      case 1: return form.species !== null;
      case 2: return form.breed.length > 1;
      case 3: return form.ageMonths > 0 && form.weightKg > 0;
      case 4: return form.mealTimes.length > 0;
      case 5: return form.name.trim().length > 0;
      default: return true;
    }
  }

  async function handleDone() {
    const species = form.species!;
    const sizeClass = sizeClassFromWeight(form.weightKg, species);
    const brachycephalic = isBrachycephalic(form.breed, species);

    const pet: PetProfile = {
      id: generateId(),
      name: form.name.trim(),
      species,
      breed: form.breed,
      sizeClass,
      ageMonths: form.ageMonths,
      weightKg: form.weightKg,
      neutered: form.neutered,
      indoor: form.indoor,
      brachycephalic,
      dietType: form.dietType,
      mealTimes: form.mealTimes,
      createdAt: Date.now(),
    };

    // Don't save to IDB here — the store handles persistence + model initialization
    onComplete(pet);
  }

  const stepContent = [
    <WelcomeStep key="welcome" onNext={() => setStep(1)} />,
    <SpeciesStep key="species" value={form.species} onChange={(s) => { updateForm({ species: s }); }} />,
    <BreedStep key="breed" species={form.species ?? 'cat'} value={form.breed} onChange={(b) => updateForm({ breed: b })} />,
    <DetailsStep key="details" form={form} onChange={updateForm} />,
    <MealsStep key="meals" mealTimes={form.mealTimes} onChange={(times) => updateForm({ mealTimes: times })} />,
    <NameStep key="name" name={form.name} onChange={(n) => updateForm({ name: n })} />,
    <DoneStep key="done" name={form.name} onStart={handleDone} />,
  ];

  const showProgress = step > 0 && step < 6;
  const showNext = step > 0 && step < 5;
  const showName = step === 5;

  return (
    <div
      className="flex flex-col min-h-dvh"
      style={{ background: 'var(--color-surface)' }}
    >
      {/* Progress header */}
      {showProgress && (
        <div
          className="flex items-center gap-3 px-6 pt-4 pb-2 shrink-0"
          style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
        >
          {step > 1 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="p-2 rounded-full"
              style={{ color: 'var(--color-text-secondary)', background: 'var(--color-surface-raised)', minWidth: 40, minHeight: 40 }}
              aria-label="Go back"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          {/* Progress dots */}
          <div className="flex gap-1.5 flex-1 justify-center">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  height: 4,
                  width: i === step - 1 ? 20 : 6,
                  background: i < step ? 'var(--color-accent)' : i === step - 1 ? 'var(--color-accent)' : 'rgba(245,240,232,0.15)',
                }}
              />
            ))}
          </div>
          <div style={{ minWidth: 40 }} />
        </div>
      )}

      {/* Step content */}
      <div className="flex-1 overflow-y-auto py-6">
        {stepContent[step]}
      </div>

      {/* Next button (for middle steps) */}
      {(showNext || showName) && (
        <div
          className="px-6 pb-6 shrink-0"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed()}
            className="w-full rounded-2xl font-semibold text-base transition-all duration-150"
            style={{
              minHeight: 52,
              background: canProceed() ? 'var(--color-accent)' : 'var(--color-surface-overlay)',
              color: canProceed() ? 'var(--color-surface)' : 'var(--color-text-muted)',
              fontFamily: 'var(--font-body)',
            }}
            aria-label="Continue to next step"
          >
            {showName ? 'Almost done →' : 'Continue'}
          </button>
        </div>
      )}

      {/* Step 0 has its own button, step 6 has its own button */}
    </div>
  );
});

export default Onboarding;
