// Unit tests for SMA (simple moving average) math — no API calls

function computeSMA(rates: number[], period: number): number | null {
  if (rates.length < period) return null;
  const slice = rates.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function distanceFromSMA(current: number, sma: number): number {
  return ((current - sma) / sma) * 100;
}

describe("SMA computation", () => {
  test("SMA of constant series equals the constant", () => {
    const rates = Array(50).fill(1.5);
    const sma = computeSMA(rates, 20);
    expect(sma).toBeCloseTo(1.5, 6);
  });

  test("SMA(5) of [1,2,3,4,5,6,7] = mean of last 5 = 5", () => {
    const rates = [1, 2, 3, 4, 5, 6, 7];
    const sma = computeSMA(rates, 5);
    expect(sma).toBeCloseTo(5, 6); // mean of [3,4,5,6,7]
  });

  test("SMA(3) on 3-element series = mean of all", () => {
    const rates = [10, 20, 30];
    const sma = computeSMA(rates, 3);
    expect(sma).toBeCloseTo(20, 6);
  });

  test("returns null when insufficient data", () => {
    const rates = [1.2, 1.3];
    expect(computeSMA(rates, 20)).toBeNull();
  });

  test("SMA(200) on exactly 200 points = mean", () => {
    const rates = Array.from({ length: 200 }, (_, i) => i + 1);
    const sma = computeSMA(rates, 200);
    expect(sma).toBeCloseTo(100.5, 6); // mean of 1..200
  });

  test("longer period uses tail not head", () => {
    // First 100 = 1.0, last 20 = 2.0 — SMA(20) should be 2.0
    const low = Array(100).fill(1.0);
    const high = Array(20).fill(2.0);
    const rates = [...low, ...high];
    const sma20 = computeSMA(rates, 20);
    const sma50 = computeSMA(rates, 50);
    expect(sma20).toBeCloseTo(2.0, 6);
    expect(sma50).toBeLessThan(2.0); // last 50 includes some 1.0s
  });
});

describe("distance from SMA", () => {
  test("current above SMA → positive distance", () => {
    const dist = distanceFromSMA(1.1, 1.0);
    expect(dist).toBeCloseTo(10, 6); // 10% above
  });

  test("current below SMA → negative distance", () => {
    const dist = distanceFromSMA(0.9, 1.0);
    expect(dist).toBeCloseTo(-10, 6); // 10% below
  });

  test("current equal to SMA → zero distance", () => {
    const dist = distanceFromSMA(1.0, 1.0);
    expect(dist).toBe(0);
  });

  test("distance is proportional — 5% above", () => {
    const dist = distanceFromSMA(1.05, 1.0);
    expect(dist).toBeCloseTo(5, 4);
  });

  test("distance is symmetric — above by same percentage as below", () => {
    const up = distanceFromSMA(1.1, 1.0);
    const down = distanceFromSMA(0.9 / 1.1, 1.0 / 1.1);
    expect(Math.abs(up - Math.abs(down))).toBeLessThan(2); // approx symmetric
  });
});

describe("SMA period ordering", () => {
  test("SMA(20) responds faster to recent change than SMA(50)", () => {
    // A spike in the last 10 rates should affect SMA(20) more than SMA(50)
    const stable = Array(40).fill(1.0);
    const spike = Array(10).fill(2.0);
    const rates = [...stable, ...spike];
    const sma20 = computeSMA(rates, 20)!;
    const sma50 = computeSMA(rates, 50)!;
    expect(sma20).toBeGreaterThan(sma50); // more recent window = more sensitive
  });
});
