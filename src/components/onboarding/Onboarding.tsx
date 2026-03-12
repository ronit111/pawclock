import { memo, useState, type ReactNode } from 'react';
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
  mealTimes: number[];
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

function StepIntro({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="eyebrow-pill w-fit">{eyebrow}</div>
      <div className="flex flex-col gap-2">
        <h2 className="page-title">{title}</h2>
        <p className="page-subtitle">{subtitle}</p>
      </div>
    </div>
  );
}

function SurfaceBlock({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`surface-card p-5 ${className}`}>{children}</div>;
}

function Toggle({
  value,
  onToggle,
  label,
}: {
  value: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={value}
      aria-label={label}
      className="toggle-switch btn-tactile shrink-0"
      data-active={value}
      type="button"
    >
      <span className="toggle-thumb" />
    </button>
  );
}

function SelectChip({
  active,
  onClick,
  children,
  tint,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  tint: string;
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      className="btn-tactile rounded-[18px] px-4 py-3 text-sm font-semibold capitalize"
      style={{
        background: active ? tint : 'rgba(255,255,255,0.72)',
        color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        border: `1px solid ${active ? 'rgba(127,100,76,0.22)' : 'rgba(127,100,76,0.1)'}`,
        boxShadow: active ? 'var(--shadow-sm)' : 'none',
      }}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  const features = [
    {
      title: 'Stay ahead of bathroom windows',
      text: 'See likely pee and poop timing before your pet starts pacing.',
      color: 'var(--color-pee-soft)',
      iconColor: 'var(--color-pee)',
      icon: (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <path d="M11 2.5C11 2.5 6.5 9 6.5 14a4.5 4.5 0 009 0C15.5 9 11 2.5 11 2.5z" fill="currentColor" />
        </svg>
      ),
    },
    {
      title: 'Learn sleep rhythms',
      text: 'Spot nap windows, likely wakeups, and day-to-day changes in rest.',
      color: 'var(--color-sleep-soft)',
      iconColor: 'var(--color-sleep)',
      icon: (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <path d="M17.5 11.5a7 7 0 11-5.5-6.8 5.2 5.2 0 105.5 6.8z" fill="currentColor" />
        </svg>
      ),
    },
    {
      title: 'Everything stays on-device',
      text: 'Private by default, with no account creation and no cloud sync required.',
      color: 'rgba(111,143,119,0.12)',
      iconColor: 'var(--color-success)',
      icon: (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <path d="M6 11.5l3.2 3.2L16 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-8">
      <div className="flex w-full max-w-[640px] flex-col gap-6">
        <div className="animate-entrance animate-entrance-1">
          <div className="flex flex-col gap-3">
            <h1 className="page-title" style={{ fontSize: 'clamp(2.2rem, 5vw, 3rem)' }}>
              Pet care that feels <em>one step ahead</em>.
            </h1>
            <p className="text-base leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Learn your pet&apos;s natural bathroom and sleep rhythms, then turn those patterns into calm, confident daily care.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 animate-entrance animate-entrance-2">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="surface-card-soft flex items-start gap-3 px-4 py-3"
            >
              <div className="icon-badge shrink-0" style={{ background: feature.color, color: feature.iconColor }}>
                {feature.icon}
              </div>
              <div className="flex flex-col">
                <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {feature.title}
                </div>
                <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {feature.text}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="animate-entrance animate-entrance-3">
          <button onClick={onNext} className="primary-button btn-tactile w-full" aria-label="Get started" type="button">
            Get started
          </button>
        </div>
      </div>
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
  const options: Array<{
    type: Species;
    title: string;
    copy: string;
    badge: string;
    tint: string;
  }> = [
    {
      type: 'dog',
      title: 'Dog',
      copy: 'Great for bathroom reminders, nap rhythms, and meal-linked predictions.',
      badge: 'Walking and backyard routines',
      tint: 'var(--color-pee-soft)',
    },
    {
      type: 'cat',
      title: 'Cat',
      copy: 'Useful for litter-box timing, sleep cycles, and indoor routine changes.',
      badge: 'Indoor pattern tracking',
      tint: 'var(--color-sleep-soft)',
    },
  ];

  return (
    <div className="flex flex-col gap-4 px-4 pb-4 pt-2">
      <StepIntro
        eyebrow="Step 1"
        title={<>What kind of pet are we learning?</>}
        subtitle="We use species-specific priors to make the first few predictions feel sensible instead of generic."
      />

      <div className="grid gap-4">
        {options.map((option) => {
          const active = value === option.type;
          return (
            <button
              key={option.type}
              onClick={() => onChange(option.type)}
              aria-pressed={active}
              type="button"
              className="surface-card btn-tactile flex items-start gap-4 p-5 text-left"
              style={{
                background: active
                  ? `linear-gradient(180deg, ${option.tint} 0%, rgba(255,255,255,0.98) 100%)`
                  : undefined,
                borderColor: active ? 'rgba(235,125,98,0.28)' : undefined,
                boxShadow: active ? 'var(--shadow-md)' : undefined,
                transform: active ? 'translateY(-1px)' : 'none',
              }}
            >
              <div
                className="icon-badge shrink-0"
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 20,
                  fontSize: 30,
                  background: active ? 'rgba(255,255,255,0.9)' : option.tint,
                }}
              >
                {option.type === 'dog' ? '🐕' : '🐈'}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {option.title}
                  </div>
                  <div
                    className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
                    style={{
                      background: active ? 'rgba(235,125,98,0.12)' : 'rgba(255,255,255,0.72)',
                      color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    }}
                  >
                    {active ? 'Selected' : option.badge}
                  </div>
                </div>

                <p className="text-sm leading-6" style={{ color: 'var(--color-text-secondary)' }}>
                  {option.copy}
                </p>
              </div>
            </button>
          );
        })}
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
    <div className="flex flex-col gap-4 px-4 pb-4 pt-2">
      <StepIntro
        eyebrow="Step 2"
        title={<>Choose the breed or type</>}
        subtitle="Mixed and unknown breeds still work well. This mainly helps PawClock start with a better baseline."
      />

      <SurfaceBlock className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Search breeds
          </div>
          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {species === 'dog' ? 'Dogs' : 'Cats'}
          </div>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
          }}
          placeholder="Search or type your own breed"
          className="control-input text-base"
          autoComplete="off"
          aria-label="Search breed"
        />

        <div
          className="surface-card-inset hide-scrollbar overflow-y-auto"
          style={{ maxHeight: 320 }}
        >
          {filtered.slice(0, 24).map((breed, index) => {
            const active = value === breed;
            return (
              <button
                key={breed}
                onClick={() => {
                  setQuery(breed);
                  onChange(breed);
                }}
                type="button"
                className="btn-tactile flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm"
                style={{
                  color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  background: active ? 'rgba(235,125,98,0.12)' : 'transparent',
                  borderBottom: index < filtered.slice(0, 24).length - 1 ? '1px solid rgba(127,100,76,0.08)' : 'none',
                }}
                aria-pressed={active}
                aria-label={`Select breed: ${breed}`}
              >
                <span className="font-medium">{breed}</span>
                {active && (
                  <span className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--color-accent)' }}>
                    Selected
                  </span>
                )}
              </button>
            );
          })}

          {filtered.length === 0 && (
            <div className="px-4 py-5 text-sm leading-6" style={{ color: 'var(--color-text-secondary)' }}>
              No breed matched that search. You can keep typing your own custom breed name and continue.
            </div>
          )}
        </div>
      </SurfaceBlock>
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
    <div className="flex flex-col gap-4 px-4 pb-4 pt-2">
      <StepIntro
        eyebrow="Step 3"
        title={<>A few details shape the baseline</>}
        subtitle="These details help the model start closer to your pet&apos;s physiology before enough logs have accumulated."
      />

      <SurfaceBlock className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="metric-label">Age</span>
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Start with approximate age if needed.
            </span>
          </div>
          <div className="text-right">
            <div className="metric-value text-[2.2rem]">{ageYears}</div>
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              years
            </div>
          </div>
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

        <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <span>1 month</span>
          <span>20 years</span>
        </div>
      </SurfaceBlock>

      <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-4">
        <SurfaceBlock className="flex flex-col gap-3">
          <span className="metric-label">Weight</span>
          <p className="text-sm leading-6" style={{ color: 'var(--color-text-secondary)' }}>
            Enter current body weight in kilograms.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0.5}
              max={100}
              step={0.1}
              value={form.weightKg}
              onChange={(e) => onChange({ weightKg: parseFloat(e.target.value) || 0 })}
              className="control-input text-[1.4rem] font-data"
              aria-label="Weight in kg"
            />
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
              kg
            </span>
          </div>
        </SurfaceBlock>

        <SurfaceBlock className="flex flex-col justify-between gap-3">
          <span className="metric-label">Snapshot</span>
          <div className="flex flex-col gap-2">
            <div className="text-lg font-semibold capitalize" style={{ color: 'var(--color-text-primary)' }}>
              {form.species ?? 'Pet'}
            </div>
            <div className="text-sm capitalize" style={{ color: 'var(--color-text-secondary)' }}>
              {sizeClassFromWeight(form.weightKg, form.species ?? 'cat')}
            </div>
          </div>
        </SurfaceBlock>
      </div>

      <SurfaceBlock className="flex flex-col gap-1 p-0">
        {[
          {
            label: 'Neutered / Spayed',
            description: 'Included in the biological baseline',
            value: form.neutered,
            onToggle: () => onChange({ neutered: !form.neutered }),
            aria: 'Toggle neutered',
          },
          {
            label: 'Indoor only',
            description: 'Useful for routine and activity assumptions',
            value: form.indoor,
            onToggle: () => onChange({ indoor: !form.indoor }),
            aria: 'Toggle indoor',
          },
        ].map((item, index) => (
          <div
            key={item.label}
            className="flex items-center justify-between gap-4 px-5 py-4"
            style={{ borderBottom: index === 0 ? '1px solid rgba(127,100,76,0.08)' : 'none' }}
          >
            <div className="flex flex-col gap-1">
              <span className="text-[15px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {item.label}
              </span>
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {item.description}
              </span>
            </div>
            <Toggle value={item.value} onToggle={item.onToggle} label={item.aria} />
          </div>
        ))}
      </SurfaceBlock>

      <SurfaceBlock className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="metric-label">Diet type</span>
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Meal composition can influence bathroom timing.
          </span>
        </div>

        <div className="flex flex-wrap gap-3">
          {(['dry', 'wet', 'raw', 'mixed'] as DietType[]).map((diet) => (
            <SelectChip
              key={diet}
              active={form.dietType === diet}
              onClick={() => onChange({ dietType: diet })}
              tint="rgba(235,125,98,0.14)"
            >
              {diet}
            </SelectChip>
          ))}
        </div>
      </SurfaceBlock>
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
    <div className="flex flex-col gap-4 px-4 pb-4 pt-2">
      <StepIntro
        eyebrow="Step 4"
        title={<>Set the usual meal rhythm</>}
        subtitle="Bathroom predictions get noticeably better when PawClock knows roughly when meals happen."
      />

      <div className="flex flex-col gap-3">
        {mealTimes.map((time, index) => (
          <SurfaceBlock key={index} className="flex items-center gap-4">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px]"
              style={{ background: 'var(--color-accent-dim)', color: 'var(--color-accent)' }}
            >
              <span className="text-sm font-semibold">{index + 1}</span>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="metric-label">Meal {index + 1}</span>
              <input
                type="time"
                value={timeInputValue(time)}
                onChange={(e) => updateTime(index, e.target.value)}
                className="control-time text-lg font-data"
                style={{ colorScheme: 'light' }}
                aria-label={`Meal ${index + 1} time`}
              />
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {formatDecimalHour(time)}
              </span>
            </div>

            {mealTimes.length > 1 && (
              <button
                onClick={() => removeMeal(index)}
                type="button"
                className="btn-tactile flex h-10 w-10 items-center justify-center rounded-full"
                style={{ background: 'rgba(207,107,99,0.12)', color: 'var(--color-danger)' }}
                aria-label={`Remove meal ${index + 1}`}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M4 8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </SurfaceBlock>
        ))}
      </div>

      {mealTimes.length < 4 && (
        <button
          onClick={addMeal}
          type="button"
          className="secondary-button btn-tactile w-full justify-center"
          aria-label="Add another meal time"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add another meal
        </button>
      )}
    </div>
  );
}

