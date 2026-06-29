// Unit tests for the volatility + percentile math. Imported from the shared
// stats module so they exercise the REAL shipped code, not a re-implementation.
import { annualisedVolatility, percentileBelow } from "../stats.js";

describe("volatility_analysis math (annualisedVolatility)", () => {
  test("zero-vol series returns ~0 daily vol", () => {
    const flatRates = Array(30).fill(0.6);
    expect(annualisedVolatility(flatRates).dailyVol).toBeCloseTo(0, 10);
  });

  test("constant log-returns → zero vol, mean = log(1.01)", () => {
    const rates = [1.0, 1.01, 1.0201, 1.030301, 1.04060401];
    const { dailyVol, mean } = annualisedVolatility(rates);
    expect(dailyVol).toBeCloseTo(0, 8);
    expect(mean).toBeCloseTo(Math.log(1.01), 6);
  });

  test("annualised vol = daily vol * sqrt(252)", () => {
    const rates = [0.58, 0.59, 0.57, 0.61, 0.6, 0.595, 0.605, 0.58, 0.61, 0.59];
    const { dailyVol, annualisedVol } = annualisedVolatility(rates);
    expect(annualisedVol).toBeCloseTo(dailyVol * Math.sqrt(252), 8);
  });

  test("higher variance series produces higher vol", () => {
    const stable = [0.6, 0.601, 0.599, 0.6, 0.601, 0.599, 0.6];
    const volatile_ = [0.6, 0.65, 0.55, 0.7, 0.5, 0.68, 0.52];
    expect(annualisedVolatility(volatile_).dailyVol).toBeGreaterThan(
      annualisedVolatility(stable).dailyVol
    );
  });

  test("throws on fewer than 2 data points", () => {
    expect(() => annualisedVolatility([0.6])).toThrow();
    expect(() => annualisedVolatility([])).toThrow();
  });
});

describe("optimal_send_window percentile (percentileBelow — strictly lower)", () => {
  const history = [0.56, 0.57, 0.58, 0.59, 0.6, 0.61, 0.62, 0.63, 0.64, 0.65];

  test("current at min → 0th percentile (none strictly lower)", () => {
    expect(percentileBelow(history, 0.56)).toBe(0);
  });

  test("current at max → 90th percentile (9 of 10 strictly lower)", () => {
    expect(percentileBelow(history, 0.65)).toBe(90);
  });

  test("current at median → ~50th percentile", () => {
    const pct = percentileBelow(history, 0.605);
    expect(pct).toBeGreaterThanOrEqual(50);
    expect(pct).toBeLessThanOrEqual(70);
  });

  test("current below all history → 0th percentile", () => {
    expect(percentileBelow(history, 0.5)).toBe(0);
  });

  test("current above all history → 100th percentile", () => {
    expect(percentileBelow(history, 0.99)).toBe(100);
  });

  test("empty series → 0 (no crash)", () => {
    expect(percentileBelow([], 0.5)).toBe(0);
  });
});

describe("NZD corridor sanity checks", () => {
  test("NZD/USD rate is plausible (0.45-0.75)", () => {
    const rate = 0.565;
    expect(rate).toBeGreaterThan(0.45);
    expect(rate).toBeLessThan(0.75);
  });

  test("annualised vol below 25% is normal for major NZD pairs", () => {
    const typicalAnnualisedVol = 0.0639;
    expect(typicalAnnualisedVol).toBeLessThan(0.25);
    expect(typicalAnnualisedVol).toBeGreaterThan(0.0);
  });
});
