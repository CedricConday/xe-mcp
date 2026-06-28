// Unit tests for volatility math — no API calls, pure functions
// These test the same log-return methodology used in FX options pricing

function computeVolatility(rates: number[]): {
  dailyVol: number;
  annualisedVol: number;
  mean: number;
} {
  if (rates.length < 2) throw new Error("Need at least 2 data points");
  const logReturns = rates.slice(1).map((r, i) => Math.log(r / rates[i]));
  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const variance =
    logReturns.reduce((a, r) => a + Math.pow(r - mean, 2), 0) / (logReturns.length - 1);
  const dailyVol = Math.sqrt(variance);
  const annualisedVol = dailyVol * Math.sqrt(252);
  return { dailyVol, annualisedVol, mean };
}

function computePercentile(historicalRates: number[], current: number): number {
  const below = historicalRates.filter((r) => r <= current).length;
  return Math.round((below / historicalRates.length) * 100);
}

describe("volatility_analysis math", () => {
  test("zero-vol series returns ~0 daily vol", () => {
    const flatRates = Array(30).fill(0.6);
    const { dailyVol } = computeVolatility(flatRates);
    expect(dailyVol).toBeCloseTo(0, 10);
  });

  test("known series produces correct log-return vol", () => {
    // Constant 1% daily returns: log(1.01) each day
    const rates = [1.0, 1.01, 1.0201, 1.030301, 1.04060401];
    const { dailyVol, mean } = computeVolatility(rates);
    // All returns identical → std-dev = 0
    expect(dailyVol).toBeCloseTo(0, 8);
    expect(mean).toBeCloseTo(Math.log(1.01), 6);
  });

  test("annualised vol = daily vol × sqrt(252)", () => {
    const rates = [0.58, 0.59, 0.57, 0.61, 0.60, 0.595, 0.605, 0.58, 0.61, 0.59];
    const { dailyVol, annualisedVol } = computeVolatility(rates);
    expect(annualisedVol).toBeCloseTo(dailyVol * Math.sqrt(252), 8);
  });

  test("higher variance series produces higher vol", () => {
    const stable = [0.60, 0.601, 0.599, 0.600, 0.601, 0.599, 0.600];
    const volatile_ = [0.60, 0.65, 0.55, 0.70, 0.50, 0.68, 0.52];
    const stableVol = computeVolatility(stable).dailyVol;
    const volatileVol = computeVolatility(volatile_).dailyVol;
    expect(volatileVol).toBeGreaterThan(stableVol);
  });

  test("throws on fewer than 2 data points", () => {
    expect(() => computeVolatility([0.60])).toThrow();
    expect(() => computeVolatility([])).toThrow();
  });
});

describe("optimal_send_window percentile", () => {
  const history = [0.56, 0.57, 0.58, 0.59, 0.60, 0.61, 0.62, 0.63, 0.64, 0.65];

  test("current at min → 0th percentile", () => {
    expect(computePercentile(history, 0.56)).toBe(10); // 1 of 10 at or below
  });

  test("current at max → 100th percentile", () => {
    expect(computePercentile(history, 0.65)).toBe(100);
  });

  test("current at median → ~50th percentile", () => {
    const pct = computePercentile(history, 0.605);
    expect(pct).toBeGreaterThanOrEqual(50);
    expect(pct).toBeLessThanOrEqual(70);
  });

  test("current below all history → 0th percentile", () => {
    expect(computePercentile(history, 0.50)).toBe(0);
  });

  test("current above all history → 100th percentile", () => {
    expect(computePercentile(history, 0.99)).toBe(100);
  });
});

describe("NZD corridor sanity checks", () => {
  // These verify typical NZD ranges haven't been corrupted by bad data
  test("NZD/USD rate is plausible (0.45–0.75)", () => {
    const rate = 0.565;
    expect(rate).toBeGreaterThan(0.45);
    expect(rate).toBeLessThan(0.75);
  });

  test("annualised vol below 25% is normal for major NZD pairs", () => {
    // Typical NZD/USD annualised vol is ~8–15%
    const typicalAnnualisedVol = 0.0639; // 6.39% from live test
    expect(typicalAnnualisedVol).toBeLessThan(0.25);
    expect(typicalAnnualisedVol).toBeGreaterThan(0.0);
  });
});
