import { memo, useState, useEffect } from 'react';
import type { EventType, PredictionWindow } from '../../types';

interface NextEventCardProps {
  eventType: EventType;
  window: PredictionWindow;
  /** Whether this is the most imminent event (rendered larger) */
  isPrimary?: boolean;
}

function getEventConfig(type: EventType) {
  switch (type) {
    case 'pee':
      return {
        label: 'Next pee',
        color: 'var(--color-pee)',
        glow: 'var(--color-pee-glow)',
        Icon: () => (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M9 2C9 2 5 7 5 11a4 4 0 008 0C13 7 9 2 9 2z" fill="currentColor" opacity="0.9" />
          </svg>
        ),
      };
    case 'poop':
      return {
        label: 'Next poop',
        color: 'var(--color-poop)',
        glow: 'var(--color-poop-glow)',
        Icon: () => (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <ellipse cx="9" cy="13" rx="5" ry="2.5" fill="currentColor" opacity="0.7" />
            <ellipse cx="9" cy="11" rx="4" ry="2" fill="currentColor" opacity="0.85" />
            <ellipse cx="9" cy="9.5" rx="3" ry="1.8" fill="currentColor" />
            <ellipse cx="9" cy="8.2" rx="2.2" ry="1.5" fill="currentColor" />
            <path d="M8 6.5C8 5.5 9.5 4.5 9 3.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          </svg>
        ),
      };
    case 'sleep_start':
      return {
        label: 'Falling asleep',
        color: 'var(--color-sleep)',
        glow: 'var(--color-sleep-glow)',
        Icon: () => (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M14 9.5A6 6 0 119.5 4a4.5 4.5 0 104.5 5.5z" fill="currentColor" opacity="0.9" />
            <circle cx="13.5" cy="4.5" r="1" fill="currentColor" />
            <circle cx="15.5" cy="7" r="0.7" fill="currentColor" />
            <circle cx="11.5" cy="2.5" r="0.6" fill="currentColor" />
          </svg>
        ),
      };
    case 'sleep_end':
      return {
        label: 'Waking up',
        color: 'var(--color-sleep)',
        glow: 'var(--color-sleep-glow)',
        Icon: () => (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <circle cx="9" cy="10" r="4" fill="currentColor" opacity="0.9" />
            <path d="M9 3v2M9 15v2M3 10H1M17 10h-2M4.8 5.8L3.4 4.4M14.6 15.6l-1.4-1.4M4.8 14.2L3.4 15.6M14.6 4.4l-1.4 1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ),
      };
  }
}

function formatTimeWindow(startTime: number, endTime: number): string {
  const fmt = (ts: number) =>
    new Date(ts).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  return `${fmt(startTime)} – ${fmt(endTime)}`;
}

function formatCountdown(targetTime: number): string {
  const diffMs = targetTime - Date.now();
  if (diffMs < 0) return 'Past due';
  const totalMin = Math.round(diffMs / 60_000);
  if (totalMin < 60) return `in ~${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `in ~${h}h ${m}m` : `in ~${h}h`;
}

const NextEventCard = memo(function NextEventCard({
  eventType,
  window,
  isPrimary = false,
}: NextEventCardProps) {
  const [, setTick] = useState(0);

  // Update countdown every 30 seconds
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const config = getEventConfig(eventType);
  const { color, glow, label, Icon } = config;
  const pct = Math.round(window.confidence * 100);
  const countdown = formatCountdown(window.peakTime);
  const timeRange = formatTimeWindow(window.startTime, window.endTime);

  if (isPrimary) {
    return (
      <article
        className="ambient-glow rounded-2xl p-4 flex flex-col gap-2"
        style={{
          '--glow-color': `${glow}`,
          background: `linear-gradient(145deg, ${color}12 0%, var(--color-surface-raised) 60%)`,
          border: `1px solid ${color}20`,
        } as React.CSSProperties}
        aria-label={`${label}: ${timeRange}, ${pct}% likely, ${countdown}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span style={{ color, filter: `drop-shadow(0 0 4px ${color})` }}><Icon /></span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color, fontFamily: 'var(--font-body)' }}>
              {label}
            </span>
          </div>
          <span
            className="text-xs px-2.5 py-0.5 rounded-full"
            style={{
              background: `${color}12`,
              color,
              fontFamily: 'var(--font-display)',
              border: `1px solid ${color}15`,
            }}
          >
            ~{pct}% likely
          </span>
        </div>

        <div className="flex items-end justify-between">
          <span
            className="text-2xl leading-none"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
          >
            {timeRange}
          </span>
          <span
            className="text-sm"
            style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}
          >
            {countdown}
          </span>
        </div>
      </article>
    );
  }

  return (
    <article
      className="rounded-xl p-3 flex items-center gap-3"
      style={{
        background: 'var(--color-surface-raised)',
        border: '1px solid rgba(245,240,232,0.06)',
      }}
      aria-label={`${label}: ${timeRange}, ${pct}% likely, ${countdown}`}
    >
      <div
        className="flex items-center justify-center rounded-full shrink-0"
        style={{
          width: 38,
          height: 38,
          background: `${color}15`,
          color,
        }}
      >
        <Icon />
      </div>

      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span
          className="text-[11px] font-medium uppercase tracking-wider"
          style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}
        >
          {label}
        </span>
        <span
          className="text-base leading-tight truncate"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
        >
          {timeRange}
        </span>
      </div>

      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <span
          className="text-xs font-medium"
          style={{ color, fontFamily: 'var(--font-body)' }}
        >
          ~{pct}%
        </span>
        <span
          className="text-[11px]"
          style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}
        >
          {countdown}
        </span>
      </div>
    </article>
  );
});

export default NextEventCard;
