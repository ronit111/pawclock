import { memo, useEffect, useState, type CSSProperties } from 'react';
import type { EventType, PredictionWindow } from '../../types';

interface NextEventCardProps {
  eventType: EventType;
  window: PredictionWindow;
  isPrimary?: boolean;
}

function getEventConfig(type: EventType) {
  switch (type) {
    case 'pee':
      return {
        label: 'Bathroom break',
        subtitle: 'Likely pee window',
        color: 'var(--color-pee)',
        tint: 'var(--color-pee-soft)',
        glow: 'var(--color-pee-glow)',
        Icon: () => (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M9 2C9 2 5 7 5 11a4 4 0 008 0C13 7 9 2 9 2z" fill="currentColor" opacity="0.92" />
          </svg>
        ),
      };
    case 'poop':
      return {
        label: 'Digestive window',
        subtitle: 'Likely poop window',
        color: 'var(--color-poop)',
        tint: 'var(--color-poop-soft)',
        glow: 'var(--color-poop-glow)',
        Icon: () => (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <ellipse cx="9" cy="13" rx="5" ry="2.5" fill="currentColor" opacity="0.7" />
            <ellipse cx="9" cy="11" rx="4" ry="2" fill="currentColor" opacity="0.84" />
            <ellipse cx="9" cy="9.4" rx="3" ry="1.75" fill="currentColor" />
            <ellipse cx="9" cy="8" rx="2.2" ry="1.4" fill="currentColor" />
            <path d="M8 6.2C8 5.2 9.5 4.4 9 3.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          </svg>
        ),
      };
    case 'sleep_start':
      return {
        label: 'Rest window',
        subtitle: 'Likely sleep onset',
        color: 'var(--color-sleep)',
        tint: 'var(--color-sleep-soft)',
        glow: 'var(--color-sleep-glow)',
        Icon: () => (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M14 9.5A6 6 0 119.5 4a4.5 4.5 0 104.5 5.5z" fill="currentColor" opacity="0.92" />
            <circle cx="13.5" cy="4.5" r="1" fill="currentColor" />
            <circle cx="15.5" cy="7" r="0.7" fill="currentColor" />
          </svg>
        ),
      };
    case 'sleep_end':
      return {
        label: 'Wake window',
        subtitle: 'Likely wake time',
        color: 'var(--color-sleep)',
        tint: 'var(--color-sleep-soft)',
        glow: 'var(--color-sleep-glow)',
        Icon: () => (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <circle cx="9" cy="10" r="4" fill="currentColor" opacity="0.9" />
            <path d="M9 3v2M9 15v2M3 10H1M17 10h-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        ),
      };
  }
}

function formatTimeWindow(startTime: number, endTime: number): string {
  const format = (ts: number) =>
    new Date(ts).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  return `${format(startTime)} - ${format(endTime)}`;
}

function formatCountdown(targetTime: number): string {
  const diffMs = targetTime - Date.now();
  if (diffMs < 0) return 'Now';
  const totalMin = Math.round(diffMs / 60_000);
  if (totalMin < 60) return `In ${totalMin} min`;
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  return minutes > 0 ? `In ${hours}h ${minutes}m` : `In ${hours}h`;
}

const NextEventCard = memo(function NextEventCard({
  eventType,
  window,
  isPrimary = false,
}: NextEventCardProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((value) => value + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const config = getEventConfig(eventType);
  const { color, glow, tint, label, subtitle, Icon } = config;
  const confidence = Math.round(window.confidence * 100);
  const countdown = formatCountdown(window.peakTime);
  const timeRange = formatTimeWindow(window.startTime, window.endTime);

  if (isPrimary) {
    return (
      <article
        className="surface-card-hero ambient-glow overflow-hidden p-5"
        style={
          {
            '--glow-color': glow,
            background: `linear-gradient(180deg, ${tint} 0%, rgba(255,255,255,0.98) 100%)`,
          } as CSSProperties
        }
        aria-label={`${subtitle}: ${timeRange}, ${confidence}% likely, ${countdown}`}
      >
        <div className="flex flex-col gap-4">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="icon-badge shrink-0"
                style={{ background: tint, color }}
              >
                <Icon />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="metric-label" style={{ color }}>
                  Spotlight window
                </span>
                <span className="truncate text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {label}
                </span>
              </div>
            </div>

            <div className="info-pill shrink-0 whitespace-nowrap" style={{ color }}>
              {confidence}% likely
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <span className="truncate font-data text-[1.9rem] leading-[1.05]" style={{ color: 'var(--color-text-primary)' }}>
              {timeRange}
            </span>
            <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              <span>{subtitle}</span>
              <span style={{ color: 'var(--color-text-faint)' }}>/</span>
              <span>{countdown}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>
              <span>Confidence</span>
              <span>{confidence}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full" style={{ background: 'rgba(127,100,76,0.12)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${confidence}%`,
                  background: `linear-gradient(90deg, ${color} 0%, ${color}bb 100%)`,
                  boxShadow: `0 0 20px ${glow}`,
                }}
              />
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className="surface-card p-4"
      aria-label={`${subtitle}: ${timeRange}, ${confidence}% likely, ${countdown}`}
    >
      <div className="flex min-w-0 items-start gap-4">
        <div
          className="icon-badge shrink-0"
          style={{ background: tint, color }}
        >
          <Icon />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="metric-label" style={{ color }}>
            {subtitle}
          </span>
          <span className="truncate font-data text-[1.45rem] leading-tight" style={{ color: 'var(--color-text-primary)' }}>
            {timeRange}
          </span>
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {countdown}
          </span>
        </div>

        <div className="shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold" style={{ background: tint, color }}>
          {confidence}%
        </div>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(127,100,76,0.1)' }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${confidence}%`,
            background: `linear-gradient(90deg, ${color} 0%, ${color}bb 100%)`,
          }}
        />
      </div>
    </article>
  );
});

export default NextEventCard;
