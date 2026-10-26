import { parseAmountInput } from "@/lib/money";
import type { Currency, Member, PayMethod } from "@/lib/types";

export type ParsedExpense = {
  description: string;
  amount: number | null;
  currency: Currency | null;
  method: PayMethod | null;
  payerIds: string[];
  splitIds: string[];
};

const CURRENCY_RULES: { currency: Currency; re: RegExp }[] = [
  { currency: "JPY", re: /日元|日圓|円|\bJPY\b|\byen\b/i },
  { currency: "KRW", re: /韩元|韓元|원|\bKRW\b|\bwon\b/i },
  { currency: "EUR", re: /欧元|歐元|\bEUR\b|\beuros?\b|€/i },
  { currency: "CNY", re: /人民币|人民幣|\bRMB\b|\bCNY\b|CN¥|\byuan\b|\brenminbi\b/i },
  { currency: "HKD", re: /港元|港幣|港币|\bHKD\b|\bHK\$|hong kong dollar/i },
  { currency: "USD", re: /美元|美金|\bUSD\b|\bdollars?\b|(?<!HK)\$/i },
];

const METHOD_RULES: { method: PayMethod; re: RegExp }[] = [
  {
    method: "mobile",
    re: /支付宝|支付寶|微信|카카오|페이|paypay|alipay|wechat|weixin|kakao|apple pay|google pay|mobile pay|手机|手機/i,
  },
  { method: "transfer", re: /转账|轉帳|송금|이체|\bwire\b|bank transfer|\btransfer\b/i },
  { method: "card", re: /信用卡|刷卡|카드|\bcredit\b|\bdebit\b|\bcard\b|\bvisa\b|\bmastercard\b/i },
  { method: "cash", re: /现金|現金|현금|\bcash\b/i },
];

function firstMatch<T extends string>(text: string, rules: { re: RegExp; [k: string]: unknown }[], key: string): T | null {
  for (const rule of rules) {
    if (rule.re.test(text)) return rule[key] as T;
  }
  return null;
}

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripOnce(text: string, re: RegExp): string {
  return text.replace(re, " ");
}

function memberIdsIn(text: string, members: Member[]): string[] {
  const found: string[] = [];
  let rest = text.toLowerCase();
  const sorted = [...members].sort((a, b) => b.name.length - a.name.length);
  for (const member of sorted) {
    const name = member.name.trim().toLowerCase();
    if (name.length < 1) continue;
    if (rest.includes(name)) {
      found.push(member.id);
      rest = rest.replace(name, " ");
    }
  }
  return found;
}

export function parseUtterance(text: string, members: Member[]): ParsedExpense {
  const source = text.trim();
  const amountMatch = source.match(/(\d{1,3}(?:[ ,]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)/);
  const amount = amountMatch ? parseAmountInput(amountMatch[1]) : null;
  const currency = firstMatch<Currency>(source, CURRENCY_RULES, "currency");
  const method = firstMatch<PayMethod>(source, METHOD_RULES, "method");

  const paidBy = source.match(/(?:paid by|payed by|covered by|由)\s+(.+)$/i);
  const someonePaid = source.match(/^(.+?)\s+paid\b/i);
  let payerIds: string[] = [];
  if (paidBy) payerIds = memberIdsIn(paidBy[1], members);
  else if (someonePaid) payerIds = memberIdsIn(someonePaid[1], members);
  else if (/paid|付|냈다/i.test(source)) payerIds = memberIdsIn(source, members);

  const splitClause = source.match(/(?:split (?:with|between|among)|shared by|分给|分給)\s+(.+)$/i);
  const splitIds = splitClause ? memberIdsIn(splitClause[1], members) : [];

  let description = source;
  if (amountMatch) description = stripOnce(description, new RegExp(escapeRe(amountMatch[1])));
  for (const rule of CURRENCY_RULES) description = stripOnce(description, rule.re);
  for (const rule of METHOD_RULES) description = stripOnce(description, rule.re);
  description = description
    .replace(/(?:paid by|payed by|covered by|由)\s+.+$/i, " ")
    .replace(/(?:split (?:with|between|among)|shared by|分给|分給)\s+.+$/i, " ")
    .replace(/\bpaid\b/gi, " ");
  for (const member of members) {
    if (!payerIds.includes(member.id) && !splitIds.includes(member.id)) continue;
    description = description.replace(new RegExp(escapeRe(member.name), "ig"), " ");
  }
  description = description
    .replace(/[$,€¥₩]|HK\$|CN¥/g, " ")
    .replace(/(?:\s*[,.]+\s*)+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    description,
    amount,
    currency,
    method,
    payerIds,
    splitIds,
  };
}
