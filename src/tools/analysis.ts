import { historicRate, convertFrom, isoDate, daysAgo } from "../xe-client.js";

export const historicalRatesTool = {
  name: "get_historical_rates",
  description:
    "Fetch daily historical mid-market rates for a currency pair over the past N days.",
  inputSchema: {
    type: "object",
    properties: {
      from: { type: "string", description: "Base currency (e.g. NZD)" },
      to: { type: "string", description: "Quote currency (e.g. USD)" },
      days: {
        type: "number",
        description: "Number of days of history to fetch (1–90, default 30)",
      },
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
  const rows: string[] = [];

  for (let i = n; i >= 1; i--) {
    const date = isoDate(daysAgo(i));
    try {
      const r = await historicRate(args.from, args.to, date, 1);
      const rate = r.to[0]?.mid;
      if (rate !== undefined) rows.push(`${date}: ${rate.toFixed(6)}`);
    } catch {
      rows.push(`${date}: N/A`);
    }
  }

  return rows.join("\n");
}

export const volatilityTool = {
  name: "volatility_analysis",
  description:
    "Calculate the annualised volatility of a currency pair over the past N days. Returns daily std-dev of log-returns and annualised figure — same methodology used in options pricing.",
  inputSchema: {
    type: "object",
    properties: {
      from: { type: "string", description: "Base currency" },
      to: { type: "string", description: "Quote currency" },
      days: {
        type: "number",
        description: "Lookback window in days (7–90, default 30)",
      },
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
  const rates: number[] = [];

  for (let i = n; i >= 0; i--) {
    const date = isoDate(daysAgo(i));
    try {
      const r = await historicRate(args.from, args.to, date, 1);
      const rate = r.to[0]?.mid;
      if (rate !== undefined) rates.push(rate);
    } catch {
      // skip missing dates (weekends, holidays)
    }
  }

  if (rates.length < 5) return "Insufficient data to compute volatility.";

  const logReturns = rates.slice(1).map((r, i) => Math.log(r / rates[i]));
  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const variance =
    logReturns.reduce((a, r) => a + Math.pow(r - mean, 2), 0) / (logReturns.length - 1);
  const dailyVol = Math.sqrt(variance);
  const annualisedVol = dailyVol * Math.sqrt(252);

  const min = Math.min(...rates).toFixed(6);
  const max = Math.max(...rates).toFixed(6);
  const current = rates[rates.length - 1].toFixed(6);

  return [
    `${args.from.toUpperCase()}/${args.to.toUpperCase()} — ${n}-day analysis`,
    `Current rate:       ${current}`,
    `Range (${n}d):       ${min} – ${max}`,
    `Daily volatility:   ${(dailyVol * 100).toFixed(4)}%`,
    `Annualised vol:     ${(annualisedVol * 100).toFixed(2)}%`,
    `Data points used:   ${rates.length}`,
  ].join("\n");
}

export const optimalSendTool = {
  name: "optimal_send_window",
  description:
    "Given a currency pair and a 30-day lookback, tells you where today's rate sits in the recent distribution and whether now is statistically favourable to convert. Useful for FX timing decisions.",
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
  const historicalRates: number[] = [];

  for (let i = n; i >= 1; i--) {
    const date = isoDate(daysAgo(i));
    try {
      const r = await historicRate(args.from, args.to, date, 1);
      const rate = r.to[0]?.mid;
      if (rate !== undefined) historicalRates.push(rate);
    } catch {
      // skip weekends/holidays
    }
  }

  const live = await convertFrom(args.from, [args.to], 1);
  const current = live.to[0]?.mid;
  if (current === undefined) return "Could not fetch current rate.";

  if (historicalRates.length < 5) return "Insufficient historical data.";

  const sorted = [...historicalRates].sort((a, b) => a - b);
  const below = sorted.filter((r) => r <= current).length;
  const percentile = Math.round((below / sorted.length) * 100);
  const mean = historicalRates.reduce((a, b) => a + b, 0) / historicalRates.length;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  // Higher rate = more of `to` per unit of `from` = better for sender
  let verdict: string;
  if (percentile >= 75) verdict = "FAVOURABLE — rate is in the top quartile of the past period";
  else if (percentile >= 50) verdict = "NEUTRAL — rate is above median but not exceptional";
  else if (percentile >= 25) verdict = "BELOW MEDIAN — consider waiting if timing is flexible";
  else verdict = "UNFAVOURABLE — rate is in the bottom quartile";

  return [
    `${args.from.toUpperCase()}→${args.to.toUpperCase()} send window analysis`,
    `Current rate:  ${current.toFixed(6)}`,
    `${n}-day mean:   ${mean.toFixed(6)}`,
    `${n}-day range:  ${min.toFixed(6)} – ${max.toFixed(6)}`,
    `Percentile:    ${percentile}th (${below}/${sorted.length} historical days were lower)`,
    `Verdict:       ${verdict}`,
    `Timestamp:     ${live.timestamp}`,
  ].join("\n");
}
