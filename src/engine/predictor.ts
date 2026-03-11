/**
 * Prediction generation engine.
 *
 * Produces probabilistic 24-hour prediction densities from Bayesian model states.
 *
 * Algorithm overview (per bin, for 288 five-minute bins):
 *
 *   1. Compute time since last event: t = (binTime - lastEventTime) in hours
 *   2. Gamma hazard: h(t) = f_Gamma(t | k, λ) / S_Gamma(t | k, λ)
 *      where k = E[k | grid], λ = a_posterior / b_posterior
 *   3. Circadian weight: c(bin) = E_Dirichlet[alpha_{binClock}] × 48
 *      (normalized to mean = 1, so it acts as a multiplicative modifier)
 *   4. Meal effect (poop only): Σ_meals amplitude × φ(t - mealLag | lagSigma)
 *      where t is hours since meal and φ is a Gaussian kernel
 *   5. Total intensity: λ_total(t) = h(t) × c(bin) + mealEffect(t)
 *   6. Bin density: d[i] = λ_total(tᵢ) × S(i) × Δt
 *      where S(i) is the survival probability up to bin i
 *   7. Update survival: S(i+1) = S(i) × exp(-λ_total(tᵢ) × Δt)
 *
 * The resulting density array integrates (approximately) to 1 over 24h.
 */

import type {
  CycleModelState,
  PetModelState,
  PetProfile,
  CyclePrediction,
  PetPrediction,
  PredictionDensity,
  PredictionWindow,
} from '../types/index.ts';
import { gammaHazard, gammaSurvival, gaussianKernel, dirichletExpectation } from '../utils/math.ts';
import { getEffectiveShape } from './model.ts';

// ─── Constants ────────────────────────────────────────────────────────────────

const BINS_PER_HOUR = 12;           // 5-minute bins
const BIN_WIDTH_HOURS = 1 / 12;     // 5 minutes in hours
const TOTAL_BINS = 288;             // 24 hours × 12 bins/hour
const CIRCADIAN_BINS = 48;          // 30-min circadian bins
const CIRCADIAN_BIN_MINUTES = 30;
const MS_PER_HOUR = 3_600_000;
const MS_PER_5MIN = 300_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Map a Unix timestamp to a circadian bin [0, 47].
 */
function toCadenceBin(ts: number): number {
  const d = new Date(ts);
  const minuteOfDay = d.getHours() * 60 + d.getMinutes();
  return Math.floor(minuteOfDay / CIRCADIAN_BIN_MINUTES) % CIRCADIAN_BINS;
}

/**
 * Compute circadian weight for a given circadian bin.
 *
 * Dirichlet expectation normalized so the mean weight = 1.
 * Values > 1 indicate above-average circadian activity; < 1 below-average.
 */
function circadianWeight(alpha: number[], cirBin: number): number {
  const w = dirichletExpectation(alpha, cirBin);
  return w * CIRCADIAN_BINS; // normalize: sum of weights = 48 bins × w_mean = 1 per bin
}

/**
 * Compute meal coupling intensity for defecation at time `hoursAfterEvent`.
 *
 * hoursAfterEvent: hours since last defecation event (not since meal).
 * mealTimestamps: Unix ms of recent meals within 12h.
 * currentBinTime: Unix ms of the bin being evaluated.
 */
function mealCouplingIntensity(
  lagMean: number,
  lagSigma: number,
  amplitude: number,
  mealTimestamps: number[],
  currentBinTime: number,
): number {
  let total = 0;
  for (const mealTs of mealTimestamps) {
    const hoursSinceMeal = (currentBinTime - mealTs) / MS_PER_HOUR;
    if (hoursSinceMeal >= 0 && hoursSinceMeal < 6) {
      // Gaussian kernel centered on lagMean hours post-meal
      total += amplitude * gaussianKernel(hoursSinceMeal, lagMean, lagSigma);
    }
  }
  return total;
}

// ─── Density Computation ─────────────────────────────────────────────────────

/**
 * Build the 288-bin probability density array for one event type.
 *
 * Returns Float64Array for memory efficiency.
 */
