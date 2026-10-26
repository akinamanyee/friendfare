import type { Currency } from "@/lib/types";

export const CURRENCIES: { id: Currency; label: string; name: string; symbol: string }[] = [
  { id: "JPY", label: "Yen", name: "Japanese yen", symbol: "¥" },
  { id: "KRW", label: "Won", name: "Korean won", symbol: "₩" },
  { id: "EUR", label: "Euro", name: "Euro", symbol: "€" },
  { id: "USD", label: "Dollar", name: "US dollar", symbol: "$" },
  { id: "CNY", label: "RMB", name: "RMB", symbol: "CN¥" },
  { id: "HKD", label: "HK$", name: "Hong Kong dollar", symbol: "HK$" },
];

export const YAHOO_QUOTE: Record<Exclude<Currency, "USD">, string> = {
  JPY: "JPY=X",
  KRW: "KRW=X",
  EUR: "EUR=X",
  CNY: "USDCNY=X",
  HKD: "HKD=X",
};

export const ESTIMATE_PER_USD: Record<Currency, number> = {
  USD: 1,
  JPY: 156.8,
  KRW: 1324,
  EUR: 0.8925,
  CNY: 6.67,
  HKD: 7.78,
};

const PLACE_CURRENCY: { re: RegExp; currency: Currency }[] = [
  { re: /seoul|busan|jeju|korea|한국|서울/i, currency: "KRW" },
  { re: /tokyo|osaka|kyoto|japan|東京|大阪|京都|일본|日本/i, currency: "JPY" },
  { re: /paris|rome|berlin|madrid|europe|france|italy|germany|spain|euro/i, currency: "EUR" },
  { re: /hong kong|hongkong|hk\b|香港/i, currency: "HKD" },
  { re: /beijing|shanghai|china|北京|上海|中国|中國/i, currency: "CNY" },
  { re: /new york|usa|united states|america/i, currency: "USD" },
];

export function placeCurrencies(place: string): Currency[] {
  const seen = new Set<Currency>();
  const out: Currency[] = [];
  for (const rule of PLACE_CURRENCY) {
    if (!rule.re.test(place) || seen.has(rule.currency)) continue;
    seen.add(rule.currency);
    out.push(rule.currency);
  }
  return out;
}

export function currencyForPlace(place: string): Currency | null {
  const hits = placeCurrencies(place);
  return hits.length === 1 ? hits[0] : null;
}

export function currencyName(id: Currency): string {
  return CURRENCIES.find((c) => c.id === id)?.name ?? id;
}

export function currencyLabel(id: Currency): string {
  return CURRENCIES.find((c) => c.id === id)?.label ?? id;
}

export function decimals(currency: Currency): number {
  return currency === "JPY" || currency === "KRW" ? 0 : 2;
}

export function moneyTolerance(currency: Currency): number {
  return currency === "JPY" || currency === "KRW" ? 1 : 0.01;
}

export function roundMoney(amount: number, currency: Currency): number {
  const factor = 10 ** decimals(currency);
  return Math.round(amount * factor) / factor;
}

export function formatMoney(amount: number, currency: Currency): string {
  const rounded = roundMoney(amount, currency);
  const num = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals(currency),
    maximumFractionDigits: decimals(currency),
  }).format(Math.abs(rounded));
  const sign = rounded < 0 ? "−" : "";
  const symbol = CURRENCIES.find((c) => c.id === currency)?.symbol ?? "";
  return `${sign}${symbol}${num}`;
}

export function formatRate(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 100) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
  }
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n);
}

export function parseAmountInput(text: string): number | null {
  const trimmed = text.trim().replace(/\s/g, "");
  if (!trimmed) return null;
  let normalized = trimmed;
  if (trimmed.includes(",") && trimmed.includes(".")) normalized = trimmed.replace(/,/g, "");
  else if (trimmed.includes(",")) normalized = trimmed.replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

export function convert(amount: number, from: Currency, to: Currency, perUsd: Record<Currency, number>): number {
  const fromRate = perUsd[from];
  const toRate = perUsd[to];
  if (!fromRate || !toRate) return 0;
  if (from === to) return amount;
  return (amount / fromRate) * toRate;
}

export function rateLot(from: Currency, to: Currency, perUsd: Record<Currency, number>): { units: number; amount: number } {
  const one = convert(1, from, to, perUsd);
  let units = 1;
  if (one > 0 && one < 0.01) units = 1000;
  else if (one > 0 && one < 0.1) units = 100;
  else if (one > 0 && one < 1) units = 10;
  return { units, amount: one * units };
}

export function perUsdFromDisplayed(from: Currency, to: Currency, units: number, amount: number, perUsd: Record<Currency, number>): { currency: Exclude<Currency, "USD">; perUsd: number } | null {
  if (from === to || !(amount > 0) || !(units > 0)) return null;
  if (from === "USD") {
    if (to === "USD") return null;
    return { currency: to, perUsd: amount / units };
  }
  const toRate = perUsd[to];
  if (!toRate) return null;
  return { currency: from, perUsd: (units * toRate) / amount };
}

export function yahooQuoteUrl(currency: Exclude<Currency, "USD">): string {
  return `https://finance.yahoo.com/quote/${YAHOO_QUOTE[currency]}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatDay(ts: number): string {
  const d = new Date(ts);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatISODate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatLocalDate(ts: number): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return formatISODate(iso);
}

export function formatStamp(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hh}:${mm} UTC`;
}

export function equalSplit(amount: number, ids: string[], currency: Currency): Record<string, number> {
  const factor = 10 ** decimals(currency);
  const total = Math.round(amount * factor);
  if (ids.length === 0 || total <= 0) return {};
  const base = Math.floor(total / ids.length);
  let remainder = total - base * ids.length;
  const out: Record<string, number> = {};
  for (const id of ids) {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    out[id] = (base + extra) / factor;
  }
  return out;
}

export function absorbRemainder(amount: number, ids: string[], currency: Currency, current: Record<string, number>): Record<string, number> {
  if (ids.length === 0) return {};
  const factor = 10 ** decimals(currency);
  const total = Math.round(amount * factor);
  if (total <= 0) return {};
  const last = ids[ids.length - 1];
  const out: Record<string, number> = {};
  let used = 0;
  for (const id of ids.slice(0, -1)) {
    const units = Math.max(0, Math.round((current[id] ?? 0) * factor));
    out[id] = units / factor;
    used += units;
  }
  const rest = total - used;
  if (rest < 0) return equalSplit(amount, ids, currency);
  out[last] = rest / factor;
  return out;
}
