import { convertFrom, listCurrencies } from "../xe-client.js";
import { ffCurrentRate } from "../frankfurter-client.js";

function hasXeCredentials(): boolean {
  return !!(process.env.XE_ACCOUNT_ID && process.env.XE_API_KEY);
}

export const getRateTool = {
  name: "get_rate",
  description:
    "Get the current mid-market exchange rate between two currencies. Uses Xe when credentials are set; falls back to Frankfurter (ECB) for free use.",
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
  if (hasXeCredentials()) {
    const result = await convertFrom(args.from, [args.to], 1);
    const rate = result.to[0]?.mid;
    if (rate === undefined) throw new Error("No rate returned");
    return `1 ${args.from.toUpperCase()} = ${rate.toFixed(6)} ${args.to.toUpperCase()} (Xe, ${result.timestamp})`;
  }
  const { rate, date } = await ffCurrentRate(args.from, args.to);
  return `1 ${args.from.toUpperCase()} = ${rate.toFixed(6)} ${args.to.toUpperCase()} (Frankfurter/ECB, ${date})`;
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
  // Guard against 0 / negative / NaN: amount 0 made the displayed rate
  // `converted / amount` evaluate to NaN. See review 2026-06-29.
  if (!Number.isFinite(args.amount) || args.amount <= 0) {
    throw new Error("amount must be a positive number");
  }
  if (hasXeCredentials()) {
    const result = await convertFrom(args.from, [args.to], args.amount);
    const converted = result.to[0]?.mid;
    if (converted === undefined) throw new Error("No rate returned");
    return `${args.amount} ${args.from.toUpperCase()} = ${converted.toFixed(4)} ${args.to.toUpperCase()} (rate: ${(converted / args.amount).toFixed(6)}, Xe, ${result.timestamp})`;
  }
  const { rate, date } = await ffCurrentRate(args.from, args.to);
  const converted = args.amount * rate;
  return `${args.amount} ${args.from.toUpperCase()} = ${converted.toFixed(4)} ${args.to.toUpperCase()} (rate: ${rate.toFixed(6)}, Frankfurter/ECB, ${date})`;
}

const COMMON_CURRENCIES: Record<string, string> = {
  NZD: "New Zealand Dollar", USD: "US Dollar", EUR: "Euro", GBP: "British Pound",
  JPY: "Japanese Yen", AUD: "Australian Dollar", CAD: "Canadian Dollar",
  CHF: "Swiss Franc", CNY: "Chinese Yuan", HKD: "Hong Kong Dollar",
  SGD: "Singapore Dollar", SEK: "Swedish Krona", NOK: "Norwegian Krone",
  DKK: "Danish Krone", MXN: "Mexican Peso", BRL: "Brazilian Real",
  INR: "Indian Rupee", KRW: "South Korean Won", ZAR: "South African Rand",
  IDR: "Indonesian Rupiah", THB: "Thai Baht", MYR: "Malaysian Ringgit",
  PHP: "Philippine Peso", AED: "UAE Dirham", SAR: "Saudi Riyal",
  TWD: "Taiwan Dollar", PLN: "Polish Zloty", CZK: "Czech Koruna",
  HUF: "Hungarian Forint", ILS: "Israeli Shekel",
};

export const listCurrenciesTool = {
  name: "list_currencies",
  description: "List currency codes. Returns common currencies without credentials; the full Xe list (~170 currencies) requires Xe credentials.",
  inputSchema: { type: "object", properties: {} },
};

export async function handleListCurrencies(): Promise<string> {
  if (!hasXeCredentials()) {
    const lines = Object.entries(COMMON_CURRENCIES).map(([iso, name]) => `${iso}: ${name}`);
    return `Common currencies (source: built-in, Xe credentials needed for full list)\n\n${lines.join("\n")}`;
  }
  const result = (await listCurrencies()) as {
    currencies: Array<{ iso: string; currency_name: string }>;
  };
  return result.currencies.map((c) => `${c.iso}: ${c.currency_name}`).join("\n");
}
