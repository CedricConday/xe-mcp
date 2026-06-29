// Unit tests for Pearson correlation. Imported from the shared stats module.
import { pearsonCorrelation } from "../stats.js";

describe("pearsonCorrelation", () => {
  test("perfectly correlated series returns 1.0", () => {
    const a = [1, 2, 3, 4, 5];
    expect(pearsonCorrelation(a, a)).toBeCloseTo(1.0, 8);
  });

  test("perfectly inverse series returns -1.0", () => {
    expect(pearsonCorrelation([1, 2, 3, 4, 5], [5, 4, 3, 2, 1])).toBeCloseTo(-1.0, 8);
  });

  test("flat series → denom 0 → returns 0", () => {
    expect(pearsonCorrelation([1, 1, 1, 1, 1], [2, 3, 1, 4, 2])).toBe(0);
  });

  test("shifts and scales don't affect correlation", () => {
    const a = [1, 3, 2, 5, 4];
    const b = a.map((x) => x * 3 + 10);
    expect(pearsonCorrelation(a, b)).toBeCloseTo(1.0, 8);
  });

  test("throws on fewer than 3 points", () => {
    expect(() => pearsonCorrelation([1, 2], [1, 2])).toThrow();
    expect(() => pearsonCorrelation([], [])).toThrow();
  });

  test("result is bounded between -1 and 1", () => {
    const a = [0.6, 0.61, 0.59, 0.62, 0.58, 0.63, 0.57, 0.64, 0.56, 0.65];
    const b = [0.64, 0.63, 0.65, 0.61, 0.66, 0.6, 0.67, 0.59, 0.68, 0.58];
    const r = pearsonCorrelation(a, b);
    expect(r).toBeGreaterThanOrEqual(-1);
    expect(r).toBeLessThanOrEqual(1);
  });

  test("NZD/USD vs AUD/USD structurally high correlation", () => {
    const nzdusd = [0.564, 0.567, 0.561, 0.57, 0.558, 0.565, 0.571, 0.562, 0.568, 0.555];
    const audusd = [0.645, 0.65, 0.641, 0.655, 0.638, 0.643, 0.651, 0.639, 0.648, 0.633];
    expect(pearsonCorrelation(nzdusd, audusd)).toBeGreaterThan(0.7);
  });
});
