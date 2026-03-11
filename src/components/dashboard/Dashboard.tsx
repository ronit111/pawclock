import { useState, useMemo, memo } from 'react';
import type { PetProfile, PetPrediction, PetEvent, EventType } from '../../types';
import Timeline from './Timeline';
import NextEventCard from './NextEventCard';
import ConfidenceIndicator from '../shared/ConfidenceIndicator';

interface DashboardProps {
  pet: PetProfile;
  prediction: PetPrediction;
  events: PetEvent[];
}

type FilterType = 'sleep_start' | 'pee' | 'poop';

const FILTER_CONFIG: Array<{ type: FilterType; label: string; color: string }> = [
  { type: 'sleep_start', label: 'Sleep', color: 'var(--color-sleep)' },
  { type: 'pee', label: 'Pee', color: 'var(--color-pee)' },
  { type: 'poop', label: 'Poop', color: 'var(--color-poop)' },
];

function formatCurrentTime(date: Date): string {
  const day = date.toLocaleDateString('en-US', { weekday: 'short' });
  const dateStr = date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day}, ${dateStr} · ${time}`;
}

function getCurrentStatus(prediction: PetPrediction): string {
  // Determine if pet is likely sleeping based on sleep_start windows
  const now = Date.now();
  const sleepWindows = prediction.sleepStart.windows;
  for (const w of sleepWindows) {
    if (now >= w.startTime - 15 * 60_000 && now <= w.endTime + 15 * 60_000) {
      return 'likely napping';
    }
  }
  return 'likely awake';
}

function getMostUrgentPrediction(prediction: PetPrediction) {
  const now = Date.now();
  const candidates = [
    { type: 'pee' as EventType, window: prediction.pee.nextEventEstimate.window80 },
    { type: 'poop' as EventType, window: prediction.poop.nextEventEstimate.window80 },
  ].filter((c) => c.window.peakTime > now);

  candidates.sort((a, b) => a.window.peakTime - b.window.peakTime);
  return candidates[0] ?? null;
}

function formatCountdown(ts: number): string {
  const diff = ts - Date.now();
  if (diff < 0) return 'now';
  const min = Math.round(diff / 60_000);
  if (min < 60) return `~${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
}

function getUrgentLabel(type: EventType): string {
  if (type === 'pee') return 'Pee';
  if (type === 'poop') return 'Poop';
  if (type === 'sleep_start') return 'Sleep';
  return 'Wake';
}

function getUrgentColor(type: EventType): string {
  if (type === 'pee') return 'var(--color-pee)';
  if (type === 'poop') return 'var(--color-poop)';
  return 'var(--color-sleep)';
}