function NameStep({ name, onChange }: { name: string; onChange: (n: string) => void }) {
  return (
    <div className="flex flex-col gap-4 px-4 pb-4 pt-2">
      <StepIntro
        eyebrow="Step 5"
        title={<>What should we call them?</>}
        subtitle="This is the name that shows up on the dashboard, in reminders, and in your event history."
      />

      <div className="surface-card-hero p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <div className="metric-label">Profile name</div>
            <div className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Keep it simple and recognizable.
            </div>
          </div>
          <div className="icon-badge" style={{ background: 'var(--color-accent-dim)', color: 'var(--color-accent)' }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <path d="M4 16.5V18h1.5L15 8.5 13.5 7 4 16.5z" fill="currentColor" />
              <path d="M12.5 8l1.5 1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        <input
          type="text"
          value={name}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Luna, Max, Charlie..."
          className="control-input text-[1.45rem] font-data"
          autoFocus
          aria-label="Pet name"
          autoComplete="off"
        />
      </div>
    </div>
  );
}

function DoneStep({ name, onStart }: { name: string; onStart: () => void }) {
  const tips = [
    'Tap Sleep when your pet settles in for a nap or nighttime sleep.',
    'Log Wake when the sleep session ends so the rhythm model stays accurate.',
    'Record Pee and Poop after each bathroom event to tighten prediction windows.',
    'Expect the model to feel much smarter after three to five days of use.',
  ];

  return (
    <div
      className="flex min-h-full flex-col gap-4 px-4 pb-6"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 20px)' }}
    >
      <div className="surface-card-hero p-5 animate-entrance animate-entrance-1">
        <div className="flex flex-col gap-5">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-[22px]"
            style={{
              background: 'rgba(111,143,119,0.14)',
              color: 'var(--color-success)',
              boxShadow: '0 18px 30px rgba(111,143,119,0.18)',
            }}
          >
            <svg width="30" height="30" viewBox="0 0 40 40" fill="none" aria-hidden="true">
              <path d="M8 20l9 9 16-16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="page-title">
              {name ? <>{name} is <em>ready</em>.</> : <>You&apos;re ready.</>}
            </h2>
            <p className="page-subtitle">
              Start logging a few daily events and PawClock will begin shaping a routine that feels personal instead of generic.
            </p>
          </div>
        </div>
      </div>

      <SurfaceBlock className="animate-entrance animate-entrance-2 flex flex-col gap-4">
        <div className="section-head">
          <div className="section-label" style={{ color: 'var(--color-accent)' }}>
            First week
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {tips.map((tip) => (
            <div key={tip} className="flex items-start gap-3">
              <div
                className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                style={{ background: 'var(--color-accent-dim)', color: 'var(--color-accent)' }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2 6l2.3 2.3L10 2.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-sm leading-6" style={{ color: 'var(--color-text-secondary)' }}>
                {tip}
              </p>
            </div>
          ))}
        </div>
      </SurfaceBlock>

      <div className="mt-auto animate-entrance animate-entrance-3">
        <button onClick={onStart} className="primary-button btn-tactile w-full" aria-label="Start using PawClock" type="button">
          Start logging events
        </button>
      </div>
    </div>
  );
}

const Onboarding = memo(function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);

  function updateForm(updates: Partial<FormData>) {
    setForm((prev) => ({ ...prev, ...updates }));
  }

  function canProceed(): boolean {
    switch (step) {
      case 0:
        return true;
      case 1:
        return form.species !== null;
      case 2:
        return form.breed.length > 1;
      case 3:
        return form.ageMonths > 0 && form.weightKg > 0;
      case 4:
        return form.mealTimes.length > 0;
      case 5:
        return form.name.trim().length > 0;
      default:
        return true;
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

    onComplete(pet);
  }

  const stepContent = [
    <WelcomeStep key="welcome" onNext={() => setStep(1)} />,
    <SpeciesStep key="species" value={form.species} onChange={(species) => updateForm({ species })} />,
    <BreedStep key="breed" species={form.species ?? 'cat'} value={form.breed} onChange={(breed) => updateForm({ breed })} />,
    <DetailsStep key="details" form={form} onChange={updateForm} />,
    <MealsStep key="meals" mealTimes={form.mealTimes} onChange={(mealTimes) => updateForm({ mealTimes })} />,
    <NameStep key="name" name={form.name} onChange={(name) => updateForm({ name })} />,
    <DoneStep key="done" name={form.name} onStart={handleDone} />,
  ];

  const showProgress = step > 0 && step < 6;
  const showNext = step > 0 && step < 5;
  const showName = step === 5;

  return (
    <div className="flex min-h-dvh flex-col" style={{ background: 'transparent' }}>
      {showProgress && (
        <div
          className="mx-auto w-full shrink-0 px-4 pb-2 pt-3"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)', maxWidth: 720 }}
        >
          <div className="flex items-center gap-3 px-1 py-2">
            {step > 1 ? (
              <button
                onClick={() => setStep((current) => current - 1)}
                type="button"
                className="btn-tactile flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{ color: 'var(--color-text-secondary)' }}
                aria-label="Go back"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ) : (
              <div className="h-8 w-8" />
            )}

            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  Setup progress
                </span>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Step {step} of {TOTAL_STEPS}
                </span>
              </div>
              <div className="flex gap-2">
                {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
                  <div
                    key={index}
                    className="h-2 flex-1 rounded-full"
                    style={{
                      background:
                        index < step
                          ? 'linear-gradient(90deg, var(--color-accent) 0%, var(--color-accent-strong) 100%)'
                          : 'rgba(127,100,76,0.12)',
                      opacity: index === step - 1 ? 1 : index < step ? 0.84 : 1,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto w-full flex-1 overflow-y-auto hide-scrollbar" style={{ maxWidth: 720 }}>
        {stepContent[step]}
      </div>

      {(showNext || showName) && (
        <div
          className="mx-auto w-full shrink-0 px-4 pb-4 pt-2"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)', maxWidth: 720 }}
        >
          <button
            onClick={() => setStep((current) => current + 1)}
            disabled={!canProceed()}
            className="primary-button btn-tactile w-full"
            aria-label="Continue to next step"
            type="button"
          >
            {showName ? 'Review and finish' : 'Continue'}
          </button>
        </div>
      )}
    </div>
  );
});

export default Onboarding;
