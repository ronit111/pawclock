/**
 * Anomaly detection and health alert generation.
 *
 * Three-layer detection system:
 *
 * Layer 1 — Predictive surprise (per-event):
 *   Score = -log p(event | model). Under a well-calibrated model,
 *   scores follow Exp(1) with mean=1. High scores = surprising events.
 *
 * Layer 2 — Rolling 7-day aggregate:
 *   Mean score over last ~35 events (≈7 days × 5 events/day).
 *   Null: E[score] = 1 under Exp(1). Alert threshold: 1.28 (95th percentile
 *   of the sample mean under Exp(1) for n=35, CLT: mean ± 1.65/√35 × 1 ≈ 1.28).
 *
 * Layer 3 — Clinical rule-based thresholds:
 *   Hard rules encoded from veterinary clinical guidelines.
 */

import type {
  PetEvent,
  CycleModelState,
  CyclePrediction,
  HealthAlert,
  AlertSeverity,
  EventType,
} from '../types/index.ts';
import { gammaPdf, gammaSurvival } from '../utils/math.ts';
import { getEffectiveShape } from './model.ts';

// ─── Predictive Surprise ──────────────────────────────────────────────────────

/**
 * Compute the predictive surprise (anomaly score) for a single observed event.
 *
 * Score = -log p(eventTime | prediction density)
 *
 * Interpretation:
 *   score < 1.0  — typical event, model was confident
 *   score 1–2    — slightly surprising, normal variation
 *   score 2–4    — moderately surprising (top 10–2% under null)
 *   score > 4    — highly anomalous (top 2% under Exp(1) null)
 *
 * @param observed   - The observed event
 * @param prediction - The prediction that was active when the event occurred
 */
export function computeAnomalyScore(
  observed: PetEvent,
  prediction: CyclePrediction,
): number {
  const { density } = prediction.density;
  const startTime = prediction.density.startTime;
  const MS_PER_5MIN = 300_000;

  // Find the bin corresponding to this event
  const binIdx = Math.floor((observed.timestamp - startTime) / MS_PER_5MIN);

  if (binIdx < 0 || binIdx >= density.length) {
    // Event falls outside the prediction window — use model-based surprise
    return computeModelBasedSurprise(observed, prediction);
  }

  const d = density[binIdx];

  // Guard against zero density (very rare event timing)
  if (d <= 0) return 10; // Cap at 10 for extreme outliers

  return Math.min(-Math.log(d), 10);
}

/**
 * Compute surprise for an event that falls outside the prediction window.
 *
 * Falls back to Gamma model surprise: -log f_Gamma(interval | k, λ)
 * normalized to mean = 1 under the prior.
 */
function computeModelBasedSurprise(
  observed: PetEvent,
  prediction: CyclePrediction,
): number {
  const { nextEventEstimate } = prediction;

  // Compute interval from expected time
  const diffHours = Math.abs(observed.timestamp - nextEventEstimate.expectedTime) / 3_600_000;

  // Score as a multiple of the expected window width
  const windowWidthHours =
    (nextEventEstimate.window80.endTime - nextEventEstimate.window80.startTime) / 3_600_000;

  if (windowWidthHours <= 0) return 1;

  // Soft score: 1 standard deviation outside window = score 2
  const deviations = diffHours / Math.max(windowWidthHours / 4, 0.1);
  return Math.min(1 + deviations * 0.5, 10);
}

// ─── Rolling Aggregate ────────────────────────────────────────────────────────

/**
 * Evaluate rolling anomaly status from recent anomaly scores.
 *
 * Statistical basis:
 *   Under a well-calibrated Exp(1) null model, n i.i.d. scores have
 *   sample mean ~ Normal(1, 1/n) by CLT for large n.
 *   95th percentile for n=35: 1 + 1.65/√35 = 1.279 → threshold = 1.28
 *   99th percentile: 1 + 2.33/√35 = 1.394 → threshold = 1.39
 *
 * @param recentScores - Array of recent anomaly scores (ordered oldest to newest)
 */
