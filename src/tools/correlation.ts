import { ffHistoricalSeries } from "../frankfurter-client.js";
import { historicRate, isoDate, daysAgo } from "../xe-client.js";
import { pearsonCorrelation } from "../stats.js";

function hasXeCredentials(): boolean {
  return !!(process.env.XE_ACCOUNT_ID && process.env.XE_API_KEY);
}

async function fetchLogReturnSeries(
  from: string,
  to: string,
  n: number
): Promise<{ date: string; r: number }[]> {
  let rates: { date: string; rate: number }[];

  if (hasXeCredentials()) {
    rates = [];
    for (let i = n; i >= 0; i--) {
      const date = isoDate(daysAgo(i));
      try {
        const r = await historicRate(from, to, date, 1);
        const rate = r.to[0]?.mid;
        if (rate !== undefined) rates.push({ date, rate });
      } catch {
        // skip
      }
    }
  } else {
    const start = isoDate(daysAgo(n));
    const end = isoDate(new Date());
    rates = await ffHistoricalSeries(from, to, start, end);
  }

  const logReturns: { date: string; r: number }[] = [];
  for (let i = 1; i < rates.length; i++) {
    logReturns.push({
      date: rates[i].date,
      r: Math.log(rates[i].rate / rates[i - 1].rate),
    });
  }
  return logReturns;
}

export const correlationTool = {
  name: "correlation_analysis",
  description:
    "Compute the Pearson correlation of daily log-returns between two currency pairs over N days. Useful for understanding co-movement: NZD/USD vs AUD/USD typically correlate highly (~0.85). Range: -1 (inverse) to +1 (perfect).",
  inputSchema: {
    type: "object",
    properties: {
      pair1_from: { type: "string", description: "Base currency of first pair (e.g. NZD)" },
      pair1_to: { type: "string", description: "Quote currency of first pair (e.g. USD)" },
      pair2_from: { type: "string", description: "Base currency of second pair (e.g. AUD)" },
      pair2_to: { type: "string", description: "Quote currency of second pair (e.g. USD)" },
      days: { type: "number", description: "Lookback window in days (10–90, default 30)" },
    },
    required: ["pair1_from", "pair1_to", "pair2_from", "pair2_to"],
  },
};

export async function handleCorrelation(args: {
  pair1_from: string;
  pair1_to: string;
  pair2_from: string;
  pair2_to: string;
  days?: number;
}): Promise<string> {
  const n = Math.min(Math.max(args.days ?? 30, 10), 90);
  const source = hasXeCredentials() ? "Xe" : "Frankfurter/ECB";

  const [series1, series2] = await Promise.all([
    fetchLogReturnSeries(args.pair1_from, args.pair1_to, n),
    fetchLogReturnSeries(args.pair2_from, args.pair2_to, n),
  ]);

  // Align by date
  const dates1 = new Map(series1.map((s) => [s.date, s.r]));
  const dates2 = new Map(series2.map((s) => [s.date, s.r]));
  const sharedDates = [...dates1.keys()].filter((d) => dates2.has(d)).sort();

  if (sharedDates.length < 5) return "Insufficient overlapping data for correlation.";

  const a = sharedDates.map((d) => dates1.get(d)!);
  const b = sharedDates.map((d) => dates2.get(d)!);
  const r = pearsonCorrelation(a, b);

  let interpretation: string;
  const abs = Math.abs(r);
  if (abs >= 0.8) interpretation = r > 0 ? "strong positive" : "strong inverse";
  else if (abs >= 0.5) interpretation = r > 0 ? "moderate positive" : "moderate inverse";
  else if (abs >= 0.2) interpretation = r > 0 ? "weak positive" : "weak inverse";
  else interpretation = "near-zero (no meaningful co-movement)";

  const pair1 = `${args.pair1_from.toUpperCase()}/${args.pair1_to.toUpperCase()}`;
  const pair2 = `${args.pair2_from.toUpperCase()}/${args.pair2_to.toUpperCase()}`;

  return [
    `Correlation: ${pair1} vs ${pair2} (${source}, ${n}d)`,
    `Pearson r:       ${r.toFixed(4)}`,
    `Interpretation:  ${interpretation}`,
    `Data points:     ${sharedDates.length} aligned trading days`,
    "",
    "Context: r > 0.8 = pairs move together (common with AUD/USD vs NZD/USD).",
    "         r < -0.5 = inverse relationship. r ≈ 0 = uncorrelated.",
  ].join("\n");
}
