import { ffCurrentRate } from "../frankfurter-client.js";
import { convertFrom } from "../xe-client.js";

function hasXeCredentials(): boolean {
  return !!(process.env.XE_ACCOUNT_ID && process.env.XE_API_KEY);
}

export const rateAlertCheckTool = {
  name: "rate_alert_check",
  description:
    "Check whether a currency pair's current rate has crossed a threshold. Returns a boolean verdict and the current rate — designed for use in polling loops or CI checks that trigger alerts.",
  inputSchema: {
    type: "object",
    properties: {
      from: { type: "string", description: "Base currency (e.g. NZD)" },
      to: { type: "string", description: "Quote currency (e.g. USD)" },
      threshold: {
        type: "number",
        description: "The rate to check against",
      },
      direction: {
        type: "string",
        enum: ["above", "below"],
        description: "'above' = alert when rate > threshold; 'below' = alert when rate < threshold",
      },
    },
    required: ["from", "to", "threshold", "direction"],
  },
};

export async function handleRateAlertCheck(args: {
  from: string;
  to: string;
  threshold: number;
  direction: "above" | "below";
}): Promise<string> {
  let current: number;
  let timestamp: string;

  if (hasXeCredentials()) {
    const result = await convertFrom(args.from, [args.to], 1);
    current = result.to[0]?.mid ?? (() => { throw new Error("No rate"); })();
    timestamp = result.timestamp;
  } else {
    const r = await ffCurrentRate(args.from, args.to);
    current = r.rate;
    timestamp = r.date;
  }

  const triggered =
    args.direction === "above" ? current > args.threshold : current < args.threshold;

  const pair = `${args.from.toUpperCase()}/${args.to.toUpperCase()}`;
  const condition = `${pair} ${args.direction} ${args.threshold}`;
  const source = hasXeCredentials() ? "Xe" : "Frankfurter/ECB";

  return [
    `Alert check: ${condition}`,
    `Current rate: ${current.toFixed(6)} (${source}, ${timestamp})`,
    `Threshold:    ${args.threshold}`,
    `Triggered:    ${triggered ? "YES ✓" : "NO ✗"}`,
    triggered
      ? `→ Rate is ${args.direction} threshold by ${Math.abs(current - args.threshold).toFixed(6)}`
      : `→ Rate needs to move ${Math.abs(current - args.threshold).toFixed(6)} to trigger`,
  ].join("\n");
}
