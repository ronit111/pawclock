/**
 * Population-level prior parameters derived from veterinary research.
 *
 * Sources:
 * - AAHA urination guidelines (2023)
 * - Purina Institute companion animal nutrition data
 * - Houpt et al. (2005) "Circadian activity in dogs"
 * - Randall et al. (2013) "Sleep in cats" (J Feline Medicine & Surgery)
 * - Clinical Small Animal Internal Medicine (Tilley & Smith)
 *
 * All intervals are in hours. Circadian weights use 48 bins = 30 min each.
 * Bins are indexed 0–47, where bin i covers [(i*30), (i*30+29)] minutes past midnight.
 */

import type { PetProfile, EventType, PriorParams } from '../types/index.ts';

// ─── Circadian Templates (48 bins) ───────────────────────────────────────────

/**
 * Build a 48-bin circadian weight array from a list of (peakHour, amplitude, width) tuples.
 * Width is the Gaussian sigma in hours. Output is unnormalized — the model normalizes later.
 */
function buildCircadianTemplate(peaks: Array<{ hour: number; amplitude: number; sigmaHours: number }>): number[] {
  const bins = new Array(48).fill(1.0); // baseline = 1.0 everywhere

  for (let b = 0; b < 48; b++) {
    const binHour = b * 0.5 + 0.25; // center of each 30-min bin
    for (const peak of peaks) {
      // Wrap-around distance on a 24h clock
      let d = ((binHour - peak.hour + 24) % 24);
      if (d > 12) d = 24 - d;
      bins[b] += peak.amplitude * Math.exp(-0.5 * (d / peak.sigmaHours) ** 2);
    }
  }

  return bins;
}

// Dog urination: peaks entrained to typical owner schedule
// Major: morning walk ~7am, midday ~12pm, afternoon ~5pm, before-bed ~10pm
const DOG_PEE_CIRCADIAN = buildCircadianTemplate([
  { hour: 7.0,  amplitude: 3.0, sigmaHours: 0.75 },
  { hour: 12.0, amplitude: 1.8, sigmaHours: 0.75 },
  { hour: 17.0, amplitude: 2.2, sigmaHours: 0.75 },
  { hour: 22.0, amplitude: 1.5, sigmaHours: 0.75 },
]);

// Dog defecation: dominated by gastrocolic reflex post-meals
// Primary: morning ~7:30am (post-breakfast), evening ~18:00 (post-dinner)
const DOG_POOP_CIRCADIAN = buildCircadianTemplate([
  { hour: 7.5,  amplitude: 4.0, sigmaHours: 0.6 },
  { hour: 18.0, amplitude: 3.0, sigmaHours: 0.6 },
  { hour: 12.5, amplitude: 1.0, sigmaHours: 0.5 },
]);

// Cat urination: bimodal crepuscular (dawn/dusk) + indoor attenuation midday
// Peaks: ~5:30am dawn, ~18:30 dusk (ancestral prey-hunting cycle)
const CAT_PEE_CIRCADIAN = buildCircadianTemplate([
  { hour: 5.5,  amplitude: 2.5, sigmaHours: 1.0 },
  { hour: 18.5, amplitude: 2.5, sigmaHours: 1.0 },
  { hour: 22.0, amplitude: 1.0, sigmaHours: 0.75 },
]);

// Cat defecation: typically once post-meal; broad distribution vs dogs
const CAT_POOP_CIRCADIAN = buildCircadianTemplate([
  { hour: 8.0,  amplitude: 2.5, sigmaHours: 1.0 },
  { hour: 20.0, amplitude: 2.0, sigmaHours: 1.0 },
]);

// Dog sleep onset: primarily 9–10pm aligned with owner bedtime
// Secondary: post-lunch nap ~1pm
const DOG_SLEEP_START_CIRCADIAN = buildCircadianTemplate([
  { hour: 21.5, amplitude: 5.0, sigmaHours: 1.0 },
  { hour: 13.0, amplitude: 2.0, sigmaHours: 1.0 },
  { hour: 15.0, amplitude: 1.5, sigmaHours: 0.75 },
]);

// Dog sleep end: primarily 6–7am (owner wake-up)
const DOG_SLEEP_END_CIRCADIAN = buildCircadianTemplate([
  { hour: 6.5,  amplitude: 5.0, sigmaHours: 0.75 },
  { hour: 14.0, amplitude: 1.5, sigmaHours: 0.75 },
]);