export function evaluateRollingAnomaly(recentScores: number[]): {
  isAnomalous: boolean;
  severity: AlertSeverity;
  rollingMean: number;
} {
  if (recentScores.length < 5) {
    return { isAnomalous: false, severity: 'info', rollingMean: 0 };
  }

  // Use last 35 scores (≈7 days for daily events)
  const window = recentScores.slice(-35);
  const mean = window.reduce((s, v) => s + v, 0) / window.length;

  // Scale threshold slightly for small windows (conservative)
  const n = window.length;
  const stdErrScale = 1 / Math.sqrt(n);
  const yellowThreshold = 1 + 1.65 * stdErrScale + 0.28; // 95th pct + small sample buffer
  const redThreshold = 1 + 2.33 * stdErrScale + 0.28;    // 99th pct + buffer

  if (mean >= redThreshold) {
    return { isAnomalous: true, severity: 'red', rollingMean: mean };
  } else if (mean >= yellowThreshold) {
    return { isAnomalous: true, severity: 'yellow', rollingMean: mean };
  }

  return { isAnomalous: false, severity: 'info', rollingMean: mean };
}

// ─── Clinical Rule-Based Thresholds ──────────────────────────────────────────

/**
 * Check all clinical threshold rules and return active health alerts.
 *
 * Rules are stateless — they read event history and model state and
 * return the current set of triggered alerts. Deduplication is the
 * caller's responsibility.
 *
 * @param events     - All recent events for this pet (filtered by type externally)
 * @param modelState - Current model state for the relevant cycle type
 */
export function checkClinicalThresholds(
  events: PetEvent[],
  modelState: CycleModelState,
): HealthAlert[] {
  const alerts: HealthAlert[] = [];
  const now = Date.now();

  if (events.length < 3) return alerts; // Insufficient data

  const eventType = modelState.eventType;
  const petId = events[0]?.petId ?? '';

  // Compute baseline frequency (events per hour)
  const k = getEffectiveShape(modelState.shapeGrid);
  const lambda = modelState.ratePosterior.a / modelState.ratePosterior.b;
  const baselineIntervalHours = k / lambda; // Gamma mean = k/λ

  switch (eventType) {
    case 'pee': {
      alerts.push(...checkPolyuria(events, petId, baselineIntervalHours, now));
      alerts.push(...checkFrequencyIncrease(events, petId, 'pee', baselineIntervalHours, now));
      break;
    }
    case 'poop': {
      alerts.push(...checkConstipation(events, petId, baselineIntervalHours, now));
      alerts.push(...checkFrequencyIncrease(events, petId, 'poop', baselineIntervalHours, now));
      break;
    }
    case 'sleep_start':
    case 'sleep_end': {
      alerts.push(...checkSleepChange(events, petId, eventType, baselineIntervalHours, now));
      break;
    }
  }

  return alerts;
}

// ─── Clinical Rule Implementations ───────────────────────────────────────────

/**
 * Polyuria rule: urination frequency ≥ 2× baseline for 2+ consecutive days.
 */
function checkPolyuria(
  events: PetEvent[],
  petId: string,
  baselineIntervalHours: number,
  now: number,
): HealthAlert[] {
  const alerts: HealthAlert[] = [];
  const MS_PER_DAY = 86_400_000;

  // Compute daily frequencies for last 7 days
  const dailyCounts = getDailyEventCounts(events, now, 7);

  // Baseline: events per day
  const baselinePerDay = 24 / baselineIntervalHours;

  // Check last 2 consecutive days
  const last2 = dailyCounts.slice(-2);
  if (last2.length < 2) return alerts;

  const bothElevated = last2.every((c) => c >= baselinePerDay * 2);

  if (bothElevated) {
    const avgCount = last2.reduce((s, v) => s + v, 0) / last2.length;
    alerts.push({
      id: `polyuria-${petId}-${now}`,
      petId,
      severity: 'red',
      title: 'Possible Polyuria',
      description:
        `Urination frequency is ${(avgCount / baselinePerDay).toFixed(1)}× the established ` +
        `baseline for 2+ days. This can indicate kidney disease, diabetes, or urinary tract ` +
        `infection. Consider veterinary consultation.`,
      detectedAt: now,
      eventType: 'pee',
      metric: 'frequency_increase',
      value: avgCount,
      threshold: baselinePerDay * 2,
      dismissed: false,
    });
  }

  void MS_PER_DAY; // used implicitly in getDailyEventCounts
  return alerts;
}

