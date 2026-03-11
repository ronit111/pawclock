/**
 * Bayesian model state manager.
 *
 * Implements Bayesian updating for three model components:
 *
 * 1. Gamma rate posterior (conjugate):
 *    Prior:    rate λ ~ Gamma(a₀, b₀)
 *    Likelihood: T | λ ~ Gamma(k, λ)  (observed interval T)
 *    Posterior: λ | T ~ Gamma(a₀ + k, b₀ + T)
 *
 * 2. Shape grid (non-conjugate, grid approximation):
 *    log w[i] += log f_Gamma(T | k_i, λ_posterior)
 *    Grid over k ∈ [1.0, 5.0] with 17 points (step 0.25)
 *
 * 3. Circadian Dirichlet-Multinomial:
 *    alpha[bin] += 1 for each observed event in that bin
 */

import type {
  PetProfile,
  PetModelState,
  CycleModelState,
  EventType,
  PetEvent,
  ShapeGrid,
} from '../types/index.ts';
import { getPopulationPriors, getMealCouplingParams } from '../data/population-priors.ts';
import { lnGamma, gammaPdf, gammaSurvival } from '../utils/math.ts';
import { logSumExp } from '../utils/math.ts';

// ─── Constants ────────────────────────────────────────────────────────────────

/** k-grid: 17 points from 1.0 to 5.0 (step 0.25). */
const SHAPE_GRID_POINTS: number[] = Array.from({ length: 17 }, (_, i) => 1.0 + i * 0.25);

const CIRCADIAN_BINS = 48;

// ─── Initialization ───────────────────────────────────────────────────────────

/**
 * Initialize a CycleModelState from population priors.
 *
 * Gamma rate prior: parameterize from (meanInterval, CV).
 *   For Gamma(k, λ): mean = k/λ, variance = k/λ²  → CV = 1/√k
 *   Given shapePrior k₀ and meanInterval μ₀: λ₀ = k₀/μ₀
 *   Rate conjugate prior: λ ~ Gamma(a, b) where E[λ] = a/b = λ₀
 *   Set prior strength via virtualSampleSize n:
 *     a = n * k₀,  b = n * μ₀ * k₀  (so E[λ] = k₀/μ₀ = 1/μ₀ after dividing)
 *     Simplification: a = n * k₀, b = n * k₀ * μ₀ → mean rate = 1/μ₀ ✓
 *
 * Shape grid: initialized with log-weights proportional to the Gamma
 * log-pdf evaluated at the prior mean interval, so the prior already
 * encodes our belief about k.
 */
function initializeCycleModel(profile: PetProfile, eventType: EventType): CycleModelState {
  const prior = getPopulationPriors(profile, eventType);
  const {
    shapePrior,
    meanIntervalHours,
    virtualSampleSize,
    circadianPrior,
  } = prior;

  // Rate prior: λ ~ Gamma(a, b)
  // E[λ] = a/b = shapePrior / meanIntervalHours
  const a = virtualSampleSize * shapePrior;
  const b = virtualSampleSize * meanIntervalHours; // b in units of hours

  // Shape grid: prior log-weights from Gamma log-pdf at prior mean
  // This encodes our initial belief about which k values are plausible
  const logWeights = SHAPE_GRID_POINTS.map((k) => {
    // Log-pdf of Gamma(k, shapePrior/meanIntervalHours) evaluated at meanIntervalHours
    const lambda = shapePrior / meanIntervalHours;
    const lnPdf =
      k * Math.log(lambda) +
      (k - 1) * Math.log(meanIntervalHours) -
      lambda * meanIntervalHours -
      lnGamma(k);
    return isFinite(lnPdf) ? lnPdf : -50;
  });

  // Normalize log-weights so they don't drift to extreme values
  const lse = logSumExp(logWeights);
  const normalizedLogWeights = logWeights.map((lw) => lw - lse);

  // Circadian: scale prior to virtual sample strength
  const scaledCircadian = circadianPrior.map((w) => w * virtualSampleSize);

  // Meal coupling (only poop)
  const mealCoupling =
    eventType === 'poop'
      ? (() => {
          const mp = getMealCouplingParams(profile.species);
          return { lagMean: mp.lagMean, lagSigma: mp.lagSigma, amplitude: mp.amplitude };
        })()
      : undefined;

  return {
    eventType,
    ratePosterior: { a, b },
    shapeGrid: {
      gridPoints: SHAPE_GRID_POINTS,
      logWeights: normalizedLogWeights,
    },
    circadian: { alpha: scaledCircadian },
    mealCoupling,
    observation: { pObsDaytime: 0.95, pObsNighttime: 0.6 },
    eventCount: 0,
    totalIntervalHours: 0,
    totalLogIntervalHours: 0,
    lastEventTimestamp: null,
    effectiveDays: 0,
  };
}