function computeDensity(
  state: CycleModelState,
  currentTime: number,
  mealTimestamps: number[],
): { density: Float64Array; cumulative: Float64Array } {
  const density = new Float64Array(TOTAL_BINS);
  const cumulative = new Float64Array(TOTAL_BINS);

  const k = getEffectiveShape(state.shapeGrid);
  const lambda = state.ratePosterior.a / state.ratePosterior.b; // posterior mean rate

  // If no events yet, use the elapsed time since model initialization as t=0
  const lastEventTime = state.lastEventTimestamp ?? currentTime;
  const timeOrigin = lastEventTime;

  // Survival probability at start of prediction window
  // (accounts for time already elapsed since last event)
  const tAtCurrentTime = (currentTime - timeOrigin) / MS_PER_HOUR;
  let survivalProb = tAtCurrentTime > 0 ? gammaSurvival(tAtCurrentTime, k, lambda) : 1.0;
  if (!isFinite(survivalProb) || survivalProb < 0) survivalProb = 1.0;

  let cumulativeMass = 0;

  for (let i = 0; i < TOTAL_BINS; i++) {
    const binStartTime = currentTime + i * MS_PER_5MIN;
    const binCenterTime = binStartTime + MS_PER_5MIN / 2;

    // Hours elapsed since last event at this bin's center
    const t = (binCenterTime - timeOrigin) / MS_PER_HOUR;

    // Gamma hazard at this elapsed time
    let hazard = 0;
    if (t > 0 && isFinite(t)) {
      hazard = gammaHazard(t, k, lambda);
      if (!isFinite(hazard)) hazard = lambda; // fallback
    }

    // Circadian weight for this bin
    const cirBin = toCadenceBin(binCenterTime);
    const cirWeight = circadianWeight(state.circadian.alpha, cirBin);

    // Meal coupling (poop only)
    let mealEffect = 0;
    if (state.mealCoupling && mealTimestamps.length > 0) {
      const mc = state.mealCoupling;
      mealEffect = mealCouplingIntensity(
        mc.lagMean,
        mc.lagSigma,
        mc.amplitude,
        mealTimestamps,
        binCenterTime,
      );
    }

    // Total intensity: multiplicative circadian modulation on hazard + additive meal effect
    const intensity = hazard * cirWeight + mealEffect;

    // Bin probability mass: intensity × current survival × bin width
    const binMass = intensity * survivalProb * BIN_WIDTH_HOURS;
    density[i] = Math.max(binMass, 0);

    // Update survival for next bin: S(t+Δt) = S(t) × exp(-intensity × Δt)
    survivalProb *= Math.exp(-intensity * BIN_WIDTH_HOURS);
    if (!isFinite(survivalProb) || survivalProb < 0) survivalProb = 0;

    cumulativeMass += density[i];
    cumulative[i] = cumulativeMass;
  }

  // Normalize density to sum to 1 (handles residual survival mass)
  const totalMass = cumulative[TOTAL_BINS - 1];
  if (totalMass > 0 && totalMass !== 1) {
    for (let i = 0; i < TOTAL_BINS; i++) {
      density[i] /= totalMass;
      cumulative[i] /= totalMass;
    }
  }

  return { density, cumulative };
}

// ─── Window Extraction ────────────────────────────────────────────────────────

/**
 * Extract the highest-density region (HDR) containing `targetMass` probability.
 *
 * Strategy:
 *   1. Sort bins by density (descending)
 *   2. Greedily add bins until cumulative mass ≥ targetMass
 *   3. Find contiguous runs in the selected bins → windows
 *   4. Return the largest contiguous window (or top-3 if multimodal)
 *
 * @param density    - Normalized density array
 * @param cumulative - Cumulative density array
 * @param startTime  - Unix ms for bin 0
 * @param targetMass - e.g., 0.5 for 50% HDR, 0.8 for 80% HDR
 */
