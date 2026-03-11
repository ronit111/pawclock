/**
 * Mock data for PawClock UI development.
 * Provides realistic prediction data for "Luna" — an adult female cat.
 */

import type {
  PetProfile,
  PetPrediction,
  PetEvent,
  CyclePrediction,
  PredictionDensity,
  PredictionWindow,
} from '../types';

// ─── Pet Profile ──────────────────────────────────────────────

export const MOCK_PET: PetProfile = {
  id: 'luna-001',
  name: 'Luna',
  species: 'cat',
  breed: 'Domestic Shorthair',
  sizeClass: 'small',
  ageMonths: 36, // 3 years old
  weightKg: 4.2,
  neutered: true,
  indoor: true,
  brachycephalic: false,
  dietType: 'dry',
  mealTimes: [7.5, 18.0], // 7:30 AM, 6:00 PM
  createdAt: Date.now() - 1000 * 60 * 60 * 24 * 30, // 30 days ago
};

// ─── Gaussian Helpers ─────────────────────────────────────────

/** Returns a value from a Gaussian/normal distribution */
function gaussian(x: number, mean: number, sigma: number): number {
  return Math.exp(-0.5 * ((x - mean) / sigma) ** 2);
}

/**
 * Creates a 288-bin (5-min intervals) probability density for 24 hours.
 * Peaks are defined as [hourDecimal, sigma, amplitude].
 */
function buildDensity(
  peaks: Array<[number, number, number]>,
  startTime: number,
): PredictionDensity {
  const density = new Float64Array(288);
  const cumulative = new Float64Array(288);

  for (let i = 0; i < 288; i++) {
    const hourDecimal = i * (24 / 288); // 0 to 24 in steps of 5/60
    let value = 0;
    for (const [mean, sigma, amplitude] of peaks) {
      value += amplitude * gaussian(hourDecimal, mean, sigma);
    }
    density[i] = Math.min(1, value);
  }

  // Compute cumulative
  let sum = 0;
  for (let i = 0; i < 288; i++) {
    sum += density[i];
    cumulative[i] = sum;
  }
  // Normalize cumulative to [0, 1]
  const total = cumulative[287] || 1;
  for (let i = 0; i < 288; i++) {
    cumulative[i] = cumulative[i] / total;
  }

  return { startTime, density, cumulative };
}

function makeWindow(
  startHour: number,
  endHour: number,
  peakHour: number,
  confidence: number,
  date: Date = new Date(),
): PredictionWindow {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const base = dayStart.getTime();

  return {
    startTime: base + startHour * 3600_000,
    endTime: base + endHour * 3600_000,
    peakTime: base + peakHour * 3600_000,
    confidence,
    peakProbability: confidence * 0.9,
  };
}

// ─── Prediction Density Arrays ────────────────────────────────

const now = new Date();
const dayStart = new Date(now);
dayStart.setHours(0, 0, 0, 0);
const dayStartMs = dayStart.getTime();

// Pee: peaks around 8am, 1pm, 6pm (post-meals + afternoon)
const peeDensity = buildDensity(
  [
    [7.5, 0.6, 0.9], // Morning post-meal
    [13.0, 0.5, 0.75], // Afternoon
    [18.5, 0.6, 0.85], // Evening post-meal
    [22.0, 0.4, 0.5], // Late night
  ],
  dayStartMs,
);

// Poop: peaks ~1h after meals, so ~8:30am, ~7pm
const poopDensity = buildDensity(
  [
    [8.5, 0.7, 0.85], // Morning post-meal
    [19.0, 0.8, 0.9], // Evening post-meal
  ],
  dayStartMs,
);

// Sleep: cat naps throughout the day + overnight block
const sleepStartDensity = buildDensity(
  [
    [1.0, 0.4, 0.6], // Late night nap start
    [10.0, 0.5, 0.8], // Mid-morning nap
    [14.0, 0.6, 0.9], // Afternoon nap (peak)
    [20.0, 0.5, 0.7], // Evening nap
  ],
  dayStartMs,
);

const sleepEndDensity = buildDensity(
  [
    [3.0, 0.5, 0.5],
    [7.5, 0.4, 0.7], // Wake for morning meal
    [12.0, 0.6, 0.8],
    [16.0, 0.5, 0.75],
    [22.0, 0.4, 0.6],
  ],
  dayStartMs,
);

// ─── Prediction Windows ───────────────────────────────────────

const peeWindows: PredictionWindow[] = [
  makeWindow(7.0, 8.5, 7.5, 0.82),
  makeWindow(12.2, 14.0, 13.0, 0.71),
  makeWindow(17.8, 19.5, 18.5, 0.78),
];

const poopWindows: PredictionWindow[] = [
  makeWindow(8.0, 9.5, 8.5, 0.76),
  makeWindow(18.5, 20.5, 19.0, 0.83),
];

const sleepStartWindows: PredictionWindow[] = [
  makeWindow(9.5, 11.0, 10.0, 0.68),
  makeWindow(13.5, 15.0, 14.0, 0.85),
  makeWindow(19.5, 21.0, 20.0, 0.72),
];

const sleepEndWindows: PredictionWindow[] = [
  makeWindow(7.0, 8.0, 7.5, 0.79),
  makeWindow(11.5, 13.0, 12.0, 0.74),
  makeWindow(15.5, 17.0, 16.0, 0.69),
];

// ─── Next Event Estimates ─────────────────────────────────────

