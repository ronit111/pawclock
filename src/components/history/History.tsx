import { memo, useMemo, useState } from 'react';
import type { PetEvent, EventType } from '../../types';

interface HistoryProps {
  events: PetEvent[];
  petName: string;
}

function getEventConfig(type: EventType) {
  switch (type) {
    case 'pee': return { label: 'Pee', color: 'var(--color-pee)', short: '💧' };
    case 'poop': return { label: 'Poop', color: 'var(--color-poop)', short: '•' };
    case 'sleep_start': return { label: 'Sleep', color: 'var(--color-sleep)', short: '◐' };
    case 'sleep_end': return { label: 'Wake', color: 'var(--color-sleep)', short: '◑' };
  }
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function groupByDay(events: PetEvent[]): Array<{ dateLabel: string; dateTs: number; events: PetEvent[] }> {
  const map = new Map<string, { dateLabel: string; dateTs: number; events: PetEvent[] }>();

  for (const evt of [...events].sort((a, b) => b.timestamp - a.timestamp)) {
    const d = new Date(evt.timestamp);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString();
    if (!map.has(key)) {
      map.set(key, { dateLabel: formatDate(evt.timestamp), dateTs: d.getTime(), events: [] });
    }
    map.get(key)!.events.push(evt);
  }

  return Array.from(map.values()).sort((a, b) => b.dateTs - a.dateTs);
}

type FilterType = EventType | 'all';

const History = memo(function History({ events, petName }: HistoryProps) {
  const [filter, setFilter] = useState<FilterType>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return events;
    return events.filter((e) => e.type === filter);
  }, [events, filter]);

  const grouped = useMemo(() => groupByDay(filtered), [filtered]);

  const filterOptions: Array<{ value: FilterType; label: string; color: string }> = [
    { value: 'all', label: 'All', color: 'var(--color-text-secondary)' },
    { value: 'pee', label: 'Pee', color: 'var(--color-pee)' },
    { value: 'poop', label: 'Poop', color: 'var(--color-poop)' },
    { value: 'sleep_start', label: 'Sleep', color: 'var(--color-sleep)' },
  ];

  // Daily event counts for the past 7 days (simple stats)
  const sevenDayStart = Date.now() - 7 * 86400_000;
  const recentEvents = events.filter((e) => e.timestamp >= sevenDayStart);
  const peeCt = recentEvents.filter((e) => e.type === 'pee').length;
  const poopCt = recentEvents.filter((e) => e.type === 'poop').length;
  const avgPeePerDay = (peeCt / 7).toFixed(1);
  const avgPoopPerDay = (poopCt / 7).toFixed(1);

  return (
    <div
      className="flex flex-col"
      style={{ minHeight: '100%', paddingBottom: 140 }}
    >
      {/* Header */}
      <div
        className="px-4 pt-6 pb-4 animate-entrance animate-entrance-1"
        style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}
      >
        <h1
          className="text-3xl"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}
        >
          {petName}&rsquo;s History
        </h1>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', letterSpacing: '0.04em' }}>
          {events.length} events logged
        </p>
      </div>

      {/* 7-day stats */}
      <div className="grid grid-cols-2 gap-3 px-4 mb-4 animate-entrance animate-entrance-2">
        <div
          className="rounded-2xl p-4 flex flex-col gap-1"
          style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(212,168,67,0.08)' }}
        >
          <span className="text-[10px] uppercase tracking-[0.15em] font-semibold" style={{ color: 'var(--color-pee)', fontFamily: 'var(--font-body)' }}>
            Pee / day
          </span>
          <span
            className="text-4xl leading-none"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
          >
            {avgPeePerDay}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>
            7-day average
          </span>
        </div>
        <div
          className="rounded-2xl p-4 flex flex-col gap-1"
          style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(139,107,74,0.08)' }}
        >
          <span className="text-[10px] uppercase tracking-[0.15em] font-semibold" style={{ color: 'var(--color-poop)', fontFamily: 'var(--font-body)' }}>
            Poop / day
          </span>
          <span
            className="text-4xl leading-none"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
          >
            {avgPoopPerDay}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>
            7-day average
          </span>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 px-4 mb-4 overflow-x-auto animate-entrance animate-entrance-3" role="group" aria-label="Filter events by type">
        {filterOptions.map(({ value, label, color }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            className="btn-tactile flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shrink-0"
            style={{
              minHeight: 32,
              background: filter === value ? `${color}20` : 'var(--color-surface-raised)',
              color: filter === value ? color : 'var(--color-text-muted)',
              border: `1px solid ${filter === value ? color + '40' : 'rgba(245,240,232,0.06)'}`,
              fontFamily: 'var(--font-body)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Event list grouped by day */}
      <div className="flex flex-col px-4 gap-4">
        {grouped.length === 0 && (
          <div
            className="rounded-2xl p-6 text-center"
            style={{ background: 'var(--color-surface-raised)' }}
          >
            <p className="text-sm" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>
              No events logged yet. Use the log panel below to start tracking.
            </p>
          </div>
        )}

        {grouped.map((group) => (
          <section key={group.dateTs} aria-label={`Events on ${group.dateLabel}`}>
            <h2
              className="text-xs font-semibold uppercase tracking-widest mb-2"
              style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}
            >
              {group.dateLabel}
            </h2>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--color-surface-raised)', border: '1px solid rgba(245,240,232,0.05)' }}
            >
              {group.events.map((evt, i) => {
                const config = getEventConfig(evt.type);
                return (
                  <div
                    key={evt.id}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ borderBottom: i < group.events.length - 1 ? '1px solid rgba(245,240,232,0.04)' : 'none' }}
                  >
                    {/* Color dot */}
                    <div
                      className="rounded-full shrink-0"
                      style={{ width: 8, height: 8, background: config.color }}
                      aria-hidden="true"
                    />

                    {/* Event details */}
                    <div className="flex flex-col flex-1 min-w-0">
                      <span
                        className="text-sm font-medium"
                        style={{ color: config.color, fontFamily: 'var(--font-body)' }}
                      >
                        {config.label}
                      </span>
                      {evt.type === 'pee' && (evt.volume || evt.color) && (
                        <span className="text-xs capitalize" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>
                          {[evt.volume, evt.color].filter(Boolean).join(' · ')}
                          {evt.unusualLocation && ' · unusual location'}
                        </span>
                      )}
                      {evt.type === 'poop' && (evt.consistencyScore || evt.size) && (
                        <span className="text-xs capitalize" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>
                          {evt.size && `${evt.size} size`}
                          {evt.consistencyScore && ` · ${evt.consistencyScore}/7`}
                          {evt.notes && ` · ${evt.notes}`}
                        </span>
                      )}
                    </div>

                    {/* Time */}
                    <span
                      className="text-sm shrink-0"
                      style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-secondary)' }}
                    >
                      {formatTime(evt.timestamp)}
                    </span>
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
