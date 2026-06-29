import { historicRate, convertFrom, isoDate, daysAgo } from "../xe-client.js";
import { ffCurrentRate, ffHistoricalRate, ffHistoricalSeries } from "../frankfurter-client.js";
import { getCachedRate, setCachedRate, storeCached } from "../sqlite-store.js";

function hasXeCredentials(): boolean {
  return !!(process.env.XE_ACCOUNT_ID && process.env.XE_API_KEY);
}

async function currentRate(from: string, to: string): Promise<{ rate: number; timestamp: string }> {
  if (hasXeCredentials()) {
    try {
      const result = await convertFrom(from, [to], 1);
      const mid = result.to[0]?.mid;
      if (mid != null) return { rate: mid, timestamp: result.timestamp };
      // Xe returned no usable rate — fall through to Frankfurter.
    } catch {
      // Xe failed (network / 4xx / 5xx / rate-limit) — fall through to Frankfurter.
    }
  }
  const { rate, date } = await ffCurrentRate(from, to);
  return { rate, timestamp: date };
}

async function historicalRateForDate(from: string, to: string, date: string): Promise<number | null> {
  if (hasXeCredentials()) {
    try {
      const r = await historicRate(from, to, date, 1);
      const mid = r.to[0]?.mid;
      if (mid != null) return mid;
      // Xe returned no usable rate — fall through to Frankfurter.
    } catch {
      // Xe failed (network / 4xx / 5xx / rate-limit) — fall through to Frankfurter.
    }
  }
  return ffHistoricalRate(from, to, date);
}

