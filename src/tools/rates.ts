import { convertFrom, listCurrencies } from "../xe-client.js";

export const getRateTool = {
  name: "get_rate",
  description:
    "Get the current mid-market exchange rate between two currencies. Uses Xe's live rate data.",
  inputSchema: {
    type: "object",
    properties: {
      from: { type: "string", description: "Base currency code (e.g. NZD, USD, EUR)" },
      to: { type: "string", description: "Target currency code" },
    },
    required: ["from", "to"],
  },
};

export async function handleGetRate(args: { from: string; to: string }): Promise<string> {
  const result = await convertFrom(args.from, [args.to], 1);
  const rate = result.to[0]?.mid;
  if (rate === undefined) throw new Error("No rate returned");
  return `1 ${args.from.toUpperCase()} = ${rate.toFixed(6)} ${args.to.toUpperCase()} (as of ${result.timestamp})`;
}

export const convertTool = {
  name: "convert",
  description: "Convert an amount from one currency to another at the current mid-market rate.",
  inputSchema: {
    type: "object",
    properties: {
      from: { type: "string", description: "Source currency code" },
      to: { type: "string", description: "Target currency code" },
      amount: { type: "number", description: "Amount to convert" },
    },
    required: ["from", "to", "amount"],
  },
};

export async function handleConvert(args: {
  from: string;
  to: string;
  amount: number;
}): Promise<string> {
  const result = await convertFrom(args.from, [args.to], args.amount);
  const rate = result.to[0]?.mid;
  if (rate === undefined) throw new Error("No rate returned");
  return `${args.amount} ${args.from.toUpperCase()} = ${rate.toFixed(4)} ${args.to.toUpperCase()} (rate: ${(rate / args.amount).toFixed(6)}, timestamp: ${result.timestamp})`;
}

export const listCurrenciesTool = {
  name: "list_currencies",
  description: "List all currency codes supported by Xe.",
  inputSchema: { type: "object", properties: {} },
};

export async function handleListCurrencies(): Promise<string> {
  const result = (await listCurrencies()) as {
    currencies: Array<{ iso: string; currency_name: string }>;
  };
  const lines = result.currencies
    .map((c) => `${c.iso}: ${c.currency_name}`)
    .join("\n");
  return lines;
}