function extractHDR(
  density: Float64Array,
  startTime: number,
  targetMass: number,
): PredictionWindow[] {
  // Rank bins by density
  const ranked = Array.from({ length: TOTAL_BINS }, (_, i) => i).sort(
    (a, b) => density[b] - density[a],
  );

  // Select bins until target mass is reached
  const selected = new Uint8Array(TOTAL_BINS);
  let mass = 0;
  for (const idx of ranked) {
    if (mass >= targetMass) break;
    selected[idx] = 1;
    mass += density[idx];
  }

  // Find contiguous runs
  const windows: PredictionWindow[] = [];
  let i = 0;
  while (i < TOTAL_BINS) {
    if (selected[i]) {
      let j = i;
      while (j < TOTAL_BINS && selected[j]) j++;

      // Find peak in this run
      let peakIdx = i;
      for (let p = i; p < j; p++) {
        if (density[p] > density[peakIdx]) peakIdx = p;
      }

      // Compute window mass
      let windowMass = 0;
      for (let p = i; p < j; p++) windowMass += density[p];

      windows.push({
        startTime: startTime + i * MS_PER_5MIN,
        endTime: startTime + j * MS_PER_5MIN,
        confidence: windowMass,
        peakTime: startTime + (peakIdx + 0.5) * MS_PER_5MIN,
        peakProbability: density[peakIdx],
      });

      i = j;
    } else {
      i++;
    }
  }

  // Sort windows by peak probability (highest first)
  windows.sort((a, b) => b.peakProbability - a.peakProbability);

  // Return top 3 windows (most relevant for display)
  return windows.slice(0, 3);
}

/**
 * Find the narrowest window containing `targetMass` probability centered around the peak.
 *
 * Used for nextEventEstimate.window50 and window80.
 * Different from HDR: this is a single contiguous window around the primary peak.
 */
function extractCenteredWindow(
  density: Float64Array,
  startTime: number,
  targetMass: number,
): PredictionWindow {
  // Find global peak
  let peakIdx = 0;
  for (let i = 1; i < TOTAL_BINS; i++) {
    if (density[i] > density[peakIdx]) peakIdx = i;
  }

  // Expand symmetrically around peak until mass ≥ target
  let lo = peakIdx;
  let hi = peakIdx + 1;
  let mass = density[peakIdx];

  while (mass < targetMass && (lo > 0 || hi < TOTAL_BINS)) {
    const canExpandLeft = lo > 0;
    const canExpandRight = hi < TOTAL_BINS;

    if (canExpandLeft && canExpandRight) {
      if (density[lo - 1] >= density[hi]) {
        lo--;
        mass += density[lo];
      } else {
        mass += density[hi];
        hi++;
      }
    } else if (canExpandLeft) {
      lo--;
      mass += density[lo];
    } else if (canExpandRight) {
      mass += density[hi];
      hi++;
    } else {
      break;
    }
  }

  return {
    startTime: startTime + lo * MS_PER_5MIN,
    endTime: startTime + hi * MS_PER_5MIN,
    confidence: Math.min(mass, 1),
    peakTime: startTime + (peakIdx + 0.5) * MS_PER_5MIN,
    peakProbability: density[peakIdx],
  };
}

/**
 * Compute expected event time from the density (centroid).
 */
function expectedEventTime(density: Float64Array, startTime: number): number {
  let weightedSum = 0;
  let totalMass = 0;
  for (let i = 0; i < TOTAL_BINS; i++) {
    const binTime = startTime + (i + 0.5) * MS_PER_5MIN;
    weightedSum += density[i] * binTime;
    totalMass += density[i];
  }
  if (totalMass === 0) return startTime + 12 * MS_PER_HOUR; // fallback: 12h from now
  return weightedSum / totalMass;
}

// ─── Anomaly Score ────────────────────────────────────────────────────────────

/**
 * Compute anomaly score for the last observed event.
 *
 * Score = -log(density[lastEventBin]) where density is evaluated at the last event time.
 * High score = surprising event (anomalous timing).
 * Null model: Exp(1) → mean score = 1.0. Scores > 3 warrant attention.
 */
