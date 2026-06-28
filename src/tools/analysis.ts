import { historicRate, convertFrom, isoDate, daysAgo } from "../xe-client.js";
import { ffCurrentRate, ffHistoricalRate, ffHistoricalSeries } from "../frankfurter-client.js";

function hasXeCredentials(): boolean {
  return !!(process.env.XE_ACCOUNT_ID && process.env.XE_API_KEY);
}

async function currentRate(from: string, to: string): Promise<{ rate: number; timestamp: string }> {
  if (hasXeCredentials()) {
    const result = await convertFrom(from, [to], 1);
    return { rate: result.to[0]?.mid ?? (() => { throw new Error("No rate"); })(), timestamp: result.timestamp };
  }
  const { rate, date } = await ffCurrentRate(from, to);
  return { rate, timestamp: date };
}

async function historicalRateForDate(from: string, to: string, date: string): Promise<number | null> {
  if (hasXeCredentials()) {
    try {
      const r = await historicRate(from, to, date, 1);
      return r.to[0]?.mid ?? null;
    } catch {
      return null;
    }
  }
  return ffHistoricalRate(from, to, date);
}

async function fetchHistoricalSeries(from: string, to: string, n: number): Promise<number[]> {
  if (hasXeCredentials()) {
    const rates: number[] = [];
    for (let i = n; i >= 0; i--) {
      const date = isoDate(daysAgo(i));
      const rate = await historicalRateForDate(from, to, date);
      if (rate !== null) rates.push(rate);
    }
    return rates;
  }
  // Frankfurter: fetch the whole range in one call
  const end = isoDate(new Date());
  const start = isoDate(daysAgo(n));
  const series = await ffHistoricalSeries(from, to, start, end);
  return series.map((s) => s.rate);
}

export const historicalRatesTool = {
  name: "get_historical_rates",
  description:
    "Fetch daily mid-market rates for a currency pair over the past N days. Uses Xe when credentials are set; falls back to Frankfurter (ECB) for free use.",
  inputSchema: {
    type: "object",
    properties: {
      from: { type: "string", description: "Base currency (e.g. NZD)" },
      to: { type: "string", description: "Quote currency (e.g. USD)" },
      days: { type: "number", description: "Number of days of history (1–90, default 30)" },
    },
    required: ["from", "to"],
  },
};

export async function handleHistoricalRates(args: {
  from: string;
  to: string;
  days?: number;
}): Promise<string> {
  const n = Math.min(args.days ?? 30, 90);

  if (hasXeCredentials()) {
    const rows: string[] = [];
    for (let i = n; i >= 1; i--) {
      const date = isoDate(daysAgo(i));
      const rate = await historicalRateForDate(args.from, args.to, date);
      rows.push(`${date}: ${rate !== null ? rate.toFixed(6) : "N/A"}`);
    }
    return rows.join("\n");
  }

  const end = isoDate(new Date());
  const start = isoDate(daysAgo(n));
  const series = await ffHistoricalSeries(args.from, args.to, start, end);
  const source = "source: Frankfurter / ECB (free tier)\n";
  return source + series.map((s) => `${s.date}: ${s.rate.toFixed(6)}`).join("\n");
}

export const volatilityTool = {
  name: "volatility_analysis",
  description:
    "Calculate annualised volatility of a currency pair over the past N days. Returns daily std-dev of log-returns and annualised figure — same methodology used in FX options pricing.",
  inputSchema: {
    type: "object",
    properties: {
      from: { type: "string", description: "Base currency" },
      to: { type: "string", description: "Quote currency" },
      days: { type: "number", description: "Lookback window in days (7–90, default 30)" },
    },
    required: ["from", "to"],
  },
};

export async function handleVolatility(args: {
  from: string;
  to: string;
  days?: number;
}): Promise<string> {
  const n = Math.min(Math.max(args.days ?? 30, 7), 90);
  const rates = await fetchHistoricalSeries(args.from, args.to, n);

  if (rates.length < 5) return "Insufficient data to compute volatility.";

  const logReturns = rates.slice(1).map((r, i) => Math.log(r / rates[i]));
  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const variance =
    logReturns.reduce((a, r) => a + Math.pow(r - mean, 2), 0) / (logReturns.length - 1);
  const dailyVol = Math.sqrt(variance);
  const annualisedVol = dailyVol * Math.sqrt(252);

  const sorted = [...rates].sort((a, b) => a - b);
  const current = rates[rates.length - 1].toFixed(6);
  const source = hasXeCredentials() ? "Xe" : "Frankfurter/ECB";

  return [
    `${args.from.toUpperCase()}/${args.to.toUpperCase()} — ${n}-day volatility (${source})`,
    `Current rate:       ${current}`,
    `Range (${n}d):       ${sorted[0].toFixed(6)} – ${sorted[sorted.length - 1].toFixed(6)}`,
    `Daily volatility:   ${(dailyVol * 100).toFixed(4)}%`,
    `Annualised vol:     ${(annualisedVol * 100).toFixed(2)}%`,
    `Data points used:   ${rates.length}`,
  ].join("\n");
}

export const optimalSendTool = {
  name: "optimal_send_window",
  description:
    "Tells you where today's rate sits in the N-day distribution and whether now is statistically favourable to convert. Useful for FX timing decisions.",
  inputSchema: {
    type: "object",
    properties: {
      from: { type: "string", description: "Currency you are sending (e.g. NZD)" },
      to: { type: "string", description: "Currency you want to receive (e.g. USD)" },
      days: { type: "number", description: "Lookback window in days (default 30)" },
    },
    required: ["from", "to"],
  },
};

export async function handleOptimalSend(args: {
  from: string;
  to: string;
  days?: number;
}): Promise<string> {
  const n = Math.min(args.days ?? 30, 90);
  const historicalRates = await fetchHistoricalSeries(args.from, args.to, n);
  if (historicalRates.length < 5) return "Insufficient historical data.";

  const { rate: current, timestamp } = await currentRate(args.from, args.to);
  const sorted = [...historicalRates].sort((a, b) => a - b);
  const below = sorted.filter((r) => r <= current).length;
  const percentile = Math.round((below / sorted.length) * 100);
  const mean = historicalRates.reduce((a, b) => a + b, 0) / historicalRates.length;
  const source = hasXeCredentials() ? "Xe" : "Frankfurter/ECB";

  let verdict: string;
  if (percentile >= 75) verdict = "FAVOURABLE — top quartile of past period";
  else if (percentile >= 50) verdict = "NEUTRAL — above median, not exceptional";
  else if (percentile >= 25) verdict = "BELOW MEDIAN — consider waiting if timing is flexible";
  else verdict = "UNFAVOURABLE — bottom quartile";

  return [
    `${args.from.toUpperCase()}→${args.to.toUpperCase()} send window (${source})`,
    `Current rate:  ${current.toFixed(6)}`,
    `${n}-day mean:   ${mean.toFixed(6)}`,
    `${n}-day range:  ${sorted[0].toFixed(6)} – ${sorted[sorted.length - 1].toFixed(6)}`,
    `Percentile:    ${percentile}th (${below}/${sorted.length} historical days were lower)`,
    `Verdict:       ${verdict}`,
    `Timestamp:     ${timestamp}`,
  ].join("\n");
}
