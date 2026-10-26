import { CURRENCY_IDS, SAMPLE_TRIP_ID, type Currency, type Trip } from "@/lib/types";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeShareCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z2-9]/g, "");
}

export function makeShareCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

/** Trip body stored in the cloud. Share metadata stays on the device. */
export function publicTrip(trip: Trip): Trip {
  const copy: Trip = {
    ...trip,
    members: Array.isArray(trip.members) ? trip.members.map((member) => ({ ...member })) : [],
    expenses: Array.isArray(trip.expenses)
      ? trip.expenses.map((expense) => ({
          ...expense,
          payers: Array.isArray(expense?.payers) ? expense.payers.map((payer) => ({ ...payer })) : [],
          splitAmong: Array.isArray(expense?.splitAmong) ? [...expense.splitAmong] : [],
        }))
      : [],
  };
  delete copy.shareCode;
  delete copy.shareVersion;
  if (copy.rateBook?.perUsd) {
    copy.rateBook = { ...copy.rateBook, perUsd: { ...copy.rateBook.perUsd } };
  }
  return copy;
}

export function tripBody(trip: Trip): string {
  return JSON.stringify(publicTrip(trip));
}

export function readTripJson(value: unknown): Trip | null {
  let data = value;
  if (typeof value === "string") {
    try {
      data = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object") return null;
  const trip = data as Trip;
  if (typeof trip.id !== "string" || trip.id.length < 1 || trip.id.length > 80) return null;
  if (trip.id === SAMPLE_TRIP_ID) return null;
  if (typeof trip.name !== "string") return null;
  if (!CURRENCY_IDS.includes(trip.settleCurrency as Currency)) return null;
  if (!Array.isArray(trip.members) || trip.members.length < 2 || trip.members.length > 40) return null;
  if (!Array.isArray(trip.expenses) || trip.expenses.length > 500) return null;
  const cleaned = publicTrip({
    ...trip,
    place: typeof trip.place === "string" ? trip.place : "",
    startDate: typeof trip.startDate === "string" ? trip.startDate : "",
    endDate: typeof trip.endDate === "string" ? trip.endDate : "",
    createdAt: typeof trip.createdAt === "number" ? trip.createdAt : Date.now(),
  });
  if (JSON.stringify(cleaned).length > 200_000) return null;
  return cleaned;
}
