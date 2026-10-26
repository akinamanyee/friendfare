import { createServerFn } from "@tanstack/react-start";
import { YAHOO_QUOTE } from "@/lib/money";
import type { Currency } from "@/lib/types";

export type YahooRates = {
  perUsd: Record<Currency, number>;
  fetchedAt: number;
};

async function yahooPrice(symbol: string): Promise<number> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Wayfare/1.0",
    },
  });
  if (!res.ok) {
    throw new Error(`Yahoo Finance returned ${res.status} for ${symbol}`);
  }
  const json = (await res.json()) as {
    chart?: {
      result?: Array<{ meta?: { regularMarketPrice?: number } }>;
      error?: { description?: string };
    };
  };
  const price = json.chart?.result?.[0]?.meta?.regularMarketPrice;
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    throw new Error(json.chart?.error?.description || `Yahoo Finance had no price for ${symbol}`);
  }
  return price;
}

export const fetchYahooRates = createServerFn({ method: "GET" }).handler(async (): Promise<YahooRates> => {
  const pairs = await Promise.all(
    (Object.entries(YAHOO_QUOTE) as [Exclude<Currency, "USD">, string][]).map(async ([currency, symbol]) => {
      const price = await yahooPrice(symbol);
      return [currency, price] as const;
    }),
  );
  const perUsd: Record<Currency, number> = { USD: 1, JPY: 0, KRW: 0, EUR: 0, CNY: 0, HKD: 0 };
  for (const [currency, price] of pairs) perUsd[currency] = price;
  return { perUsd, fetchedAt: Date.now() };
});
