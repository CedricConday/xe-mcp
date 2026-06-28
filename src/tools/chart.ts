import { ffHistoricalSeries } from "../frankfurter-client.js";
import { historicRate, isoDate, daysAgo } from "../xe-client.js";

function hasXeCredentials(): boolean {
  return !!(process.env.XE_ACCOUNT_ID && process.env.XE_API_KEY);
}

function asciiChart(rates: { date: string; rate: number }[], height = 10): string {
  if (rates.length < 2) return "Insufficient data for chart.";

  const values = rates.map((r) => r.rate);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  // Build the chart grid
  const rows: string[][] = Array.from({ length: height }, () =>
    Array(rates.length).fill(" ")
  );

  // Plot the rate as a line using '▪' or '─'
  rates.forEach((r, i) => {
    const normalised = (r.rate - min) / range;
    const row = Math.round((1 - normalised) * (height - 1));
    rows[row][i] = "●";
    // Connect to previous point
    if (i > 0) {
      const prevNormalised = (rates[i - 1].rate - min) / range;
      const prevRow = Math.round((1 - prevNormalised) * (height - 1));
      const low = Math.min(row, prevRow);
      const high = Math.max(row, prevRow);
      for (let r = low; r <= high; r++) {
        if (rows[r][i] === " ") rows[r][i] = "│";
      }
    }
  });

  // Build output
  const lines: string[] = [];
  const maxLabel = max.toFixed(4);
  const minLabel = min.toFixed(4);
  const midLabel = ((max + min) / 2).toFixed(4);

  for (let r = 0; r < height; r++) {
    let label = "        ";
    if (r === 0) label = maxLabel;
    else if (r === Math.floor(height / 2)) label = midLabel;
    else if (r === height - 1) label = minLabel;
    lines.push(`${label.padStart(8)} │ ${rows[r].join("")}`);
  }

  // X-axis
  lines.push(`         └${"─".repeat(rates.length)}`);

  // Date labels (first, middle, last)
  const firstDate = rates[0].date.slice(5); // MM-DD
  const midDate = rates[Math.floor(rates.length / 2)].date.slice(5);
  const lastDate = rates[rates.length - 1].date.slice(5);
  const midOffset = Math.max(0, Math.floor(rates.length / 2) - firstDate.length);
  const lastOffset = Math.max(0, rates.length - Math.floor(rates.length / 2) - midDate.length - lastDate.length + 1);
  const dateLine = `          ${firstDate}${" ".repeat(midOffset)}${midDate}${" ".repeat(lastOffset)}${lastDate}`;
  lines.push(dateLine);

  return lines.join("\n");
}

export const rateChartTool = {
  name: "rate_chart",
  description:
    "Render an ASCII line chart of a currency pair's rate history over N days. Shows trend visually in the terminal.",
  inputSchema: {
    type: "object",
    properties: {
      from: { type: "string", description: "Base currency (e.g. NZD)" },
      to: { type: "string", description: "Quote currency (e.g. USD)" },
      days: { type: "number", description: "Number of days to show (7–60, default 30)" },
    },
    required: ["from", "to"],
  },
};

export async function handleRateChart(args: {
  from: string;
  to: string;
  days?: number;
}): Promise<string> {
  const n = Math.min(Math.max(args.days ?? 30, 7), 60);
  const source = hasXeCredentials() ? "Xe" : "Frankfurter/ECB";
  let series: { date: string; rate: number }[];

  if (hasXeCredentials()) {
    const rates: { date: string; rate: number }[] = [];
    for (let i = n; i >= 1; i--) {
      const date = isoDate(daysAgo(i));
      try {
        const r = await historicRate(args.from, args.to, date, 1);
        const rate = r.to[0]?.mid;
        if (rate !== undefined) rates.push({ date, rate });
      } catch {
        // skip
      }
    }
    series = rates;
  } else {
    const start = isoDate(daysAgo(n));
    const end = isoDate(daysAgo(1));
    series = await ffHistoricalSeries(args.from, args.to, start, end);
  }

  if (series.length < 4) return "Insufficient data for chart.";

  const pair = `${args.from.toUpperCase()}/${args.to.toUpperCase()}`;
  const current = series[series.length - 1].rate.toFixed(6);
  const header = `${pair} — ${n}d chart (${source}) · current: ${current}`;

  return header + "\n\n" + asciiChart(series);
}
