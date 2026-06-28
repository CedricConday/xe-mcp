const BASE = "https://api.frankfurter.app";

interface FrankfurterLatest {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

interface FrankfurterSeries {
  amount: number;
  base: string;
  start_date: string;
  end_date: string;
  rates: Record<string, Record<string, number>>;
}

async function ffFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Frankfurter ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export async function ffCurrentRate(from: string, to: string): Promise<{ rate: number; date: string }> {
  const data = await ffFetch<FrankfurterLatest>(
    `${BASE}/latest?from=${from.toUpperCase()}&to=${to.toUpperCase()}`
  );
  const rate = data.rates[to.toUpperCase()];
  if (rate === undefined) throw new Error(`No rate for ${to}`);
  return { rate, date: data.date };
}

export async function ffHistoricalRate(
  from: string,
  to: string,
  date: string
): Promise<number | null> {
  try {
    const data = await ffFetch<FrankfurterLatest>(
      `${BASE}/${date}?from=${from.toUpperCase()}&to=${to.toUpperCase()}`
    );
    return data.rates[to.toUpperCase()] ?? null;
  } catch {
    return null;
  }
}

export async function ffHistoricalSeries(
  from: string,
  to: string,
  startDate: string,
  endDate: string
): Promise<Array<{ date: string; rate: number }>> {
  const data = await ffFetch<FrankfurterSeries>(
    `${BASE}/${startDate}..${endDate}?from=${from.toUpperCase()}&to=${to.toUpperCase()}`
  );
  return Object.entries(data.rates)
    .map(([date, rates]) => ({ date, rate: rates[to.toUpperCase()] }))
    .filter((r) => r.rate !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date));
}
