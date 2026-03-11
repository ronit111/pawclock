import { memo, useMemo, useState } from 'react';
import type { EventType, PetEvent } from '../../types';

interface HistoryProps {
  events: PetEvent[];
  petName: string;
}

function getEventConfig(type: EventType) {
  switch (type) {
    case 'pee':
      return { label: 'Pee', color: 'var(--color-pee)', tint: 'var(--color-pee-soft)', badge: 'P' };
    case 'poop':
      return { label: 'Poop', color: 'var(--color-poop)', tint: 'var(--color-poop-soft)', badge: 'D' };
    case 'sleep_start':
      return { label: 'Sleep', color: 'var(--color-sleep)', tint: 'var(--color-sleep-soft)', badge: 'S' };
    case 'sleep_end':
      return { label: 'Wake', color: 'var(--color-sleep)', tint: 'var(--color-sleep-soft)', badge: 'W' };
  }
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDate(ts: number): string {
  const date = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function groupByDay(events: PetEvent[]): Array<{ dateLabel: string; dateTs: number; events: PetEvent[] }> {
  const map = new Map<string, { dateLabel: string; dateTs: number; events: PetEvent[] }>();

  for (const event of [...events].sort((a, b) => b.timestamp - a.timestamp)) {
    const date = new Date(event.timestamp);
    date.setHours(0, 0, 0, 0);
    const key = date.toISOString();
    if (!map.has(key)) {
      map.set(key, { dateLabel: formatDate(event.timestamp), dateTs: date.getTime(), events: [] });
    }
    map.get(key)!.events.push(event);
  }

  return Array.from(map.values()).sort((a, b) => b.dateTs - a.dateTs);
}

function eventDetails(event: PetEvent): string {
  if (event.type === 'pee') {
    const details: string[] = [];
    if (event.volume) details.push(event.volume);
    if (event.color) details.push(event.color);
    if (event.unusualLocation) details.push('unusual location');
    return details.length > 0 ? details.join(' / ') : 'Bathroom event logged';
  }

  if (event.type === 'poop') {
    const details = [
      event.size ? `${event.size} size` : null,
      event.consistencyScore ? `${event.consistencyScore}/7 consistency` : null,
      event.notes || null,
    ].filter(Boolean);
    return details.length > 0 ? details.join(' / ') : 'Digestive event logged';
  }

  return event.type === 'sleep_start' ? 'Sleep session started' : 'Sleep session ended';
}

type FilterType = EventType | 'all';

const History = memo(function History({ events, petName }: HistoryProps) {
  const [filter, setFilter] = useState<FilterType>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return events;
    return events.filter((event) => event.type === filter);
  }, [events, filter]);

  const grouped = useMemo(() => groupByDay(filtered), [filtered]);

  const filterOptions: Array<{ value: FilterType; label: string; color: string; tint: string }> = [
    { value: 'all', label: 'All', color: 'var(--color-text-secondary)', tint: 'rgba(255,255,255,0.84)' },
    { value: 'pee', label: 'Pee', color: 'var(--color-pee)', tint: 'var(--color-pee-soft)' },
    { value: 'poop', label: 'Poop', color: 'var(--color-poop)', tint: 'var(--color-poop-soft)' },
    { value: 'sleep_start', label: 'Sleep', color: 'var(--color-sleep)', tint: 'var(--color-sleep-soft)' },
  ];

  const sevenDayStart = Date.now() - 7 * 86_400_000;
  const recentEvents = events.filter((event) => event.timestamp >= sevenDayStart);
  const peeCount = recentEvents.filter((event) => event.type === 'pee').length;
  const poopCount = recentEvents.filter((event) => event.type === 'poop').length;
  const sleepCount = recentEvents.filter((event) => event.type === 'sleep_start').length;

  return (
    <div className="page-scroll">
      <section className="surface-card-hero animate-entrance animate-entrance-1 p-6">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <div className="eyebrow-pill w-fit" style={{ color: 'var(--color-accent)' }}>
              Event journal
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="page-title">
                {petName}&apos;s <em>history</em>
              </h1>
              <p className="page-subtitle">
                Review recent patterns, spot outliers, and keep your logged timeline tidy and readable.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="metric-card">
              <span className="metric-label" style={{ color: 'var(--color-pee)' }}>
                Pee
              </span>
              <span className="metric-value">{(peeCount / 7).toFixed(1)}</span>
              <span className="metric-caption">per day</span>
            </div>
            <div className="metric-card">
              <span className="metric-label" style={{ color: 'var(--color-poop)' }}>
                Poop
              </span>
              <span className="metric-value">{(poopCount / 7).toFixed(1)}</span>
              <span className="metric-caption">per day</span>
            </div>
            <div className="metric-card">
              <span className="metric-label" style={{ color: 'var(--color-sleep)' }}>
                Sleep
              </span>
              <span className="metric-value">{sleepCount}</span>
              <span className="metric-caption">starts this week</span>
            </div>
          </div>
        </div>
      </section>

      <section className="surface-card animate-entrance animate-entrance-2 p-4">
        <div className="section-head">
          <div className="flex flex-col gap-1">
            <div className="section-label">Filter</div>
            <h2 className="section-title">Focus the timeline</h2>
          </div>
          <div className="info-pill">{filtered.length} events</div>
        </div>

        <div className="hide-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter events by type">
          {filterOptions.map(({ value, label, color, tint }) => {
            const active = filter === value;
            return (
              <button
                key={value}
                onClick={() => setFilter(value)}
                type="button"
                aria-pressed={active}
                className={`filter-chip btn-tactile shrink-0 ${active ? 'active' : ''}`}
                style={{
                  color: active ? color : 'var(--color-text-secondary)',
                  background: active ? tint : 'rgba(255,255,255,0.74)',
                  borderColor: active ? `${color}30` : 'rgba(127,100,76,0.12)',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex flex-col gap-4 animate-entrance animate-entrance-3">
        {grouped.length === 0 && (
          <div className="surface-card p-6 text-center">
            <p className="text-sm leading-6" style={{ color: 'var(--color-text-secondary)' }}>
              No events logged yet. Open the quick log panel to start building your pet&apos;s routine.
            </p>
          </div>
        )}

        {grouped.map((group) => (
          <section key={group.dateTs} className="surface-card overflow-hidden" aria-label={`Events on ${group.dateLabel}`}>
            <div className="flex items-center justify-between gap-3 border-b px-4 py-4" style={{ borderColor: 'rgba(127,100,76,0.08)' }}>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {group.dateLabel}
                </h2>
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {group.events.length} logged {group.events.length === 1 ? 'event' : 'events'}
                </span>
              </div>
              <div className="info-pill">{formatTime(group.events[0].timestamp)} latest</div>
            </div>

            <div className="flex flex-col">
              {group.events.map((event, index) => {
                const config = getEventConfig(event.type);
                return (
                  <div
                    key={event.id}
                    className="flex items-start gap-4 px-4 py-4"
                    style={{ borderBottom: index < group.events.length - 1 ? '1px solid rgba(127,100,76,0.08)' : 'none' }}
                  >
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] text-sm font-semibold"
                      style={{ background: config.tint, color: config.color }}
                      aria-hidden="true"
                    >
                      {config.badge}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                          {config.label}
                        </span>
                        <span
                          className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
                          style={{ background: config.tint, color: config.color }}
                        >
                          {formatTime(event.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm leading-6 capitalize" style={{ color: 'var(--color-text-secondary)' }}>
                        {eventDetails(event)}
                      </p>
                    </div>

                    <div className="shrink-0 pt-0.5 font-data text-base" style={{ color: 'var(--color-text-secondary)' }}>
                      {formatTime(event.timestamp)}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
});

export default History;