/**
 * Initialize a complete PetModelState for all four event types.
 */
export function initializeModelState(profile: PetProfile): PetModelState {
  return {
    petId: profile.id,
    pee: initializeCycleModel(profile, 'pee'),
    poop: initializeCycleModel(profile, 'poop'),
    sleepStart: initializeCycleModel(profile, 'sleep_start'),
    sleepEnd: initializeCycleModel(profile, 'sleep_end'),
    updatedAt: Date.now(),
  };
}

// ─── Bayesian Update ──────────────────────────────────────────────────────────

/**
 * Convert Unix timestamp (ms) to circadian bin index [0, 47].
 * Bin i covers minute [i*30, i*30+29] of the day.
 */
function timestampToBin(timestamp: number): number {
  const date = new Date(timestamp);
  const minuteOfDay = date.getHours() * 60 + date.getMinutes();
  return Math.floor(minuteOfDay / 30) % CIRCADIAN_BINS;
}

/**
 * Perform a Bayesian update on the CycleModelState given a new observed event.
 *
 * @param state               - Current model state
 * @param event               - The observed event
 * @param prevEventTimestamp  - Timestamp of the previous event of the same type (ms), or null
 * @returns                   - Updated CycleModelState (pure — does not mutate input)
 */
export function updateModel(
  state: CycleModelState,
  event: PetEvent,
  prevEventTimestamp: number | null,
): CycleModelState {
  // Deep-copy mutable fields to preserve purity
  const newState: CycleModelState = {
    ...state,
    ratePosterior: { ...state.ratePosterior },
    shapeGrid: {
      gridPoints: [...state.shapeGrid.gridPoints],
      logWeights: [...state.shapeGrid.logWeights],
    },
    circadian: { alpha: [...state.circadian.alpha] },
    mealCoupling: state.mealCoupling ? { ...state.mealCoupling } : undefined,
    observation: { ...state.observation },
  };

  // ── 1. Update circadian pseudo-counts ──
  const bin = timestampToBin(event.timestamp);
  newState.circadian.alpha[bin] += 1;

  // ── 2. Update from inter-event interval (if we have a predecessor) ──
  if (prevEventTimestamp !== null) {
    const intervalHours = (event.timestamp - prevEventTimestamp) / 3_600_000;

    // Skip unreasonable intervals (likely missed session or data error)
    if (intervalHours > 0 && intervalHours < 168) {
      // 3a. Update Gamma rate posterior (conjugate):
      //     λ | T ~ Gamma(a + k_effective, b + T)
      //     We use k_effective from the current grid for the conjugate update.
      const kEff = getEffectiveShape(state.shapeGrid);
      newState.ratePosterior.a = state.ratePosterior.a + kEff;
      newState.ratePosterior.b = state.ratePosterior.b + intervalHours;

      // 3b. Update shape grid log-weights:
      //     log w'[i] = log w[i] + log f_Gamma(T | k_i, λ̂_posterior)
      //     where λ̂ = a_new / b_new (posterior mean rate)
      const lambdaHat = newState.ratePosterior.a / newState.ratePosterior.b;
      const newLogWeights = state.shapeGrid.logWeights.map((lw, i) => {
        const ki = state.shapeGrid.gridPoints[i];
        const logLik =
          ki * Math.log(lambdaHat) +
          (ki - 1) * Math.log(intervalHours) -
          lambdaHat * intervalHours -
          lnGamma(ki);
        return lw + (isFinite(logLik) ? logLik : -50);
      });

      // Normalize log-weights to prevent numerical drift
      const lse = logSumExp(newLogWeights);
      newState.shapeGrid.logWeights = newLogWeights.map((lw) => lw - lse);

      // 3c. Update sufficient statistics
      newState.totalIntervalHours += intervalHours;
      newState.totalLogIntervalHours += Math.log(intervalHours);
    }
  }

  // ── 3. Update event count and timestamps ──
  newState.eventCount = state.eventCount + 1;
  newState.lastEventTimestamp = event.timestamp;

  // ── 4. Update effective days ──
  newState.effectiveDays = newState.totalIntervalHours / 24;

  return newState;
}

