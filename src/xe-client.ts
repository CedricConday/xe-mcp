const XE_BASE = "https://xecdapi.xe.com/v1";

export interface XeRate {
  from: string;
  to: string;
  mid: number;
  timestamp: string;
}

export interface XeConvertResult {
  from: string;
  amount: number;
  to: Array<{ quotecurrency: string; mid: number }>;
  timestamp: string;
}

export interface XeHistoricRate {
  from: string;
  amount: number;
  to: Array<{ quotecurrency: string; mid: number }>;
  timestamp: string;
}

function authHeader(): string {
  const id = process.env.XE_ACCOUNT_ID;
  const key = process.env.XE_API_KEY;
  if (!id || !key) throw new Error("XE_ACCOUNT_ID and XE_API_KEY must be set");
  return "Basic " + Buffer.from(`${id}:${key}`).toString("base64");
}

async function xeFetch(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`${XE_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: { Authorization: authHeader() },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Xe API ${res.status}: ${body}`);
  }
  return res.json();
}

export async function convertFrom(
  from: string,
  to: string[],
  amount = 1
): Promise<XeConvertResult> {
  return xeFetch("convert_from.json", {
    from: from.toUpperCase(),
    to: to.map((c) => c.toUpperCase()).join(","),
    amount: String(amount),
    obsolete: "false",
    inverse: "false",
  }) as Promise<XeConvertResult>;
}

export async function historicRate(
  from: string,
  to: string,
  date: string,
  amount = 1
): Promise<XeHistoricRate> {
  return xeFetch("historic_rate.json", {
    from: from.toUpperCase(),
    to: to.toUpperCase(),
    amount: String(amount),
    date,
    obsolete: "false",
    inverse: "false",
  }) as Promise<XeHistoricRate>;
}

export async function listCurrencies(): Promise<unknown> {
  return xeFetch("currencies.json", { obsolete: "false" });
}

export function isoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
