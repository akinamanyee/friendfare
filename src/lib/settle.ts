import { convert, moneyTolerance, roundMoney } from "@/lib/money";
import type { Currency, Trip } from "@/lib/types";

export type Balance = {
  memberId: string;
  name: string;
  paid: number;
  share: number;
  net: number;
};

export type Transfer = {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
};

export type Settlement = {
  currency: Currency;
  spent: number;
  balances: Balance[];
  transfers: Transfer[];
};

export function settle(trip: Trip, perUsd: Record<Currency, number>): Settlement {
  const currency = trip.settleCurrency;
  const paid: Record<string, number> = {};
  const share: Record<string, number> = {};
  for (const member of trip.members) {
    paid[member.id] = 0;
    share[member.id] = 0;
  }

  let spent = 0;
  for (const expense of trip.expenses) {
    const total = convert(expense.amount, expense.currency, currency, perUsd);
    spent += total;
    const people = expense.splitAmong.filter((id) => share[id] != null);
    if (people.length > 0) {
      const each = total / people.length;
      for (const id of people) share[id] += each;
    }
    for (const payer of expense.payers) {
      if (paid[payer.memberId] == null) continue;
      paid[payer.memberId] += convert(payer.amount, expense.currency, currency, perUsd);
    }
  }

  const nameOf = (id: string) => trip.members.find((m) => m.id === id)?.name ?? "Someone";

  const balances: Balance[] = trip.members.map((member) => ({
    memberId: member.id,
    name: member.name,
    paid: roundMoney(paid[member.id] ?? 0, currency),
    share: roundMoney(share[member.id] ?? 0, currency),
    net: 0,
  }));

  for (const balance of balances) {
    balance.net = roundMoney(balance.paid - balance.share, currency);
  }

  const drift = roundMoney(balances.reduce((sum, balance) => sum + balance.net, 0), currency);
  if (drift !== 0 && balances.length > 0) {
    const target = balances.reduce((best, balance) => Math.abs(balance.net) > Math.abs(best.net) ? balance : best);
    target.net = roundMoney(target.net - drift, currency);
  }

  const dust = moneyTolerance(currency);
  const debtors = balances.filter((b) => b.net < -dust).map((b) => ({ id: b.memberId, name: b.name, left: -b.net })).sort((a, b) => b.left - a.left);
  const creditors = balances.filter((b) => b.net > dust).map((b) => ({ id: b.memberId, name: b.name, left: b.net })).sort((a, b) => b.left - a.left);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].left, creditors[j].left);
    const amount = roundMoney(pay, currency);
    if (amount > 0) {
      transfers.push({ fromId: debtors[i].id, fromName: debtors[i].name, toId: creditors[j].id, toName: creditors[j].name, amount });
    }
    debtors[i].left -= pay;
    creditors[j].left -= pay;
    if (debtors[i].left <= dust) i += 1;
    if (creditors[j].left <= dust) j += 1;
  }

  return { currency, spent: roundMoney(spent, currency), balances, transfers };
}