function nextEventEstimate(peakHour: number, confidence: number) {
  return {
    expectedTime: dayStartMs + peakHour * 3600_000,
    window80: makeWindow(peakHour - 1, peakHour + 1, peakHour, confidence * 0.8),
    window50: makeWindow(peakHour - 0.5, peakHour + 0.5, peakHour, confidence),
  };
}

// ─── Full Prediction Object ───────────────────────────────────

const peePrediction: CyclePrediction = {
  eventType: 'pee',
  density: peeDensity,
  windows: peeWindows,
  nextEventEstimate: nextEventEstimate(13.0, 0.71),
  modelConfidence: 0.68,
  anomalyScore: 0.12,
};

const poopPrediction: CyclePrediction = {
  eventType: 'poop',
  density: poopDensity,
  windows: poopWindows,
  nextEventEstimate: nextEventEstimate(19.0, 0.83),
  modelConfidence: 0.74,
  anomalyScore: 0.08,
};

const sleepStartPrediction: CyclePrediction = {
  eventType: 'sleep_start',
  density: sleepStartDensity,
  windows: sleepStartWindows,
  nextEventEstimate: nextEventEstimate(14.0, 0.85),
  modelConfidence: 0.81,
  anomalyScore: 0.05,
};

const sleepEndPrediction: CyclePrediction = {
  eventType: 'sleep_end',
  density: sleepEndDensity,
  windows: sleepEndWindows,
  nextEventEstimate: nextEventEstimate(16.0, 0.69),
  modelConfidence: 0.77,
  anomalyScore: 0.07,
};

export const MOCK_PREDICTION: PetPrediction = {
  petId: 'luna-001',
  generatedAt: Date.now(),
  pee: peePrediction,
  poop: poopPrediction,
  sleepStart: sleepStartPrediction,
  sleepEnd: sleepEndPrediction,
};

// ─── Mock Recent Events (last 7 days) ────────────────────────

function makeEvent(
  type: PetEvent['type'],
  daysAgo: number,
  hourDecimal: number,
  extras: Record<string, unknown> = {},
): PetEvent {
  const ts =
    dayStartMs -
    daysAgo * 86400_000 +
    Math.round(hourDecimal * 3600_000);

  const base = {
    id: `mock-${type}-${daysAgo}-${hourDecimal}`,
    petId: 'luna-001',
    timestamp: ts,
    createdAt: ts,
  };

  if (type === 'pee') {
    return { ...base, type: 'pee', volume: 'normal', color: 'normal', ...extras } as PetEvent;
  }
  if (type === 'poop') {
    return { ...base, type: 'poop', consistencyScore: 4, size: 'normal', ...extras } as PetEvent;
  }
  if (type === 'sleep_start') {
    return { ...base, type: 'sleep_start' } as PetEvent;
  }
  return { ...base, type: 'sleep_end' } as PetEvent;
}

export const MOCK_EVENTS: PetEvent[] = [
  // Today
  makeEvent('sleep_end', 0, 7.4),
  makeEvent('pee', 0, 7.6, { volume: 'large' }),
  makeEvent('poop', 0, 8.3),
  makeEvent('sleep_start', 0, 10.1),
  makeEvent('sleep_end', 0, 11.8),
  makeEvent('pee', 0, 12.9, { volume: 'normal' }),

  // Yesterday
  makeEvent('sleep_end', 1, 7.2),
  makeEvent('pee', 1, 7.5, { volume: 'normal' }),
  makeEvent('poop', 1, 8.6),
  makeEvent('sleep_start', 1, 9.8),
  makeEvent('sleep_end', 1, 12.1),
  makeEvent('pee', 1, 13.1),
  makeEvent('sleep_start', 1, 14.2),
  makeEvent('sleep_end', 1, 16.0),
  makeEvent('pee', 1, 18.4, { volume: 'normal' }),
  makeEvent('poop', 1, 19.1),
  makeEvent('sleep_start', 1, 21.0),

  // 2 days ago
  makeEvent('sleep_end', 2, 7.5),
  makeEvent('pee', 2, 7.8, { volume: 'small' }),
  makeEvent('poop', 2, 8.2, { consistencyScore: 3 }),
  makeEvent('pee', 2, 13.3),
  makeEvent('pee', 2, 18.6),
  makeEvent('poop', 2, 19.4),
  makeEvent('sleep_start', 2, 20.5),

  // 3-6 days ago (sparser)
  makeEvent('pee', 3, 7.4),
  makeEvent('poop', 3, 8.8),
  makeEvent('pee', 3, 13.0),
  makeEvent('pee', 3, 18.8),
  makeEvent('poop', 3, 19.2),

  makeEvent('pee', 4, 7.6),
  makeEvent('poop', 4, 8.4),
  makeEvent('pee', 4, 12.8),
  makeEvent('pee', 4, 18.5),
  makeEvent('poop', 4, 19.0),

  makeEvent('pee', 5, 7.3),
  makeEvent('poop', 5, 9.0),
  makeEvent('pee', 5, 13.2),
  makeEvent('pee', 5, 18.3),

  makeEvent('pee', 6, 7.7),
  makeEvent('poop', 6, 8.6),
  makeEvent('pee', 6, 12.5),
  makeEvent('pee', 6, 18.9),
  makeEvent('poop', 6, 19.5),
];

// ─── Helper: Today's events ───────────────────────────────────

export function getTodayEvents(): PetEvent[] {
  const todayStart = dayStartMs;
  return MOCK_EVENTS.filter((e) => e.timestamp >= todayStart);
}