const Dashboard = memo(function Dashboard({ pet, prediction, events }: DashboardProps) {
  const [now] = useState(() => new Date());
  const [visibleTypes, setVisibleTypes] = useState<Set<EventType>>(
    new Set(['sleep_start', 'sleep_end', 'pee', 'poop']),
  );

  function toggleType(type: FilterType) {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      // Sleep toggle controls both sleep_start and sleep_end
      if (type === 'sleep_start') {
        if (next.has('sleep_start')) {
          next.delete('sleep_start');
          next.delete('sleep_end');
        } else {
          next.add('sleep_start');
          next.add('sleep_end');
        }
      } else {
        if (next.has(type)) next.delete(type);
        else next.add(type);
      }
      return next;
    });
  }

  const urgent = useMemo(() => getMostUrgentPrediction(prediction), [prediction]);
  const status = useMemo(() => getCurrentStatus(prediction), [prediction]);
  const currentTimeStr = formatCurrentTime(now);
  const avgConfidence =
    (prediction.pee.modelConfidence +
      prediction.poop.modelConfidence +
      prediction.sleepStart.modelConfidence) /
    3;

  return (
    <div
      className="flex flex-col gap-3 px-4 pt-4 pb-2"
      style={{ minHeight: '100%' }}
    >
      {/* Header */}
      <header className="flex items-start justify-between animate-entrance animate-entrance-1">
        <div>
          <h1
            className="text-3xl leading-tight"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}
          >
            {pet.name}
          </h1>
          <p
            className="text-xs mt-0.5"
            style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', letterSpacing: '0.04em' }}
          >
            {currentTimeStr}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 pt-1">
          <div
            className="text-[11px] font-medium px-2.5 py-1 rounded-full"
            style={{
              background: 'var(--color-surface-overlay)',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
              letterSpacing: '0.02em',
              border: '1px solid rgba(245,240,232,0.04)',
            }}
          >
            {pet.name} is {status}
          </div>
          <ConfidenceIndicator confidence={avgConfidence} size="sm" />
        </div>
      </header>

      {/* Next event hero card — the centerpiece */}
      {urgent && (
        <div
          className="ambient-glow rounded-2xl p-5 animate-entrance animate-entrance-2"
          style={{
            '--glow-color': `${getUrgentColor(urgent.type)}15`,
            background: `linear-gradient(145deg, ${getUrgentColor(urgent.type)}0A 0%, var(--color-surface-raised) 50%)`,
            border: `1px solid ${getUrgentColor(urgent.type)}20`,
          } as React.CSSProperties}
          aria-live="polite"
          aria-label="Most urgent upcoming event"
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-2"
            style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}
          >
            Up next
          </div>
          <div className="flex items-end justify-between gap-3">
            <span
              className="text-[1.7rem] leading-tight"
              style={{
                fontFamily: 'var(--font-display)',
                color: getUrgentColor(urgent.type),
                letterSpacing: '-0.01em',
              }}
            >
              {getUrgentLabel(urgent.type)} likely in{' '}
              {formatCountdown(urgent.window.peakTime)}
            </span>
            <span
              className="text-sm font-medium shrink-0 px-2.5 py-1 rounded-full"
              style={{
                background: `${getUrgentColor(urgent.type)}12`,
                color: getUrgentColor(urgent.type),
                fontFamily: 'var(--font-display)',
                border: `1px solid ${getUrgentColor(urgent.type)}15`,
              }}
            >
              ~{Math.round(urgent.window.confidence * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Event type filter pills */}
      <div className="flex gap-2 animate-entrance animate-entrance-3" role="group" aria-label="Filter event types">
        {FILTER_CONFIG.map(({ type, label, color }) => {
          const active = visibleTypes.has(type);
          return (
            <button
              key={type}
              onClick={() => toggleType(type)}
              aria-pressed={active}
              className="btn-tactile flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{
                background: active ? `${color}18` : 'var(--color-surface-raised)',
                color: active ? color : 'var(--color-text-muted)',
                border: `1px solid ${active ? color + '30' : 'rgba(245,240,232,0.05)'}`,
                fontFamily: 'var(--font-body)',
                minHeight: 32,
                letterSpacing: '0.03em',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{
                  background: active ? color : 'var(--color-text-muted)',
                  boxShadow: active ? `0 0 6px ${color}60` : 'none',
                }}
              />
              {label}
            </button>
          );
        })}
      </div>

      {/* Timeline visualization */}
      <div className="animate-entrance animate-entrance-4">
        <Timeline
          prediction={prediction}
          events={events}
          visibleTypes={visibleTypes}
          currentTime={now}
        />
      </div>

      {/* Next event cards */}
      <section className="animate-entrance animate-entrance-5" aria-label="Upcoming events">
        <h2
          className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-2"
          style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}
        >
          Predicted Windows
        </h2>
        <div className="flex flex-col gap-2">
          <NextEventCard
            eventType="pee"
            window={prediction.pee.nextEventEstimate.window80}
            isPrimary={urgent?.type === 'pee'}
          />
          <NextEventCard
            eventType="poop"
            window={prediction.poop.nextEventEstimate.window80}
            isPrimary={urgent?.type === 'poop'}
          />
          <NextEventCard
            eventType="sleep_start"
            window={prediction.sleepStart.nextEventEstimate.window80}
          />
        </div>
      </section>

      {/* Bottom padding for nav + quick log panel */}
      <div style={{ height: 140 }} />
    </div>
  );
});

export default Dashboard;
