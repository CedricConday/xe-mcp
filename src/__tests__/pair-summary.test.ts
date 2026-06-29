// Unit tests for pair_summary math. The math (percentile, vol, SMA) is imported
// from the shared stats module; only the display-label `verdict` is local.
import { percentileBelow, annualisedVolatility, sma } from "../stats.js";

// Verdict label thresholds (mirrors the tool's inline display logic).
function verdict(p: number): string {
  if (p >= 75) return "FAVOURABLE ▲";
  if (p >= 50) return "NEUTRAL →";
  if (p >= 25) return "BELOW MEDIAN ↓";
  return "UNFAVOURABLE ▼";
}

describe("pair_summary math", () => {
  const flat = Array(30).fill(0.5649);

  test("percentile of current strictly above all others approaches 100%", () => {
    const max = 1.0;
    const rates = [...flat, max];
    // 30 of 31 strictly below → round(30/31*100) = 97
    expect(percentileBelow(rates, max)).toBe(97);
  });

  test("percentile of current at bottom = 0%", () => {
    const min = 0.0001;
    expect(percentileBelow([min, ...flat], min)).toBe(0);
  });

  test("annualised vol of constant series = 0", () => {
    expect(annualisedVolatility(flat).annualisedVol).toBeCloseTo(0, 6);
  });

  test("annualised vol of alternating series is non-zero", () => {
    const alternating = Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? 1.0 : 1.01));
    expect(annualisedVolatility(alternating).annualisedVol).toBeGreaterThan(0);
  });

  test("sma(20) of flat series equals the constant", () => {
    expect(sma(flat, 20)).toBeCloseTo(0.5649, 4);
  });

  test("sma(20) returns null for fewer than 20 rates", () => {
    expect(sma(Array(15).fill(0.5), 20)).toBeNull();
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