function computeAnomalyScoreFromState(
  state: CycleModelState,
  density: Float64Array,
  densityStartTime: number,
): number {
  if (state.lastEventTimestamp === null || state.eventCount < 2) return 0;

  // Find bin corresponding to last event
  const binIdx = Math.floor((state.lastEventTimestamp - densityStartTime) / MS_PER_5MIN);

  // Last event was before the prediction window — we can't evaluate it directly
  // Use model-based surprise instead: -log f_Gamma(lastInterval | k, λ)
  if (binIdx < 0 && state.eventCount >= 2 && state.totalIntervalHours > 0) {
    const k = getEffectiveShape(state.shapeGrid);
    const lambda = state.ratePosterior.a / state.ratePosterior.b;
    const meanInterval = state.totalIntervalHours / state.eventCount;

    // Log-likelihood of the mean interval under current model
    const lnPdf =
      (k - 1) * Math.log(meanInterval) -
      lambda * meanInterval +
      k * Math.log(lambda) -
      Math.log(Math.max(gaussianKernel(0, 0, 1), 1e-300)); // normalize roughly

    return Math.max(-lnPdf, 0);
  }

  if (binIdx >= 0 && binIdx < TOTAL_BINS) {
    const d = density[binIdx];
    if (d > 0) return -Math.log(d);
  }

  return 0;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a complete probabilistic prediction for one event type.
 *
 * @param modelState  - Bayesian model state for this event type
 * @param currentTime - Current Unix timestamp in ms
 * @param mealTimes   - Array of meal times as hours in 24h format (e.g. [7.5, 18.0])
 * @param _profile    - Pet profile (reserved for future per-species adjustments)
 */
export function generatePrediction(
  modelState: CycleModelState,
  currentTime: number,
  mealTimes: number[],
  _profile: PetProfile,
): CyclePrediction {
  // Convert mealTimes (hours of day) to Unix ms timestamps for today and yesterday
  const mealTimestamps: number[] = [];
  const today = new Date(currentTime);
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();

  for (const mealHour of mealTimes) {
    // Today's meal
    mealTimestamps.push(todayStart + mealHour * MS_PER_HOUR);
    // Yesterday's meal (for early-morning bins)
    mealTimestamps.push(todayStart - 24 * MS_PER_HOUR + mealHour * MS_PER_HOUR);
  }

  // ── Build density ──
  const { density, cumulative } = computeDensity(modelState, currentTime, mealTimestamps);

  const predDensity: PredictionDensity = {
    startTime: currentTime,
    density,
    cumulative,
  };

  // ── Extract prediction windows ──
  const hdrWindows50 = extractHDR(density, currentTime, 0.5);
  const hdrWindows80 = extractHDR(density, currentTime, 0.8);

  // Primary windows (all modes above 5% probability mass)
  const allWindows = extractHDR(density, currentTime, 0.8);

  // ── Next event estimate ──
  const expectedTime = expectedEventTime(density, currentTime);
  const window50 = extractCenteredWindow(density, currentTime, 0.5);
  const window80 = extractCenteredWindow(density, currentTime, 0.8);

  // ── Model confidence ──
  // Ramps from 0 (no data) to 1 (14+ days of data)
  const modelConfidence = Math.min(1, modelState.effectiveDays / 14);

  // ── Anomaly score ──
  const anomalyScore = computeAnomalyScoreFromState(modelState, density, currentTime);

  // Suppress unused variable warnings for HDR windows if not all are needed
  void hdrWindows50;
  void hdrWindows80;

  return {
    eventType: modelState.eventType,
    density: predDensity,
    windows: allWindows,
    nextEventEstimate: {
      expectedTime,
      window80,
      window50,
    },
    modelConfidence,
    anomalyScore,
  };
}

/**
 * Generate predictions for all four event types for a pet.
 *
 * Iterates over all cycle models and calls generatePrediction for each.
 * mealTimes from profile are used for poop coupling; passed to all for consistency.
 */
export function generateAllPredictions(
  petState: PetModelState,
  currentTime: number,
  profile: PetProfile,
): PetPrediction {
  const mealTimes = profile.mealTimes ?? [];

  const pee = generatePrediction(petState.pee, currentTime, mealTimes, profile);
  const poop = generatePrediction(petState.poop, currentTime, mealTimes, profile);
  const sleepStart = generatePrediction(petState.sleepStart, currentTime, mealTimes, profile);
  const sleepEnd = generatePrediction(petState.sleepEnd, currentTime, mealTimes, profile);

  return {
    petId: petState.petId,
    generatedAt: currentTime,
    pee,
    poop,
    sleepStart,
    sleepEnd,
  };
}

// ─── Helpers re-exported for testing ─────────────────────────────────────────

export { TOTAL_BINS, BINS_PER_HOUR, BIN_WIDTH_HOURS };