/**
 * Constipation rule:
 *   No defecation for 48–72h → yellow alert
 *   No defecation for 72h+  → red alert
 */
function checkConstipation(
  events: PetEvent[],
  petId: string,
  baselineIntervalHours: number,
  now: number,
): HealthAlert[] {
  const alerts: HealthAlert[] = [];

  // Find most recent poop event
  const sorted = [...events]
    .filter((e) => e.type === 'poop')
    .sort((a, b) => b.timestamp - a.timestamp);

  if (sorted.length === 0) return alerts;

  const lastPoopTime = sorted[0].timestamp;
  const gapHours = (now - lastPoopTime) / 3_600_000;

  // Use model baseline to determine threshold, minimum 24h
  const yellowThreshold = Math.max(baselineIntervalHours * 3, 48);
  const redThreshold = Math.max(baselineIntervalHours * 4.5, 72);

  if (gapHours >= redThreshold) {
    alerts.push({
      id: `constipation-red-${petId}-${now}`,
      petId,
      severity: 'red',
      title: 'Possible Constipation',
      description:
        `No defecation detected for ${gapHours.toFixed(0)} hours (threshold: ${redThreshold.toFixed(0)}h). ` +
        `Seek veterinary attention if accompanied by straining, vomiting, or lethargy.`,
      detectedAt: now,
      eventType: 'poop',
      metric: 'long_gap',
      value: gapHours,
      threshold: redThreshold,
      dismissed: false,
    });
  } else if (gapHours >= yellowThreshold) {
    alerts.push({
      id: `constipation-yellow-${petId}-${now}`,
      petId,
      severity: 'yellow',
      title: 'Infrequent Defecation',
      description:
        `No defecation detected for ${gapHours.toFixed(0)} hours. Monitor for signs of ` +
        `discomfort or straining. Ensure adequate hydration and exercise.`,
      detectedAt: now,
      eventType: 'poop',
      metric: 'long_gap',
      value: gapHours,
      threshold: yellowThreshold,
      dismissed: false,
    });
  }

  return alerts;
}

/**
 * General frequency increase rule: ≥50% increase in frequency for 3+ days.
 */
function checkFrequencyIncrease(
  events: PetEvent[],
  petId: string,
  eventType: EventType,
  baselineIntervalHours: number,
  now: number,
): HealthAlert[] {
  const alerts: HealthAlert[] = [];

  const daily = getDailyEventCounts(events, now, 7);
  if (daily.length < 4) return alerts;

  const baseline7day = daily.slice(0, 4).reduce((s, v) => s + v, 0) / 4;
  const last3 = daily.slice(-3);

  if (last3.length < 3) return alerts;

  const last3avg = last3.reduce((s, v) => s + v, 0) / 3;

  // Use max of model baseline and observed 7-day baseline
  const baselinePerDay = 24 / baselineIntervalHours;
  const effectiveBaseline = Math.max(baseline7day, baselinePerDay * 0.5);

  if (last3avg >= effectiveBaseline * 1.5) {
    const increasePct = ((last3avg / effectiveBaseline - 1) * 100).toFixed(0);
    alerts.push({
      id: `freq-increase-${eventType}-${petId}-${now}`,
      petId,
      severity: 'yellow',
      title: `Increased ${eventType === 'pee' ? 'Urination' : 'Defecation'} Frequency`,
      description:
        `${eventType === 'pee' ? 'Urination' : 'Defecation'} frequency is approximately ` +
        `${increasePct}% above recent baseline for 3+ days. Monitor for associated symptoms.`,
      detectedAt: now,
      eventType,
      metric: 'frequency_increase',
      value: last3avg,
      threshold: effectiveBaseline * 1.5,
      dismissed: false,
    });
  }

  return alerts;
}

/**
 * Sleep change rule: sleep duration or frequency changed >25% for 3+ days.
 */
