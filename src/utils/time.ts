/**
 * Time utility functions for PawClock.
 *
 * All timestamps are Unix milliseconds.
 * "Hour of day" is fractional hours in local timezone (0–24).
 */

// ─── Bin Calculations ─────────────────────────────────────────

/**
 * Convert a Unix ms timestamp to fractional hours (0–24) in the
 * browser's local timezone.
 *
 * Example: 14:30 local → 14.5
 */
export function timestampToHourOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

/**
 * Get the half-hour bin index (0–47) for a timestamp in local time.
 *
 * Bin 0 = 00:00–00:30, Bin 1 = 00:30–01:00, ... Bin 47 = 23:30–24:00
 */
export function timestampToCircadianBin(timestamp: number): number {
  const hourOfDay = timestampToHourOfDay(timestamp);
  return Math.floor(hourOfDay * 2) % 48;
}

/**
 * Get the 5-minute bin index (0–287) for a timestamp relative to
 * a given start time. The 288-bin window covers exactly 24 hours.
 *
 * Returns a value clamped to [0, 287].
 */
export function timestampTo5MinBin(
  timestamp: number,
  startTime: number,
): number {
  const elapsedMs = timestamp - startTime;
  const binIndex = Math.floor(elapsedMs / (5 * 60 * 1000));
  return Math.max(0, Math.min(287, binIndex));
}

// ─── Formatting ───────────────────────────────────────────────

/**
 * Format a Unix ms timestamp as a human-readable time string.
 *
 * Example: 1700000000000 → "2:30 PM"
 */
export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format a time range as a compact string sharing the AM/PM suffix
 * when both times are in the same period.
 *
 * Example: "2:30 – 3:15 PM"
 */
export function formatTimeRange(start: number, end: number): string {
  const startDate = new Date(start);
  const endDate = new Date(end);

  const startHour = startDate.getHours();
  const endHour = endDate.getHours();

  const startPeriod = startHour < 12 ? 'AM' : 'PM';
  const endPeriod = endHour < 12 ? 'AM' : 'PM';

  const formatHHMM = (date: Date): string => {
    const h = date.getHours() % 12 || 12;
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  if (startPeriod === endPeriod) {
    return `${formatHHMM(startDate)} – ${formatHHMM(endDate)} ${endPeriod}`;
  }

  return `${formatHHMM(startDate)} ${startPeriod} – ${formatHHMM(endDate)} ${endPeriod}`;
}

/**
 * Format a duration in milliseconds as a human-readable string.
 *
 * Examples:
 *   135000 ms  → "~2m"
 *   8100000 ms → "~2h 15m"
 *   86400000   → "~24h"
 */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000);

  if (totalMinutes < 60) {
    return `~${totalMinutes}m`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `~${hours}h`;
  }

  return `~${hours}h ${minutes}m`;
}

// ─── Day Boundaries ───────────────────────────────────────────

/**
 * Get Unix ms for the start of today (midnight) in local timezone.
 */
export function startOfToday(): number {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  ).getTime();
}

/**
 * Get Unix ms for a specific fractional hour today in local timezone.
 *
 * @param hour Fractional hour in 24h format (e.g., 7.5 = 7:30 AM)
 */
export function hourToTimestamp(hour: number): number {
  const midnight = startOfToday();
  return midnight + hour * 60 * 60 * 1000;
}

/**
 * Count the number of whole days between two Unix ms timestamps.
 *
 * Always returns a non-negative integer (order-independent).
 */
export function daysBetween(a: number, b: number): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.floor(Math.abs(b - a) / MS_PER_DAY);
}