// ─── Model Queries ────────────────────────────────────────────────────────────

/**
 * Compute the expected value of the shape parameter k from the grid posterior.
 *
 * E[k] = Σᵢ kᵢ · wᵢ  where wᵢ = softmax(logWeights)
 */
export function getEffectiveShape(grid: ShapeGrid): number {
  const lse = logSumExp(grid.logWeights);
  let expected = 0;
  for (let i = 0; i < grid.gridPoints.length; i++) {
    const w = Math.exp(grid.logWeights[i] - lse);
    expected += grid.gridPoints[i] * w;
  }
  return expected;
}

/**
 * Detect whether a gap in observed events likely contains a missed event.
 *
 * A gap is "suspicious" if:
 *   1. Its duration exceeds the 95th percentile of the Gamma distribution, AND
 *   2. The gap falls during a high-activity period per the circadian model
 *
 * @param state     - Current cycle model state
 * @param gapHours  - Duration of the unobserved gap in hours
 * @returns true if a missed event is likely
 */
export function detectMissedEvent(state: CycleModelState, gapHours: number): boolean {
  if (state.eventCount < 3) return false; // Not enough data to judge

  const k = getEffectiveShape(state.shapeGrid);
  const lambda = state.ratePosterior.a / state.ratePosterior.b;

  // Compute 95th percentile via survival function inversion (bisection)
  const p95 = gammaPercentile(0.95, k, lambda);

  if (gapHours <= p95) return false;

  // Check circadian: is there a high-probability window within the gap?
  // Simplification: if circadian has any bin with weight > 1.5x mean, flag
  const alphaSum = state.circadian.alpha.reduce((s, v) => s + v, 0);
  const meanAlpha = alphaSum / CIRCADIAN_BINS;

  // Find bins within the gap window (assume gap ends now)
  const now = Date.now();
  const gapStart = now - gapHours * 3_600_000;
  const gapStartBin = timestampToBin(gapStart);
  const gapBins = Math.ceil((gapHours * 60) / 30); // number of 30-min bins in gap

  for (let b = 0; b < gapBins; b++) {
    const binIdx = (gapStartBin + b) % CIRCADIAN_BINS;
    if (state.circadian.alpha[binIdx] > 1.5 * meanAlpha) {
      return true;
    }
  }

  return false;
}

/**
 * Approximate the p-th percentile of Gamma(k, lambda) via bisection.
 *
 * Uses the survival function for numerically stable search.
 * Converges to ~6 significant digits in <50 iterations.
 */
function gammaPercentile(p: number, k: number, lambda: number): number {
  // Initial bracket: [0, mean * 10]
  const mean = k / lambda;
  let lo = 0;
  let hi = mean * 10;

  // Widen upper bound if needed
  while (gammaSurvival(hi, k, lambda) > 1 - p) {
    hi *= 2;
  }

  for (let iter = 0; iter < 60; iter++) {
    const mid = (lo + hi) / 2;
    if (gammaSurvival(mid, k, lambda) > 1 - p) {
      lo = mid;
    } else {
      hi = mid;
    }
    if (hi - lo < 1e-6) break;
  }

  return (lo + hi) / 2;
}

/**
 * Log-gamma PDF: log f_Gamma(x | k, lambda).
 * Used internally and exported for predictor.
 */
export function logGammaPdf(x: number, k: number, lambda: number): number {
  if (x <= 0 || k <= 0 || lambda <= 0) return -Infinity;
  return k * Math.log(lambda) + (k - 1) * Math.log(x) - lambda * x - lnGamma(k);
}

// Re-export gammaPdf for cross-module use
export { gammaPdf };
