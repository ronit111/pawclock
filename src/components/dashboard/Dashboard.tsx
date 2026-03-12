import { memo, useMemo, useState } from 'react';
import type { EventType, PetEvent, PetPrediction, PetProfile } from '../../types';
import Timeline from './Timeline';
import NextEventCard from './NextEventCard';
import ConfidenceIndicator from '../shared/ConfidenceIndicator';

interface DashboardProps {
  pet: PetProfile;
  prediction: PetPrediction;
  events: PetEvent[];
}

type FilterType = 'sleep_start' | 'pee' | 'poop';

const FILTER_CONFIG: Array<{ type: FilterType; label: string; color: string; tint: string }> = [
  { type: 'sleep_start', label: 'Sleep', color: 'var(--color-sleep)', tint: 'var(--color-sleep-soft)' },
  { type: 'pee', label: 'Pee', color: 'var(--color-pee)', tint: 'var(--color-pee-soft)' },
  { type: 'poop', label: 'Poop', color: 'var(--color-poop)', tint: 'var(--color-poop-soft)' },
];

function formatCurrentTime(date: Date): string {
  const day = date.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day}, ${dateStr} at ${time}`;
}

function formatShortTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function getCurrentStatus(prediction: PetPrediction): string {
  const now = Date.now();
  const sleepWindows = prediction.sleepStart.windows;
  for (const window of sleepWindows) {
    if (now >= window.startTime - 15 * 60_000 && now <= window.endTime + 15 * 60_000) {
      return 'Likely resting';
    }
  }
  return 'Likely awake';
}

function getMostUrgentPrediction(prediction: PetPrediction) {
  const now = Date.now();
  const candidates = [
    { type: 'pee' as EventType, window: prediction.pee.nextEventEstimate.window80 },
    { type: 'poop' as EventType, window: prediction.poop.nextEventEstimate.window80 },
    { type: 'sleep_start' as EventType, window: prediction.sleepStart.nextEventEstimate.window80 },
  ].filter((candidate) => candidate.window.peakTime > now);

  candidates.sort((a, b) => a.window.peakTime - b.window.peakTime);
  return candidates[0] ?? null;
}

function formatCountdown(ts: number): string {
  const diff = ts - Date.now();
  if (diff < 0) return 'Happening now';
  const min = Math.round(diff / 60_000);
  if (min < 60) return `About ${min} min`;
  const hours = Math.floor(min / 60);
  const minutes = min % 60;
  return minutes > 0 ? `About ${hours}h ${minutes}m` : `About ${hours}h`;
}

function getUrgentLabel(type: EventType): string {
  if (type === 'pee') return 'Bathroom break';
  if (type === 'poop') return 'Digestive window';
  if (type === 'sleep_start') return 'Next nap window';
  return 'Wake window';
}

function getUrgentColor(type: EventType): string {
  if (type === 'pee') return 'var(--color-pee)';
  if (type === 'poop') return 'var(--color-poop)';
  return 'var(--color-sleep)';
}

function getUrgentTint(type: EventType): string {
  if (type === 'pee') return 'var(--color-pee-soft)';
  if (type === 'poop') return 'var(--color-poop-soft)';
  return 'var(--color-sleep-soft)';
}

const Dashboard = memo(function Dashboard({ pet, prediction, events }: DashboardProps) {
  const [now] = useState(() => new Date());
  const [visibleTypes, setVisibleTypes] = useState<Set<EventType>>(
    new Set(['sleep_start', 'sleep_end', 'pee', 'poop']),
  );

  function toggleType(type: FilterType) {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (type === 'sleep_start') {
        if (next.has('sleep_start')) {
          next.delete('sleep_start');
          next.delete('sleep_end');
        } else {
          next.add('sleep_start');
          next.add('sleep_end');
        }
      } else if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
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

  const todayStart = useMemo(() => {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }, [now]);

  const todayLogged = useMemo(
    () => events.filter((event) => event.timestamp >= todayStart).length,
    [events, todayStart],
  );

  const lastLoggedEvent = useMemo(
    () => events.reduce<PetEvent | null>((latest, event) => {
      if (!latest || event.timestamp > latest.timestamp) return event;
      return latest;
    }, null),
    [events],
  );

  return (
    <div className="page-scroll">
      {/* ── Hero: title + prediction + metrics ── */}
      <section className="surface-card-hero animate-entrance animate-entrance-1 p-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-2">
              <h1 className="page-title">
                {pet.name}&apos;s <em>day</em>
              </h1>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {status}. {currentTimeStr}.
              </p>
            </div>
            <ConfidenceIndicator confidence={avgConfidence} size="sm" />
          </div>

          <div
            className="surface-card-inset p-4"
            aria-live="polite"
            aria-label="Most urgent upcoming event"
            style={{
              background: urgent
                ? `linear-gradient(180deg, ${getUrgentTint(urgent.type)} 0%, rgba(255,255,255,0.96) 100%)`
                : undefined,
            }}
          >
            {urgent ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: getUrgentColor(urgent.type) }}>
                    Up next
                  </span>
                  <span className="text-xs font-semibold" style={{ color: getUrgentColor(urgent.type) }}>
                    {Math.round(urgent.window.confidence * 100)}% likely
                  </span>
                </div>
                <div className="text-[1.6rem] leading-tight font-data" style={{ color: 'var(--color-text-primary)' }}>
                  {getUrgentLabel(urgent.type)} in {formatCountdown(urgent.window.peakTime)}
                </div>
                <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {formatShortTime(urgent.window.startTime)} - {formatShortTime(urgent.window.endTime)}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <div className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  Predictions warming up
                </div>
                <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  Log a few events and timing windows will appear here.
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="metric-card">
              <span className="metric-label">Today</span>
              <span className="metric-value">{todayLogged}</span>
              <span className="metric-caption">events</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Model</span>
              <span className="metric-value">{Math.round(avgConfidence * 100)}%</span>
              <span className="metric-caption">confidence</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Latest</span>
              <span className="metric-value text-[1.4rem]">{lastLoggedEvent ? formatShortTime(lastLoggedEvent.timestamp) : '--'}</span>
              <span className="metric-caption">last event</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Desktop: two-column grid (timeline left, predictions right) ── */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_300px] lg:items-start lg:gap-5">
        {/* Timeline */}
        <section className="section-stack animate-entrance animate-entrance-2">
          <div className="section-head">
            <h2 className="section-title">24h timeline</h2>
          </div>

          <div className="hide-scrollbar flex gap-2 overflow-x-auto" role="group" aria-label="Filter event types">
            {FILTER_CONFIG.map(({ type, label, color, tint }) => {
              const active = visibleTypes.has(type);
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  aria-pressed={active}
                  type="button"
                  className={`filter-chip btn-tactile shrink-0 ${active ? 'active' : ''}`}
                  style={{
                    color: active ? color : 'var(--color-text-secondary)',
                    background: active ? tint : 'rgba(255,255,255,0.7)',
                    borderColor: active ? `${color}30` : 'rgba(127,100,76,0.12)',
                  }}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: color, boxShadow: active ? `0 0 0 4px ${tint}` : 'none' }}
                  />
                  {label}
                </button>
              );
            })}
          </div>

          <Timeline
            prediction={prediction}
            events={events}
            visibleTypes={visibleTypes}
            currentTime={now}
          />
        </section>

        {/* Predicted windows — sidebar on desktop, stacked on mobile */}
        <section className="section-stack animate-entrance animate-entrance-3" aria-label="Upcoming events">
          <div className="section-head">
            <h2 className="section-title">Predicted windows</h2>
          </div>

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
              isPrimary={urgent?.type === 'sleep_start'}
            />
          </div>
        </section>
      </div>
    </div>
  );
});

export default Dashboard;