function checkSleepChange(
  events: PetEvent[],
  petId: string,
  eventType: EventType,
  baselineIntervalHours: number,
  now: number,
): HealthAlert[] {
  const alerts: HealthAlert[] = [];

  const daily = getDailyEventCounts(events, now, 7);
  if (daily.length < 4) return alerts;

  const earlierMean = daily.slice(0, 4).reduce((s, v) => s + v, 0) / 4;
  const recentMean = daily.slice(-3).reduce((s, v) => s + v, 0) / 3;

  if (earlierMean === 0) return alerts;

  const changePct = Math.abs(recentMean - earlierMean) / earlierMean;

  // Use baseline interval to detect anomalous changes (guard against very small baseline)
  void baselineIntervalHours;

  if (changePct >= 0.25 && daily.slice(-3).length >= 3) {
    const direction = recentMean > earlierMean ? 'increased' : 'decreased';
    alerts.push({
      id: `sleep-change-${eventType}-${petId}-${now}`,
      petId,
      severity: 'yellow',
      title: `Sleep Pattern Change`,
      description:
        `${eventType === 'sleep_start' ? 'Sleep onset' : 'Wake-up'} frequency has ${direction} ` +
        `by ${(changePct * 100).toFixed(0)}% over the last 3 days. Sustained sleep changes ` +
        `may indicate stress, pain, or illness.`,
      detectedAt: now,
      eventType,
      metric: 'sleep_frequency_change',
      value: changePct,
      threshold: 0.25,
      dismissed: false,
    });
  }

  return alerts;
}

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Compute per-day event counts for the last `nDays` days.
 * Returns array of length nDays, index 0 = oldest day.
 */
function getDailyEventCounts(events: PetEvent[], now: number, nDays: number): number[] {
  const MS_PER_DAY = 86_400_000;
  const counts = new Array<number>(nDays).fill(0);

  for (const event of events) {
    const daysAgo = Math.floor((now - event.timestamp) / MS_PER_DAY);
    if (daysAgo >= 0 && daysAgo < nDays) {
      // Index 0 = oldest (nDays-1 days ago), index nDays-1 = most recent (today)
      counts[nDays - 1 - daysAgo]++;
    }
  }

  return counts;
}

/**
 * Compute intervals between consecutive events of a given type.
 * Returns array of intervals in hours.
 */
export function computeIntervals(events: PetEvent[], eventType: EventType): number[] {
  const filtered = events
    .filter((e) => e.type === eventType)
    .sort((a, b) => a.timestamp - b.timestamp);

  const intervals: number[] = [];
  for (let i = 1; i < filtered.length; i++) {
    const hours = (filtered[i].timestamp - filtered[i - 1].timestamp) / 3_600_000;
    if (hours > 0 && hours < 168) intervals.push(hours);
  }
  return intervals;
}

/**
 * Compute a model-based anomaly score for an event using only the Gamma posterior.
 * Used when no prediction window is available (cold-start or gap).
 *
 * @param intervalHours - Observed inter-event interval
 * @param state         - Current model state
 */
export function computeIntervalAnomalyScore(
  intervalHours: number,
  state: CycleModelState,
): number {
  if (intervalHours <= 0) return 0;

  const k = getEffectiveShape(state.shapeGrid);
  const lambda = state.ratePosterior.a / state.ratePosterior.b;

  const pdf = gammaPdf(intervalHours, k, lambda);
  const survival = gammaSurvival(intervalHours, k, lambda);

  // Normalize by the modal density (peak of Gamma = (k-1)/λ for k>1)
  const peakX = k > 1 ? (k - 1) / lambda : 0.01;
  const peakPdf = gammaPdf(peakX, k, lambda);

  if (peakPdf <= 0) return 0;

  // Score as predictive surprise relative to null Exp(1) model
  const normalizedDensity = pdf / peakPdf;

  // Hazard-based: how surprising is this timing given we survived to here?
  const hazardAtInterval = survival > 0 ? pdf / survival : lambda;
  const expectedHazard = lambda; // Exponential null model

  const hazardRatio = hazardAtInterval / expectedHazard;
  const score = Math.max(-Math.log(Math.min(normalizedDensity, 1)), 0);

  // Blend density and hazard scores
  return score * 0.7 + Math.max(-Math.log(Math.min(hazardRatio, 1)), 0) * 0.3;
}
