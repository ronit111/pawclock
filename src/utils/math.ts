/**
 * Pure math utilities for PawClock prediction engine.
 *
 * All functions are implemented from scratch — no external math libraries.
 * Designed for numerical stability in the ranges relevant to biological cycles:
 * inter-event intervals of 0.25–48 hours, shape parameters k of 1–6.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const LN_SQRT_2PI = 0.9189385332046727; // ln(sqrt(2π))
const SQRT_2PI = 2.5066282746310002;

// Lanczos coefficients (g=7, n=9) — Spouge's adaptation used by many implementations
const LANCZOS_G = 7;
const LANCZOS_COEFFS: number[] = [
  0.99999999999980993,
  676.5203681218851,
  -1259.1392167224028,
  771.32342877765313,
  -176.61502916214059,
  12.507343278686905,
  -0.13857109526572012,
  9.9843695780195716e-6,
  1.5056327351493116e-7,
];

// ─── Gamma Function ───────────────────────────────────────────────────────────

/**
 * Natural log of the Gamma function via Lanczos approximation.
 *
 * Numerically stable for x > 0. Accurate to ~15 significant digits.
 * Uses the reflection formula for x < 0.5.
 *
 * Reference: Lanczos (1964), Numerical Recipes §6.1
 */
export function lnGamma(x: number): number {
  if (x <= 0) {
    if (x === 0 || !isFinite(x)) return Infinity;
    // Reflection formula: Γ(x)Γ(1-x) = π/sin(πx)
    return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lnGamma(1 - x);
  }

  if (x < 0.5) {
    // Reflection: ln Γ(x) = ln(π/sin(πx)) - ln Γ(1-x)
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  }

  const z = x - 1;
  let sum = LANCZOS_COEFFS[0];
  for (let i = 1; i < LANCZOS_G + 2; i++) {
    sum += LANCZOS_COEFFS[i] / (z + i);
  }

  const t = z + LANCZOS_G + 0.5;
  return LN_SQRT_2PI + (z + 0.5) * Math.log(t) - t + Math.log(sum);
}

/**
 * Gamma function Γ(x) via exp(lnGamma(x)).
 *
 * For x > 0.5 Stirling gives adequate precision; here we use the more
 * accurate Lanczos form to avoid precision loss at small x.
 */
export function gammaFunction(x: number): number {
  if (x <= 0 && Number.isInteger(x)) return Infinity; // poles at non-positive integers
  return Math.exp(lnGamma(x));
}

// ─── Regularized Incomplete Gamma ─────────────────────────────────────────────

/**
 * Regularized lower incomplete gamma: P(a, x) = γ(a,x) / Γ(a).
 *
 * Uses:
 *   - Series expansion  when x < a + 1  (converges quickly for small x)
 *   - Continued fraction when x ≥ a + 1  (Lentz's algorithm)
 *
 * Reference: Numerical Recipes §6.2
 */
function regularizedGammaP(a: number, x: number): number {
  if (x < 0 || a <= 0) return 0;
  if (x === 0) return 0;
  if (x === Infinity) return 1;

  if (x < a + 1) {
    return gammaSeries(a, x);
  } else {
    return 1 - gammaContinuedFraction(a, x);
  }
}

/** Series expansion of regularized lower incomplete gamma P(a,x). */
function gammaSeries(a: number, x: number): number {
  const lnGammaA = lnGamma(a);
  let term = 1 / a;
  let sum = term;
  const MAX_ITER = 200;
  const EPS = 3e-15;

  for (let n = 1; n <= MAX_ITER; n++) {
    term *= x / (a + n);
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * EPS) break;
  }

  return Math.exp(-x + a * Math.log(x) - lnGammaA) * sum;
}

/** Continued fraction expansion of regularized upper incomplete gamma Q(a,x) = 1 - P(a,x). */
function gammaContinuedFraction(a: number, x: number): number {
  const lnGammaA = lnGamma(a);
  const FPMIN = 1e-300;
  const MAX_ITER = 200;
  const EPS = 3e-15;

  // Lentz's method
  let b = x + 1 - a;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;

  for (let i = 1; i <= MAX_ITER; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }

  return Math.exp(-x + a * Math.log(x) - lnGammaA) * h;
}

// ─── Gamma Distribution ───────────────────────────────────────────────────────

/**
 * Gamma probability density function.
 *
 * Parameterized as: f(x; k, λ) = (λ^k · x^(k-1) · e^(-λx)) / Γ(k)
 * where k is the shape and λ is the rate (1/scale).
 *
 * Mean = k/λ, Variance = k/λ².
 */
export function gammaPdf(x: number, k: number, lambda: number): number {
  if (x <= 0 || k <= 0 || lambda <= 0) return 0;

  // Compute in log-space to avoid overflow/underflow
  const lnPdf =
    k * Math.log(lambda) +
    (k - 1) * Math.log(x) -
    lambda * x -
    lnGamma(k);

  return Math.exp(lnPdf);
}

/**
 * Gamma cumulative distribution function P(X ≤ x).
 * Uses the regularized incomplete gamma function P(k, λx).
 */
export function gammaCdf(x: number, k: number, lambda: number): number {
  if (x <= 0) return 0;
  if (!isFinite(x)) return 1;
  return regularizedGammaP(k, lambda * x);
}

/**
 * Gamma survival function P(X > x) = 1 - CDF(x).
 *
 * Computed directly (not as 1 - CDF) to preserve precision near 1.
 */
