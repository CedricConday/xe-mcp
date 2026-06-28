import { ffCurrentRate } from "../frankfurter-client.js";
import { convertFrom } from "../xe-client.js";

const NZD_PAIRS = ["USD", "AUD", "EUR", "GBP", "JPY", "SGD", "CNY"];

function hasXeCredentials(): boolean {
  return !!(process.env.XE_ACCOUNT_ID && process.env.XE_API_KEY);
}

export const nzdCorridorsTool = {
  name: "nzd_corridors",
  description:
    "Snapshot of NZD against all major trading pairs simultaneously (USD, AUD, EUR, GBP, JPY, SGD, CNY). Useful for a quick NZD strength overview.",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

export async function handleNzdCorridors(): Promise<string> {
  const source = hasXeCredentials() ? "Xe" : "Frankfurter/ECB";
  const lines: string[] = [`NZD corridors (${source})`];

  if (hasXeCredentials()) {
    const result = await convertFrom("NZD", NZD_PAIRS, 1);
    lines.push(`Timestamp: ${result.timestamp}`, "");
    for (const pair of result.to) {
      lines.push(`NZD/${pair.quotecurrency.padEnd(3)}: ${pair.mid.toFixed(6)}`);
    }
  } else {
    const results = await Promise.allSettled(
      NZD_PAIRS.map((to) => ffCurrentRate("NZD", to))
    );
    let date = "";
    for (let i = 0; i < NZD_PAIRS.length; i++) {
      const r = results[i];
      if (r.status === "fulfilled") {
        date = r.value.date;
        lines.push(`NZD/${NZD_PAIRS[i].padEnd(3)}: ${r.value.rate.toFixed(6)}`);
      } else {
        lines.push(`NZD/${NZD_PAIRS[i].padEnd(3)}: N/A`);
      }
    }
    if (date) lines.splice(1, 0, `Date: ${date}`, "");
  }

  return lines.join("\n");
}