async function fetchHistoricalSeries(from: string, to: string, n: number): Promise<number[]> {
  const pair = `${from}${to}`;
  const source = hasXeCredentials() ? "xe" : "frankfurter";

  if (hasXeCredentials()) {
    const rates: number[] = [];
    for (let i = n; i >= 0; i--) {
      const date = isoDate(daysAgo(i));
      const cached = storeCached() ? getCachedRate(pair, date) : null;
      if (cached !== null) {
        rates.push(cached);
      } else {
        const rate = await historicalRateForDate(from, to, date);
        if (rate !== null) {
          if (storeCached()) setCachedRate(pair, date, rate, source);
          rates.push(rate);
        }
      }
    }
    return rates;
  }

  // Frankfurter: fetch the whole range in one call
  const end = isoDate(new Date());
  const start = isoDate(daysAgo(n));
  const series = await ffHistoricalSeries(from, to, start, end);
  if (storeCached()) {
    for (const { date, rate } of series) setCachedRate(pair, date, rate, source);
  }
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

export const movingAverageTool = {
  name: "moving_average",
  description:
    "Calculate simple moving averages (SMA) for a currency pair. Returns 20, 50, and 200-day SMAs (or custom period), current rate, and distance from each MA — useful for trend assessment.",
  inputSchema: {
    type: "object",
    properties: {
      from: { type: "string", description: "Base currency (e.g. NZD)" },
      to: { type: "string", description: "Quote currency (e.g. USD)" },
      periods: {
        type: "array",
        items: { type: "number" },
        description: "SMA periods to calculate (default: [20, 50, 200])",
      },
    },
    required: ["from", "to"],
  },
};

export async function handleMovingAverage(args: {
  from: string;
  to: string;
  periods?: number[];
}): Promise<string> {
  const periods = args.periods ?? [20, 50, 200];
  const maxPeriod = Math.min(Math.max(...periods), 200);
  // Markets close on weekends/holidays, so N *trading* days of SMA data needs
  // ~1.5x that many calendar days of history. Without this, SMA(200) never had
  // enough data points on the daily-close tier and always read "insufficient".
  // See review 2026-06-29.
  const calendarDays = Math.ceil(maxPeriod * 1.5);
  const rates = await fetchHistoricalSeries(args.from, args.to, calendarDays);

  if (rates.length < 5) return "Insufficient data to compute moving averages.";

  const { rate: current } = await currentRate(args.from, args.to);
  const source = hasXeCredentials() ? "Xe" : "Frankfurter/ECB";

  const lines = [
    `${args.from.toUpperCase()}/${args.to.toUpperCase()} — moving averages (${source})`,
    `Current rate: ${current.toFixed(6)}`,
    ``,
  ];

  for (const period of [...periods].sort((a, b) => a - b)) {
    if (rates.length < period) {
      lines.push(`SMA(${period}):  insufficient data (need ${period} days, have ${rates.length})`);
      continue;
    }
    const slice = rates.slice(-period);
    const sma = slice.reduce((a, b) => a + b, 0) / slice.length;
    const distance = ((current - sma) / sma) * 100;
    const signal = current > sma ? "above" : "below";
    lines.push(`SMA(${period}):  ${sma.toFixed(6)}  (current is ${Math.abs(distance).toFixed(2)}% ${signal})`);
  }

  return lines.join("\n");
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
  // Count strictly-lower days, matching the "were lower" wording and the
  // pair-summary tool (which uses `<`). See review 2026-06-29.
  const below = sorted.filter((r) => r < current).length;
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

export const pairSummaryTool = {
  name: "pair_summary",
  description:
    "One-call morning briefing for a currency pair: current rate, N-day range, annualised volatility, send-window verdict, and SMA(20). Combines get_rate + volatility_analysis + optimal_send_window into a single tool.",
  inputSchema: {
    type: "object",
    properties: {
      from: { type: "string", description: "Base currency (e.g. NZD)" },
      to: { type: "string", description: "Quote currency (e.g. USD)" },
      days: { type: "number", description: "Lookback window in days (7–90, default 30)" },
    },
    required: ["from", "to"],
  },
};

export async function handlePairSummary(args: { from: string; to: string; days?: number }): Promise<string> {
  const n = Math.min(Math.max(args.days ?? 30, 7), 90);
  const rates = await fetchHistoricalSeries(args.from, args.to, n);
  if (rates.length < 5) return "Insufficient data for pair summary.";

  const current = rates[rates.length - 1];
  const sorted = [...rates].sort((a, b) => a - b);
  const below = sorted.filter((r) => r < current).length;
  const percentile = Math.round((below / sorted.length) * 100);

  const logReturns = rates.slice(1).map((r, i) => Math.log(r / rates[i]));
  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const variance = logReturns.reduce((a, r) => a + Math.pow(r - mean, 2), 0) / (logReturns.length - 1);
  const annualisedVol = Math.sqrt(variance) * Math.sqrt(252);

  const sma20 = rates.length >= 20
    ? rates.slice(-20).reduce((a, b) => a + b, 0) / 20
    : null;

  let verdict: string;
  if (percentile >= 75) verdict = "FAVOURABLE ▲";
  else if (percentile >= 50) verdict = "NEUTRAL →";
  else if (percentile >= 25) verdict = "BELOW MEDIAN ↓";
  else verdict = "UNFAVOURABLE ▼";

  const source = hasXeCredentials() ? "Xe" : "Frankfurter/ECB";
  const from = args.from.toUpperCase();
  const to = args.to.toUpperCase();

  const lines = [
    `${from}/${to} — daily summary (${source})`,
    `Rate:          ${current.toFixed(6)}`,
    `${n}d range:   ${sorted[0].toFixed(6)} – ${sorted[sorted.length - 1].toFixed(6)}`,
    `${n}d percentile: ${percentile}th`,
    `Annualised vol: ${(annualisedVol * 100).toFixed(2)}%`,
    sma20 !== null
      ? `SMA(20):       ${sma20.toFixed(6)}  (${current > sma20 ? "+" : ""}${(((current - sma20) / sma20) * 100).toFixed(2)}%)`
      : `SMA(20):       insufficient data`,
    `Send verdict:  ${verdict}`,
  ];
  return lines.join("\n");
}
