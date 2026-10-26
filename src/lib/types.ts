export const CURRENCY_IDS = ["JPY", "KRW", "EUR", "USD", "CNY", "HKD"] as const;

export type Currency = (typeof CURRENCY_IDS)[number];

export type PayMethod = "cash" | "card" | "mobile" | "transfer";

export type Category = "food" | "stay" | "transit" | "tickets" | "shopping" | "other";

export type Member = {
  id: string;
  name: string;
};

export type Payer = {
  memberId: string;
  amount: number;
};

export type Expense = {
  id: string;
  description: string;
  category: Category;
  amount: number;
  currency: Currency;
  method: PayMethod;
  payers: Payer[];
  splitAmong: string[];
  createdAt: number;
};

export type Trip = {
  id: string;
  name: string;
  place: string;
  startDate: string;
  endDate: string;
  settleCurrency: Currency;
  members: Member[];
  expenses: Expense[];
  createdAt: number;
  /** Frozen copy of the rates used to settle this trip. Absent means the shared book. */
  rateBook?: RateBook;
};

export type RateSource = "yahoo" | "manual" | "estimate";

export type RateBook = {
  perUsd: Record<Currency, number>;
  fetchedAt: number | null;
  source: RateSource;
};

export type NewExpense = Omit<Expense, "id" | "createdAt">;
