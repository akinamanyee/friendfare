import { convert, currencyName, formatISODate, formatLocalDate, formatStamp, moneyTolerance, rateLot, roundMoney } from "@/lib/money";
import type { Settlement } from "@/lib/settle";
import type { Currency, RateBook, Trip } from "@/lib/types";

export type CsvExportResult =
  | { status: "shared" }
  | { status: "cancelled" }
  | { status: "downloaded"; csv: string; filename: string; offerCopy: boolean };

/**
 * Save one CSV. iPhone opens the system share sheet. Android Chrome and
 * computers download the file. If the preview blocks both, the caller can copy the text.
 */
export async function exportTripToCsv(
  trip: Trip,
  settlement: Settlement,
  rates: RateBook,
): Promise<CsvExportResult> {
  const csv = buildCsv(trip, settlement, rates);
  const filename = `${sanitize(trip.name)}-${trip.settleCurrency}.csv`;
  const file = new File([csv], filename, { type: "text/csv" });

  if (prefersShareSheet()) {
    const shared = await shareFile(file);
    if (shared === "shared") return { status: "shared" };
    if (shared === "cancelled") return { status: "cancelled" };
  }

  downloadFile(csv, filename, prefersShareSheet() ? "application/octet-stream" : "text/csv;charset=utf-8");
  return { status: "downloaded", csv, filename, offerCopy: prefersShareSheet() || framed() };
}

async function shareFile(file: File): Promise<"shared" | "cancelled" | "unavailable"> {
  const data = { files: [file] };
  if (!navigator.canShare?.(data)) return "unavailable";
  try {
    await navigator.share(data);
    return "shared";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    return "unavailable";
  }
}

function downloadFile(csv: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([csv], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 2500);
}

function prefersShareSheet(): boolean {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;
  return /Android/i.test(ua) && /; wv\)/.test(ua);
}

function framed(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function buildCsv(trip: Trip, settlement: Settlement, rates: RateBook): string {
  const rateNote =
    rates.source === "yahoo"
      ? `Yahoo Finance${rates.fetchedAt ? ` · ${formatStamp(rates.fetchedAt)}` : ""}`
      : rates.source === "manual"
        ? "Manual"
        : "Estimated";

  const rows: (string | number)[][] = [
    ["Summary"],
    ["Trip", trip.name],
    ["Place", trip.place || "—"],
    ["Start", formatISODate(trip.startDate)],
    ["End", formatISODate(trip.endDate)],
    ["Settle currency", `${currencyName(trip.settleCurrency)} (${trip.settleCurrency})`],
    ["Total spent", settlement.spent],
    ["Bills", trip.expenses.length],
    ["Members", trip.members.map((m) => m.name).join(", ")],
    ["Rates", `${rateNote}${trip.rateBook ? " · locked for this trip" : " · shared rates"}`],
    ["Exported", formatStamp(Date.now())],
    [],
    ["Bills"],
    [
      "Date",
      "Description",
      "Category",
      "Original amount",
      "Currency",
      "Method",
      "Payers",
      "Split among",
      `Converted (${trip.settleCurrency})`,
    ],
    ...trip.expenses.map((exp) => {
      const converted = roundMoney(
        convert(exp.amount, exp.currency, trip.settleCurrency, rates.perUsd),
        trip.settleCurrency,
      );
      const payerNames = exp.payers
        .map((p) => {
          const name = trip.members.find((m) => m.id === p.memberId)?.name ?? "?";
          return `${name} ${p.amount}`;
        })
        .join("; ");
      const splitNames = exp.splitAmong
        .map((id) => trip.members.find((m) => m.id === id)?.name ?? "?")
        .join(", ");
      return [
        formatLocalDate(exp.createdAt),
        exp.description,
        exp.category,
        exp.amount,
        exp.currency,
        exp.method,
        payerNames,
        splitNames,
        converted,
      ];
    }),
    [],
    ["Balances"],
    ["Name", "Paid", "Share", "Net", "Status"],
    ...settlement.balances.map((b) => [b.name, b.paid, b.share, b.net, netStatus(b.net, trip.settleCurrency)]),
    [],
    ["Who pays whom"],
    ["From", "To", "Amount"],
    ...(settlement.transfers.length === 0
      ? [["—", "—", "Nothing to move"]]
      : settlement.transfers.map((t) => [t.fromName, t.toName, t.amount])),
    [],
    ["Rates"],
    ["Currency", "Lot size", `Lot in ${trip.settleCurrency}`, "Per USD"],
    [trip.settleCurrency, 1, 1, rates.perUsd[trip.settleCurrency] ?? 1],
    ...(["JPY", "KRW", "EUR", "USD", "CNY", "HKD"] as Currency[])
      .filter((id) => id !== trip.settleCurrency)
      .map((id) => {
        const lot = rateLot(id, trip.settleCurrency, rates.perUsd);
        return [id, lot.units, roundMoney(lot.amount, trip.settleCurrency), rates.perUsd[id] ?? 0];
      }),
  ];

  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

function csvCell(value: string | number): string {
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function sanitize(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);
  return cleaned || "trip";
}

function netStatus(net: number, currency: Parameters<typeof moneyTolerance>[0]): string {
  const dust = moneyTolerance(currency);
  if (net > dust) return "is owed";
  if (net < -dust) return "owes";
  return "settled";
}