// Cat sleep onset: polyphasic — multiple broad peaks throughout day and night
const CAT_SLEEP_START_CIRCADIAN = buildCircadianTemplate([
  { hour: 2.0,  amplitude: 1.5, sigmaHours: 1.5 },
  { hour: 10.0, amplitude: 2.5, sigmaHours: 1.5 },
  { hour: 15.0, amplitude: 2.0, sigmaHours: 1.5 },
  { hour: 22.0, amplitude: 1.5, sigmaHours: 1.5 },
]);

// Cat sleep end: broad, slightly biased toward dawn/early morning
const CAT_SLEEP_END_CIRCADIAN = buildCircadianTemplate([
  { hour: 5.5,  amplitude: 2.0, sigmaHours: 2.0 },
  { hour: 14.0, amplitude: 1.5, sigmaHours: 2.0 },
]);

// ─── Age Stage Classifier ────────────────────────────────────────────────────

function getAgeStage(profile: PetProfile): 'puppy' | 'adult' | 'senior' {
  const { ageMonths, species } = profile;
  if (species === 'dog') {
    if (ageMonths < 12) return 'puppy';
    if (ageMonths >= 84) return 'senior'; // 7+ years
    return 'adult';
  } else {
    if (ageMonths < 12) return 'puppy';
    if (ageMonths >= 132) return 'senior'; // 11+ years
    return 'adult';
  }
}

// ─── Urination Priors ────────────────────────────────────────────────────────

/**
 * Compute urination prior parameters.
 *
 * Base frequency (adult dog): 3–5 voids/day (during ~16 awake hours) → mean interval ≈ 4h
 * Base frequency (adult cat): 2–4 voids/day → mean interval ≈ 6h
 *
 * Size modifiers: bladder capacity scales with body mass^0.75 (allometric).
 * Puppy modifier: frequency ≈ (age_months + 1) per day (immature sphincter).
 */
function getUrinationPrior(profile: PetProfile): PriorParams {
  const { species, sizeClass, ageMonths, neutered } = profile;
  const ageStage = getAgeStage(profile);

  // Size-class frequency multiplier (bladder capacity modifier)
  const sizeMultiplier: Record<typeof sizeClass, number> = {
    teacup: 1.4,
    small:  1.2,
    medium: 1.0,
    large:  0.85,
    giant:  0.75,
  };

  const szMult = sizeMultiplier[sizeClass];

  let meanIntervalHours: number;
  let shapePrior: number;
  let intervalCV: number;
  let circadianPrior: number[];

  if (species === 'dog') {
    if (ageStage === 'puppy') {
      // Puppies: frequency ≈ (age_months + 1) per day capped at 12/day
      const freqPerDay = Math.min(ageMonths + 1, 12) * szMult;
      meanIntervalHours = 16 / freqPerDay; // awake hours only
      shapePrior = 1.5; // more variable in puppies
      intervalCV = 0.7;
    } else if (ageStage === 'senior') {
      // Senior dogs: increased frequency due to reduced bladder tone
      const freqPerDay = 5.5 * szMult;
      meanIntervalHours = 16 / freqPerDay;
      shapePrior = 2.0;
      intervalCV = 0.5;
    } else {
      // Adult dogs: 3–5x/day awake → mean ~4h
      const baseFreq = 4.0 * szMult;
      meanIntervalHours = 16 / baseFreq;
      shapePrior = 2.5;
      intervalCV = 0.45;
    }
    // Neutered males lose marking drive, slight frequency reduction
    if (neutered) meanIntervalHours *= 1.05;
    circadianPrior = DOG_PEE_CIRCADIAN;
  } else {
    // Cat
    if (ageStage === 'puppy') {
      const freqPerDay = Math.min(ageMonths + 1, 8) * szMult;
      meanIntervalHours = 16 / freqPerDay;
      shapePrior = 1.5;
      intervalCV = 0.7;
    } else if (ageStage === 'senior') {
      // Older cats: CKD risk → potentially increased frequency
      const freqPerDay = 4.5 * szMult;
      meanIntervalHours = 24 / freqPerDay;
      shapePrior = 2.0;
      intervalCV = 0.55;
    } else {
      // Adult cats: 2–4x/day → mean ~6h
      const baseFreq = 3.0 * szMult;
      meanIntervalHours = 24 / baseFreq;
      shapePrior = 2.0;
      intervalCV = 0.5;
    }
    circadianPrior = CAT_PEE_CIRCADIAN;
  }

  return {
    shapePrior,
    meanIntervalHours,
    intervalCV,
    circadianPrior,
    virtualSampleSize: 5,
  };
}

// ─── Defecation Priors ───────────────────────────────────────────────────────

