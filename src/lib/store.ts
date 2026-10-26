import { create } from "zustand";
import { persist } from "zustand/middleware";
import { fetchYahooRates } from "@/lib/fx";
import { ESTIMATE_PER_USD } from "@/lib/money";
import { SAMPLE_TRIP_ID, type Currency, type Expense, type NewExpense, type RateBook, type Trip } from "@/lib/types";

export { SAMPLE_TRIP_ID };

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const day = 24 * 60 * 60 * 1000;
const oct18 = Date.UTC(2026, 9, 18, 12, 0, 0);

export function sampleTrip(): Trip {
  return {
    id: SAMPLE_TRIP_ID,
    name: "Seoul & Osaka",
    place: "Seoul, then Osaka",
    startDate: "2026-10-18",
    endDate: "2026-10-21",
    settleCurrency: "HKD",
    createdAt: oct18,
    members: [
      { id: "mei", name: "Mei" },
      { id: "ken", name: "Ken" },
      { id: "noor", name: "Noor" },
    ],
    expenses: [
      {
        id: "exp-dinner",
        description: "Hongdae dinner",
        category: "food",
        amount: 86000,
        currency: "KRW",
        method: "cash",
        payers: [{ memberId: "mei", amount: 86000 }],
        splitAmong: ["mei", "ken", "noor"],
        createdAt: oct18,
      },
      {
        id: "exp-train",
        description: "Shinkansen to Osaka",
        category: "transit",
        amount: 4200,
        currency: "JPY",
        method: "card",
        payers: [{ memberId: "ken", amount: 4200 }],
        splitAmong: ["mei", "ken", "noor"],
        createdAt: oct18 + day,
      },
      {
        id: "exp-tickets",
        description: "TeamLab tickets",
        category: "tickets",
        amount: 45,
        currency: "EUR",
        method: "card",
        payers: [{ memberId: "noor", amount: 45 }],
        splitAmong: ["mei", "noor"],
        createdAt: oct18 + day * 2,
      },
      {
        id: "exp-store",
        description: "Convenience store run",
        category: "shopping",
        amount: 120,
        currency: "CNY",
        method: "mobile",
        payers: [
          { memberId: "mei", amount: 60 },
          { memberId: "ken", amount: 60 },
        ],
        splitAmong: ["mei", "ken", "noor"],
        createdAt: oct18 + day * 2 + 60 * 60 * 1000,
      },
    ],
  };
}

function estimateBook(): RateBook {
  return {
    perUsd: { ...ESTIMATE_PER_USD },
    fetchedAt: null,
    source: "estimate",
  };
}

type TripDraft = {
  name: string;
  place: string;
  settleCurrency: Currency;
  memberNames: string[];
  startDate: string;
  endDate: string;
};

type WayfareState = {
  trips: Trip[];
  rates: RateBook;
  rateStatus: "idle" | "loading";
  rateError: string | null;
  addTrip: (input: TripDraft) => string;
  updateTrip: (
    id: string,
    patch: Partial<Pick<Trip, "name" | "place" | "settleCurrency" | "startDate" | "endDate">>,
  ) => void;
  deleteTrip: (id: string) => void;
  addMember: (tripId: string, name: string) => string | null;
  removeMember: (tripId: string, memberId: string) => string | null;
  addExpense: (tripId: string, expense: NewExpense) => void;
  updateExpense: (tripId: string, expense: Expense) => void;
  deleteExpense: (tripId: string, expenseId: string) => void;
  setManualRate: (currency: Exclude<Currency, "USD">, value: number) => void;
  refreshRates: (opts?: { force?: boolean }) => Promise<void>;
  lockRates: (tripId: string) => void;
  unlockRates: (tripId: string) => void;
  setTripRate: (tripId: string, currency: Exclude<Currency, "USD">, value: number) => void;
  refreshTripRates: (tripId: string) => Promise<void>;
  restoreSample: () => void;
  adoptSharedTrip: (trip: Trip) => void;
  markShare: (id: string, code: string, version: number) => void;
  clearShare: (id: string) => void;
};

function mapTrip(trips: Trip[], id: string, fn: (trip: Trip) => Trip): Trip[] {
  return trips.map((trip) => (trip.id === id ? fn(trip) : trip));
}