export function gammaSurvival(x: number, k: number, lambda: number): number {
  if (x <= 0) return 1;
  if (!isFinite(x)) return 0;
  // For x < a+1 use complement; for x >= a+1 use CF directly
  if (lambda * x < k + 1) {
    return 1 - regularizedGammaP(k, lambda * x);
  } else {
    return gammaContinuedFraction(k, lambda * x);
  }
}

/**
 * Gamma hazard function h(x) = f(x) / S(x).
 *
 * The hazard is the instantaneous rate of the event occurring, given
 * it hasn't occurred yet. For k > 1 (our typical case), the hazard is
 * monotonically increasing — capturing "pressure buildup".
 *
 * Hot path: called 288 × nCycles times per prediction. Numerically robust.
 */
export function gammaHazard(x: number, k: number, lambda: number): number {
  if (x <= 0) return k === 1 ? lambda : 0; // Exponential case: constant hazard
  if (!isFinite(x)) return Infinity;

  const pdf = gammaPdf(x, k, lambda);
  const survival = gammaSurvival(x, k, lambda);

  if (survival < 1e-300) return lambda * k; // At extreme tails, hazard ≈ λ (asymptote)
  return pdf / survival;
}

// ─── Gaussian / Normal ────────────────────────────────────────────────────────

/**
 * Gaussian (Normal) probability density function.
 *
 * Used for meal-defecation coupling kernel.
 */
export function gaussianKernel(x: number, mu: number, sigma: number): number {
  if (sigma <= 0) return 0;
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * SQRT_2PI);
}

// ─── Bessel Function ──────────────────────────────────────────────────────────

/**
 * Modified Bessel function of the first kind, order 0: I₀(x).
 *
 * Polynomial approximation (Abramowitz & Stegun §9.8):
 *   |x| ≤ 3.75: polynomial in (x/3.75)²
 *   |x| > 3.75: polynomial in (3.75/x) scaled by e^x/√x
 *
 * Max error: ±1.6×10⁻⁷ (sufficient for Von Mises normalization).
 */
export function besselI0(x: number): number {
  const ax = Math.abs(x);

  if (ax <= 3.75) {
    const t = (x / 3.75) * (x / 3.75);
    return (
      1.0 +
      t * (3.5156229 +
        t * (3.0899424 +
          t * (1.2067492 +
            t * (0.2659732 +
              t * (0.0360768 +
                t * 0.0045813)))))
    );
  } else {
    const t = 3.75 / ax;
    return (
      (Math.exp(ax) / Math.sqrt(ax)) *
      (0.39894228 +
        t * (0.01328592 +
          t * (0.00225319 +
            t * (-0.00157565 +
              t * (0.00916281 +
                t * (-0.02057706 +
                  t * (0.02635537 +
                    t * (-0.01647633 +
                      t * 0.00392377))))))))
    );
  }
}

// ─── Von Mises Distribution ───────────────────────────────────────────────────

/**
 * Von Mises (circular normal) probability density function.
 *
 * f(θ; μ, κ) = exp(κ cos(θ - μ)) / (2π I₀(κ))
 *
 * Used for angular (circadian) distributions. Currently available for
 * future circadian model extensions.
 *
 * @param theta - Angle in radians [0, 2π)
 * @param mu    - Mean direction in radians
 * @param kappa - Concentration parameter (κ=0: uniform, κ→∞: point mass)
 */
export function vonMisesPdf(theta: number, mu: number, kappa: number): number {
  if (kappa < 0) return 0;
  if (kappa === 0) return 1 / (2 * Math.PI); // Uniform
  return Math.exp(kappa * Math.cos(theta - mu)) / (2 * Math.PI * besselI0(kappa));
}

// ─── Dirichlet ────────────────────────────────────────────────────────────────

/**
 * Expected value of component i under a Dirichlet distribution.
 *
 * E[pᵢ] = αᵢ / Σαⱼ
 *
 * Used to convert Dirichlet pseudo-counts to circadian probability weights.
 */
export function dirichletExpectation(alpha: number[], i: number): number {
  const sum = alpha.reduce((acc, v) => acc + v, 0);
  if (sum === 0) return 1 / alpha.length;
  return alpha[i] / sum;
}

// ─── Array Utilities ──────────────────────────────────────────────────────────

/**
 * Normalize a numeric array to sum to 1.
 *
 * Returns a Float64Array for memory efficiency.
 * Handles all-zero input gracefully (returns uniform distribution).
 */
export function normalizeArray(arr: number[] | Float64Array): Float64Array {
  const n = arr.length;
  const out = new Float64Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += arr[i];

  if (sum === 0 || !isFinite(sum)) {
    const uniform = 1 / n;
    for (let i = 0; i < n; i++) out[i] = uniform;
    return out;
  }

  for (let i = 0; i < n; i++) out[i] = arr[i] / sum;
  return out;
}

/**
 * Numerically stable log-sum-exp: log(Σ exp(xᵢ)).
 *
 * Uses the identity: log Σ exp(xᵢ) = max + log Σ exp(xᵢ - max)
 * to prevent overflow/underflow.
 */
export function logSumExp(logValues: number[]): number {
  if (logValues.length === 0) return -Infinity;

  let max = -Infinity;
  for (const v of logValues) {
    if (v > max) max = v;
  }

  if (!isFinite(max)) return -Infinity;

  let sum = 0;
  for (const v of logValues) {
    sum += Math.exp(v - max);
  }

  return max + Math.log(sum);
}
