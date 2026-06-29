// Unit tests for the SMA math. Imported from the shared stats module.
import { sma } from "../stats.js";

// Display helper (distance %) — trivial formatting, mirrors the tool's inline calc.
function distanceFromSMA(current: number, smaValue: number): number {
  return ((current - smaValue) / smaValue) * 100;
}

describe("SMA computation (sma)", () => {
  test("SMA of constant series equals the constant", () => {
    expect(sma(Array(50).fill(1.5), 20)).toBeCloseTo(1.5, 6);
  });

  test("SMA(5) of [1..7] = mean of last 5 = 5", () => {
    expect(sma([1, 2, 3, 4, 5, 6, 7], 5)).toBeCloseTo(5, 6);
  });

  test("SMA(3) on 3-element series = mean of all", () => {
    expect(sma([10, 20, 30], 3)).toBeCloseTo(20, 6);
  });

  test("returns null when insufficient data", () => {
    expect(sma([1.2, 1.3], 20)).toBeNull();
  });

  test("SMA(200) on exactly 200 points = mean", () => {
    const rates = Array.from({ length: 200 }, (_, i) => i + 1);
    expect(sma(rates, 200)).toBeCloseTo(100.5, 6);
  });

  test("longer period uses tail not head", () => {
    const rates = [...Array(100).fill(1.0), ...Array(20).fill(2.0)];
    expect(sma(rates, 20)).toBeCloseTo(2.0, 6);
    expect(sma(rates, 50)!).toBeLessThan(2.0);
  });
});

describe("distance from SMA", () => {
  test("current above SMA → positive distance", () => {
    expect(distanceFromSMA(1.1, 1.0)).toBeCloseTo(10, 6);
  });

  test("current below SMA → negative distance", () => {
    expect(distanceFromSMA(0.9, 1.0)).toBeCloseTo(-10, 6);
  });

  test("current equal to SMA → zero distance", () => {
    expect(distanceFromSMA(1.0, 1.0)).toBe(0);
  });

  test("distance is proportional — 5% above", () => {
    expect(distanceFromSMA(1.05, 1.0)).toBeCloseTo(5, 4);
  });
});

describe("SMA period ordering", () => {
  test("SMA(20) responds faster to recent change than SMA(50)", () => {
    const rates = [...Array(40).fill(1.0), ...Array(10).fill(2.0)];
    expect(sma(rates, 20)!).toBeGreaterThan(sma(rates, 50)!);
  });
});
