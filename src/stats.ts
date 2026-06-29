/**
 * Pure FX statistics — shared by the tool handlers AND the unit tests, so the
 * tests exercise the real shipped code path rather than a re-implementation
 * (which can drift from the handlers and give false confidence). See review
 * 2026-06-29.
 */

/** Daily log-returns of a rate series. */
export function logReturns(rates: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < rates.length; i++) {
    out.push(Math.log(rates[i] / rates[i - 1]));
  }
  return out;
}

/**
 * Daily and annualised (x sqrt(252)) volatility of a rate series' log-returns,
 * plus the mean log-return. Uses the sample variance (n-1) — the standard
 * estimator for realised FX volatility.
 */
export function annualisedVolatility(rates: number[]): {
  dailyVol: number;
  annualisedVol: number;
  mean: number;
} {
  if (rates.length < 2) throw new Error("Need at least 2 data points");
  const lr = logReturns(rates);
  const mean = lr.reduce((a, b) => a + b, 0) / lr.length;
  const variance = lr.reduce((a, r) => a + (r - mean) ** 2, 0) / (lr.length - 1);
  const dailyVol = Math.sqrt(variance);
  return { dailyVol, annualisedVol: dailyVol * Math.sqrt(252), mean };
}

/** Simple moving average of the last `period` points, or null if too few. */
export function sma(rates: number[], period: number): number | null {
  if (rates.length < period) return null;
  const slice = rates.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

/** Percent of `series` strictly below `value` (0-100, rounded). */
export function percentileBelow(series: number[], value: number): number {
  if (series.length === 0) return 0;
  const below = series.filter((r) => r < value).length;
  return Math.round((below / series.length) * 100);
}

/** Pearson correlation of two series over their shared prefix (needs >= 3 points). */
export function pearsonCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) throw new Error("Need at least 3 aligned data points");
  const meanA = a.slice(0, n).reduce((s, x) => s + x, 0) / n;
  const meanB = b.slice(0, n).reduce((s, x) => s + x, 0) / n;
  let num = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    varA += da * da;
    varB += db * db;
  }
  const denom = Math.sqrt(varA * varB);
  return denom === 0 ? 0 : num / denom;
}