export const useWayfare = create<WayfareState>()(
  persist(
    (set, get) => ({
      trips: [sampleTrip()],
      rates: estimateBook(),
      rateStatus: "idle",
      rateError: null,
      addTrip: (input) => {
        const id = uid();
        const members = input.memberNames
          .map((name) => name.trim())
          .filter(Boolean)
          .map((name) => ({ id: uid(), name }));
        const trip: Trip = {
          id,
          name: input.name.trim(),
          place: input.place.trim(),
          startDate: input.startDate,
          endDate: input.endDate,
          settleCurrency: input.settleCurrency,
          members,
          expenses: [],
          createdAt: Date.now(),
        };
        set((state) => ({ trips: [trip, ...state.trips] }));
        return id;
      },
      updateTrip: (id, patch) => {
        set((state) => ({
          trips: mapTrip(state.trips, id, (trip) => ({
            ...trip,
            ...patch,
            name: patch.name !== undefined ? patch.name : trip.name,
            place: patch.place !== undefined ? patch.place : trip.place,
          })),
        }));
      },
      deleteTrip: (id) => set((state) => ({ trips: state.trips.filter((trip) => trip.id !== id) })),
      addMember: (tripId, name) => {
        const trimmed = name.trim();
        if (!trimmed) return "Type a name first.";
        const trip = get().trips.find((item) => item.id === tripId);
        if (!trip) return "Trip not found.";
        if (trip.members.some((member) => member.name.toLowerCase() === trimmed.toLowerCase())) {
          return "That name is already on the trip.";
        }
        set((state) => ({
          trips: mapTrip(state.trips, tripId, (current) => ({
            ...current,
            members: [...current.members, { id: uid(), name: trimmed }],
          })),
        }));
        return null;
      },
      removeMember: (tripId, memberId) => {
        const trip = get().trips.find((item) => item.id === tripId);
        if (!trip) return "Trip not found.";
        if (trip.members.length <= 2) return "Keep at least two people on the trip.";
        const used = trip.expenses.some(
          (expense) =>
            expense.splitAmong.includes(memberId) ||
            expense.payers.some((payer) => payer.memberId === memberId),
        );
        if (used) return "Remove their bills first. They are already on a payment.";
        set((state) => ({
          trips: mapTrip(state.trips, tripId, (current) => ({
            ...current,
            members: current.members.filter((member) => member.id !== memberId),
          })),
        }));
        return null;
      },
      addExpense: (tripId, expense) => {
        const next: Expense = { ...expense, id: uid(), createdAt: Date.now() };
        set((state) => ({
          trips: mapTrip(state.trips, tripId, (trip) => ({
            ...trip,
            expenses: [...trip.expenses, next],
          })),
        }));
      },
      updateExpense: (tripId, expense) => {
        set((state) => ({
          trips: mapTrip(state.trips, tripId, (trip) => ({
            ...trip,
            expenses: trip.expenses.map((item) => (item.id === expense.id ? expense : item)),
          })),
        }));
      },
      deleteExpense: (tripId, expenseId) => {
        set((state) => ({
          trips: mapTrip(state.trips, tripId, (trip) => ({
            ...trip,
            expenses: trip.expenses.filter((item) => item.id !== expenseId),
          })),
        }));
      },
      setManualRate: (currency, value) => {
        if (!Number.isFinite(value) || value <= 0) return;
        set((state) => ({
          rates: {
            ...state.rates,
            source: "manual",
            perUsd: { ...state.rates.perUsd, [currency]: value },
          },
        }));
      },
      refreshRates: async (opts) => {
        const { rateStatus, rates } = get();
        if (rateStatus === "loading") return;
        if (rates.source === "manual" && !opts?.force) return;
        set({ rateStatus: "loading", rateError: null });
        try {
          const data = await fetchYahooRates();
          set({
            rates: { perUsd: data.perUsd, fetchedAt: data.fetchedAt, source: "yahoo" },
            rateStatus: "idle",
            rateError: null,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Couldn't reach Yahoo Finance.";
          set({ rateStatus: "idle", rateError: message });
        }
      },
      lockRates: (tripId) => {
        const book = get().rates;
        set((state) => ({
          trips: mapTrip(state.trips, tripId, (trip) => ({
            ...trip,
            rateBook: {
              perUsd: { ...book.perUsd },
              fetchedAt: book.fetchedAt,
              source: book.source,
            },
          })),
        }));
      },
      unlockRates: (tripId) => {
        set((state) => ({
          trips: mapTrip(state.trips, tripId, (trip) => {
            const next = { ...trip };
            delete next.rateBook;
            return next;
          }),
        }));
      },
      setTripRate: (tripId, currency, value) => {
        if (!Number.isFinite(value) || value <= 0) return;
        set((state) => ({
          trips: mapTrip(state.trips, tripId, (trip) => {
            const base = trip.rateBook ?? state.rates;
            return {
              ...trip,
              rateBook: {
                perUsd: { ...base.perUsd, [currency]: value },
                fetchedAt: base.fetchedAt,
                source: "manual",
              },
            };
          }),
        }));
      },
      refreshTripRates: async (tripId) => {
        if (get().rateStatus === "loading") return;
        set({ rateStatus: "loading", rateError: null });
        try {
          const data = await fetchYahooRates();
          const book: RateBook = { perUsd: data.perUsd, fetchedAt: data.fetchedAt, source: "yahoo" };
          set((state) => {
            const trip = state.trips.find((item) => item.id === tripId);
            if (!trip?.rateBook) {
              return { rateStatus: "idle", rateError: null };
            }
            return {
              rateStatus: "idle",
              rateError: null,
              trips: mapTrip(state.trips, tripId, (current) => ({ ...current, rateBook: book })),
            };
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Couldn't reach Yahoo Finance.";
          set({ rateStatus: "idle", rateError: message });
        }
      },
      restoreSample: () => {
        if (get().trips.some((trip) => trip.id === SAMPLE_TRIP_ID)) return;
        set((state) => ({ trips: [sampleTrip(), ...state.trips] }));
      },
      adoptSharedTrip: (trip) => {
        set((state) => {
          const exists = state.trips.some((item) => item.id === trip.id);
          return {
            trips: exists ? state.trips.map((item) => (item.id === trip.id ? trip : item)) : [trip, ...state.trips],
          };
        });
      },
      markShare: (id, code, version) => {
        set((state) => ({
          trips: mapTrip(state.trips, id, (trip) => ({ ...trip, shareCode: code, shareVersion: version })),
        }));
      },
      clearShare: (id) => {
        set((state) => ({
          trips: mapTrip(state.trips, id, (trip) => {
            const next = { ...trip };
            delete next.shareCode;
            delete next.shareVersion;
            return next;
          }),
        }));
      },
    }),
    {
      name: "wayfare-v1",
      skipHydration: true,
      partialize: (state) => ({ trips: state.trips, rates: state.rates }),
    },
  ),
);
