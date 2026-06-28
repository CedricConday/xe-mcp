// Unit tests for pair_summary math — percentile, vol, SMA(20), verdict label

function percentile(current: number, series: number[]): number {
  const below = series.filter((r) => r < current).length;
  return Math.round((below / series.length) * 100);
}

function annualisedVol(rates: number[]): number {
  const log = rates.slice(1).map((r, i) => Math.log(r / rates[i]));
  const mean = log.reduce((a, b) => a + b, 0) / log.length;
  const variance = log.reduce((a, r) => a + Math.pow(r - mean, 2), 0) / (log.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252);
}

function sma20(rates: number[]): number | null {
  if (rates.length < 20) return null;
  const slice = rates.slice(-20);
  return slice.reduce((a, b) => a + b, 0) / 20;
}

function verdict(p: number): string {
  if (p >= 75) return "FAVOURABLE ▲";
  if (p >= 50) return "NEUTRAL →";
  if (p >= 25) return "BELOW MEDIAN ↓";
  return "UNFAVOURABLE ▼";
}

describe("pair_summary math", () => {
  const flat = Array(30).fill(0.5649);

  test("percentile of current rate strictly above all others approaches 100%", () => {
    const max = 1.0;
    const rates = [...flat, max];
    // below = 30 out of 31 total → round(30/31*100) = 97
    expect(percentile(max, rates)).toBe(97);
  });

  test("percentile of current rate at bottom = 0%", () => {
    const min = 0.0001;
    const rates = [min, ...flat];
    expect(percentile(min, rates)).toBe(0);
  });

  test("annualised vol of constant series = 0", () => {
    expect(annualisedVol(flat)).toBeCloseTo(0, 6);
  });

  test("annualised vol of alternating series is non-zero", () => {
    // alternating up/down series produces non-zero variance of log-returns
    const alternating = Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? 1.0 : 1.01));
    expect(annualisedVol(alternating)).toBeGreaterThan(0);
  });

  test("sma20 of flat series equals the constant", () => {
    expect(sma20(flat)).toBeCloseTo(0.5649, 4);
  });

  test("sma20 returns null for fewer than 20 rates", () => {
    expect(sma20(Array(15).fill(0.5))).toBeNull();
  });

  test("verdict FAVOURABLE when percentile >= 75", () => {
    expect(verdict(75)).toBe("FAVOURABLE ▲");
    expect(verdict(99)).toBe("FAVOURABLE ▲");
  });

  test("verdict UNFAVOURABLE when percentile < 25", () => {
    expect(verdict(0)).toBe("UNFAVOURABLE ▼");
    expect(verdict(24)).toBe("UNFAVOURABLE ▼");
  });

  test("verdict NEUTRAL when 50 <= percentile < 75", () => {
    expect(verdict(50)).toBe("NEUTRAL →");
    expect(verdict(74)).toBe("NEUTRAL →");
  });

  test("verdict BELOW MEDIAN when 25 <= percentile < 50", () => {
    expect(verdict(25)).toBe("BELOW MEDIAN ↓");
    expect(verdict(49)).toBe("BELOW MEDIAN ↓");
  });
});