/**
 * Compute defecation prior parameters.
 *
 * Adult dogs: 1–3x/day → mean interval ~10h, shaped by gastrocolic reflex.
 * Puppies: 5–6x/day due to immature gut, rapid metabolism.
 * Cats: 1–2x/day → mean ~16h; more variable than dogs.
 *
 * Meal coupling (gastrocolic reflex):
 *   Dogs: lag mean 30min (0.5h), sigma 15min (0.25h)
 *   Cats: lag mean 45min (0.75h), sigma 20min (0.33h)
 */
function getDefecationPrior(profile: PetProfile): PriorParams {
  const { species, sizeClass, ageMonths } = profile;
  const ageStage = getAgeStage(profile);

  const sizeMultiplier: Record<typeof sizeClass, number> = {
    teacup: 1.3,
    small:  1.1,
    medium: 1.0,
    large:  0.9,
    giant:  0.8,
  };

  const szMult = sizeMultiplier[sizeClass];

  let meanIntervalHours: number;
  let shapePrior: number;
  let intervalCV: number;
  let circadianPrior: number[];

  if (species === 'dog') {
    if (ageStage === 'puppy') {
      // Puppies 8-12 weeks: ~5x/day; improves to ~3x by 6 months
      const freqPerDay = Math.max(5 - ageMonths * 0.3, 2) * szMult;
      meanIntervalHours = 24 / freqPerDay;
      shapePrior = 1.5;
      intervalCV = 0.65;
    } else if (ageStage === 'senior') {
      // Senior: ~2x/day, more constipation risk
      meanIntervalHours = (24 / (2 * szMult));
      shapePrior = 2.0;
      intervalCV = 0.6;
    } else {
      // Adult: 1–3x/day → mean ~10h
      meanIntervalHours = 24 / (2.5 * szMult);
      shapePrior = 2.0;
      intervalCV = 0.5;
    }
    circadianPrior = DOG_POOP_CIRCADIAN;
  } else {
    if (ageStage === 'puppy') {
      const freqPerDay = Math.max(4 - ageMonths * 0.2, 1.5) * szMult;
      meanIntervalHours = 24 / freqPerDay;
      shapePrior = 1.5;
      intervalCV = 0.65;
    } else if (ageStage === 'senior') {
      meanIntervalHours = 24 / (1.2 * szMult);
      shapePrior = 1.5;
      intervalCV = 0.65;
    } else {
      // Adult cats: 1–2x/day → mean ~16h
      meanIntervalHours = 24 / (1.5 * szMult);
      shapePrior = 1.5;
      intervalCV = 0.6;
    }
    circadianPrior = CAT_POOP_CIRCADIAN;
  }

  return {
    shapePrior,
    meanIntervalHours,
    intervalCV,
    circadianPrior,
    virtualSampleSize: 5,
  };
}

// ─── Sleep Priors ─────────────────────────────────────────────────────────────

/**
 * Compute sleep onset prior parameters.
 *
 * Dogs: adults 10–14h/day total sleep, in bouts averaging ~45 min.
 * Cats: adults 12–16h/day total sleep, naps averaging ~78 min (polyphasic).
 *
 * Modifiers:
 *   Brachycephalic: +1.5h total (airway restriction → more rest)
 *   Giant breeds: +2–4h total
 *   Neutered: +0.5h total
 *
 * Sleep onset interval = mean inter-bout gap (awake duration between sleep bouts).
 */
function getSleepStartPrior(profile: PetProfile): PriorParams {
  const { species, sizeClass, brachycephalic, neutered, ageMonths: _ageMonths } = profile;
  const ageStage = getAgeStage(profile);

  // Total daily sleep in hours
  let totalSleepHours: number;
  let boutDurationHours: number;
  let circadianPrior: number[];
  let shapePrior: number;
  let intervalCV: number;

  if (species === 'dog') {
    totalSleepHours = ageStage === 'puppy' ? 18 : (ageStage === 'senior' ? 14 : 12);
    boutDurationHours = 0.75; // 45 min average bout

    // Size modifiers
    if (sizeClass === 'giant') totalSleepHours = Math.min(totalSleepHours + 3, 20);
    else if (sizeClass === 'large') totalSleepHours = Math.min(totalSleepHours + 1, 18);

    circadianPrior = DOG_SLEEP_START_CIRCADIAN;
    shapePrior = 2.0;
    intervalCV = 0.55;
  } else {
    totalSleepHours = ageStage === 'puppy' ? 20 : (ageStage === 'senior' ? 16 : 14);
    boutDurationHours = 1.3; // 78 min average nap

    circadianPrior = CAT_SLEEP_START_CIRCADIAN;
    shapePrior = 1.5; // Cats are more variable (polyphasic)
    intervalCV = 0.65;
  }

  // Modifiers
  if (brachycephalic) totalSleepHours = Math.min(totalSleepHours + 1.5, 22);
  if (neutered) totalSleepHours = Math.min(totalSleepHours + 0.5, 22);

  // Number of bouts per day
  const nBouts = totalSleepHours / boutDurationHours;
  // Mean inter-bout interval = awake time / nBouts
  const awakeHours = 24 - totalSleepHours;
  const meanIntervalHours = awakeHours / nBouts;

  return {
    shapePrior,
    meanIntervalHours: Math.max(meanIntervalHours, 0.5),
    intervalCV,
    circadianPrior,
    virtualSampleSize: 5,
  };
}

