// ─── Species & Profile ───────────────────────────────────────

export type Species = 'dog' | 'cat';

export type SizeClass = 'teacup' | 'small' | 'medium' | 'large' | 'giant';

export type AgeStage = 'newborn' | 'puppy' | 'adolescent' | 'adult' | 'senior' | 'geriatric';

export type DietType = 'dry' | 'wet' | 'raw' | 'mixed';

export interface PetProfile {
  id: string;
  name: string;
  species: Species;
  breed: string;
  sizeClass: SizeClass;
  ageMonths: number;
  weightKg: number;
  neutered: boolean;
  indoor: boolean;
  brachycephalic: boolean;
  dietType: DietType;
  mealTimes: number[]; // hours in 24h format (e.g., [7.5, 18.0])
  createdAt: number;
}

// ─── Events ──────────────────────────────────────────────────

export type EventType = 'pee' | 'poop' | 'sleep_start' | 'sleep_end';

export type PeeVolume = 'small' | 'normal' | 'large';
export type PeeColor = 'clear' | 'normal' | 'dark';
export type PoopSize = 'small' | 'normal' | 'large';

export interface BaseEvent {
  id: string;
  petId: string;
  type: EventType;
  timestamp: number; // Unix ms
  createdAt: number;
}

export interface PeeEvent extends BaseEvent {
  type: 'pee';
  volume?: PeeVolume;
  color?: PeeColor;
  unusualLocation?: boolean;
}

export interface PoopEvent extends BaseEvent {
  type: 'poop';
  consistencyScore?: number; // 1-7 Purina scale
  size?: PoopSize;
  notes?: string;
}

export interface SleepStartEvent extends BaseEvent {
  type: 'sleep_start';
}

export interface SleepEndEvent extends BaseEvent {
  type: 'sleep_end';
}

export type PetEvent = PeeEvent | PoopEvent | SleepStartEvent | SleepEndEvent;

// ─── Model State ─────────────────────────────────────────────

/** Gamma distribution posterior for inter-event intervals */
export interface GammaRatePosterior {
  /** Gamma prior/posterior shape for rate: Gamma(a, b) */
  a: number;
  b: number;
}

/** Grid approximation for Gamma shape parameter */
export interface ShapeGrid {
  /** Grid points for k values */
  gridPoints: number[]; // e.g., [1.0, 1.25, 1.5, ..., 5.0]
  /** Log-weights (unnormalized) for each grid point */
  logWeights: number[];
}

/** Dirichlet-Multinomial circadian model: 48 half-hour bins */
export interface CircadianModel {
  /** Dirichlet pseudo-counts per bin (48 bins) */
  alpha: number[];
}

/** Meal-defecation coupling parameters */
export interface MealCouplingModel {
  /** Mean gastrocolic delay in hours */
  lagMean: number;
  /** Std dev of delay in hours */
  lagSigma: number;
  /** Amplitude of meal response */
  amplitude: number;
}

/** Observation model for missed event detection */
export interface ObservationModel {
  /** Estimated observation probability per time block */
  pObsDaytime: number;
  pObsNighttime: number;
}

/** Complete model state for one event type of one pet */
export interface CycleModelState {
  eventType: EventType;
  ratePosterior: GammaRatePosterior;
  shapeGrid: ShapeGrid;
  circadian: CircadianModel;
  mealCoupling?: MealCouplingModel; // only for poop
  observation: ObservationModel;
  /** Sufficient statistics */
  eventCount: number;
  totalIntervalHours: number;
  totalLogIntervalHours: number;
  lastEventTimestamp: number | null;
  /** Days of data */
  effectiveDays: number;
}

/** Complete model state for one pet */
export interface PetModelState {
  petId: string;
  pee: CycleModelState;
  poop: CycleModelState;
  sleepStart: CycleModelState;
  sleepEnd: CycleModelState;
  updatedAt: number;
}

// ─── Predictions ─────────────────────────────────────────────

/** 24-hour probability density: 288 bins × 5 minutes */
export interface PredictionDensity {
  /** Start time (Unix ms) for bin 0 */
  startTime: number;
  /** Probability values per 5-min bin (288 bins) */
  density: Float64Array;
  /** Cumulative probability (for survival function) */
  cumulative: Float64Array;
}

/** A predicted time window with confidence */
export interface PredictionWindow {
  startTime: number;
  endTime: number;
  confidence: number; // 0-1
  peakTime: number;
  peakProbability: number;
}

/** Complete prediction output for one event type */
export interface CyclePrediction {
  eventType: EventType;
  density: PredictionDensity;
  windows: PredictionWindow[]; // multiple if multimodal
  nextEventEstimate: {
    expectedTime: number;
    window80: PredictionWindow;
    window50: PredictionWindow;
  };
  modelConfidence: number; // 0-1, based on data quantity
  anomalyScore: number;
}

/** Complete prediction output for one pet */
export interface PetPrediction {
  petId: string;
  generatedAt: number;
  pee: CyclePrediction;
  poop: CyclePrediction;
  sleepStart: CyclePrediction;
  sleepEnd: CyclePrediction;
}

// ─── Anomaly Detection ──────────────────────────────────────

export type AlertSeverity = 'info' | 'yellow' | 'red';

export interface HealthAlert {
  id: string;
  petId: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  detectedAt: number;
  eventType: EventType;
  metric: string; // e.g., 'frequency_increase', 'long_gap'
  value: number;
  threshold: number;
  dismissed: boolean;
}

// ─── Population Priors ──────────────────────────────────────

export interface PriorParams {
  /** Gamma shape k prior (most likely value) */
  shapePrior: number;
  /** Mean inter-event interval in hours */
  meanIntervalHours: number;
  /** CV of inter-event interval (for setting prior spread) */
  intervalCV: number;
  /** Circadian weights (48 bins, unnormalized) */
  circadianPrior: number[];
  /** Virtual sample size (strength of prior) */
  virtualSampleSize: number;
}