/**
 * Sleep end (wake-up) prior parameters.
 *
 * Mean bout duration matches species norms. Inter-event interval is
 * the mean sleep bout length (time between sleep_end and next sleep_start
 * is awakeInterval, but sleep_end interval = mean bout duration).
 */
function getSleepEndPrior(profile: PetProfile): PriorParams {
  const { species, sizeClass, brachycephalic, neutered, ageMonths: _ageMonths } = profile;
  const ageStage = getAgeStage(profile);

  let boutDurationHours: number;
  let circadianPrior: number[];
  let shapePrior: number;
  let intervalCV: number;
  let totalSleepHours: number;

  if (species === 'dog') {
    totalSleepHours = ageStage === 'puppy' ? 18 : (ageStage === 'senior' ? 14 : 12);
    boutDurationHours = 0.75;

    if (sizeClass === 'giant') totalSleepHours += 3;
    else if (sizeClass === 'large') totalSleepHours += 1;

    circadianPrior = DOG_SLEEP_END_CIRCADIAN;
    shapePrior = 2.0;
    intervalCV = 0.55;
  } else {
    totalSleepHours = ageStage === 'puppy' ? 20 : (ageStage === 'senior' ? 16 : 14);
    boutDurationHours = 1.3;

    circadianPrior = CAT_SLEEP_END_CIRCADIAN;
    shapePrior = 1.5;
    intervalCV = 0.65;
  }

  if (brachycephalic) totalSleepHours += 1.5;
  if (neutered) totalSleepHours += 0.5;

  // Suppress unused variable warning — totalSleepHours drives boutDurationHours scaling
  const scaleByTotalSleep = Math.min(totalSleepHours / 14, 1.3);
  const scaledBoutDuration = boutDurationHours * scaleByTotalSleep;

  // Mean inter-sleep_end interval: full sleep cycle length
  // (time from one wake-up to the next: sleep bout + awake period)
  const nBouts = totalSleepHours / boutDurationHours;
  const awakeHours = 24 - totalSleepHours;
  const meanCycleHours = (awakeHours / nBouts) + scaledBoutDuration;

  return {
    shapePrior,
    meanIntervalHours: Math.max(meanCycleHours, 0.5),
    intervalCV,
    circadianPrior,
    virtualSampleSize: 5,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get population-level prior parameters for a given pet and event type.
 *
 * Returns PriorParams encoding:
 *   - shapePrior: most likely k for the Gamma inter-event distribution
 *   - meanIntervalHours: expected inter-event interval
 *   - intervalCV: coefficient of variation (spread of the prior)
 *   - circadianPrior: 48-bin Dirichlet pseudo-counts for time-of-day preference
 *   - virtualSampleSize: prior strength (5 = equivalent to 5 observed events)
 */
export function getPopulationPriors(profile: PetProfile, eventType: EventType): PriorParams {
  switch (eventType) {
    case 'pee':
      return getUrinationPrior(profile);
    case 'poop':
      return getDefecationPrior(profile);
    case 'sleep_start':
      return getSleepStartPrior(profile);
    case 'sleep_end':
      return getSleepEndPrior(profile);
  }
}

/**
 * Get meal-defecation coupling parameters for a species.
 *
 * Returns { lagMean, lagSigma, amplitude } all in hours.
 * Amplitude is relative to the background Gamma hazard.
 */
export function getMealCouplingParams(species: 'dog' | 'cat'): { lagMean: number; lagSigma: number; amplitude: number } {
  if (species === 'dog') {
    return { lagMean: 0.5, lagSigma: 0.25, amplitude: 1.2 };
  } else {
    return { lagMean: 0.75, lagSigma: 0.333, amplitude: 0.9 };
  }
}
