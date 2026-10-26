import {
  ArrowLeftRight,
  Banknote,
  BedDouble,
  CreditCard,
  Ellipsis,
  Mic,
  ShoppingBag,
  Smartphone,
  Square,
  Ticket,
  TrainFront,
  Utensils,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CURRENCIES,
  absorbRemainder,
  currencyForPlace,
  currencyLabel,
  equalSplit,
  moneyTolerance,
  parseAmountInput,
  placeCurrencies,
} from "@/lib/money";
import { parseUtterance } from "@/lib/parse-expense";
import { SPEECH_LANGS, useSpeech } from "@/lib/use-speech";
import type { Category, Currency, Expense, PayMethod, Trip } from "@/lib/types";
import { Button, Card, Chip, Field, TextArea, TextInput } from "@/components/ui";

const CATEGORIES: { id: Category; label: string; icon: LucideIcon }[] = [
  { id: "food", label: "Food", icon: Utensils },
  { id: "stay", label: "Stay", icon: BedDouble },
  { id: "transit", label: "Transit", icon: TrainFront },
  { id: "tickets", label: "Tickets", icon: Ticket },
  { id: "shopping", label: "Shopping", icon: ShoppingBag },
  { id: "other", label: "Other", icon: Ellipsis },
];

const METHODS: { id: PayMethod; label: string; icon: LucideIcon }[] = [
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "mobile", label: "Mobile pay", icon: Smartphone },
  { id: "transfer", label: "Transfer", icon: ArrowLeftRight },
];

export function categoryMeta(id: Category) {
  return CATEGORIES.find((item) => item.id === id) ?? CATEGORIES[5];
}

export function methodLabel(id: PayMethod) {
  return METHODS.find((item) => item.id === id)?.label ?? id;
}

function stringsFrom(amounts: Record<string, number>): Record<string, string> {
  return Object.fromEntries(Object.entries(amounts).map(([id, amount]) => [id, String(amount)]));
}

export function ExpenseForm({
  trip,
  initial,
  onCancel,
  onSave,
}: {
  trip: Trip;
  initial: Expense | null;
  onCancel: () => void;
  onSave: (expense: Expense | Omit<Expense, "id" | "createdAt">) => void;
}) {
  const [sentence, setSentence] = useState("");
  const [showSentence, setShowSentence] = useState(false);
  const [lang, setLang] = useState("en-US");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [amountText, setAmountText] = useState(initial ? String(initial.amount) : "");
  const [currency, setCurrency] = useState<Currency>(
    initial?.currency ?? currencyForPlace(trip.place) ?? trip.settleCurrency,
  );
  const [method, setMethod] = useState<PayMethod>(initial?.method ?? "cash");
  const [category, setCategory] = useState<Category>(initial?.category ?? "food");
  const [payerIds, setPayerIds] = useState<string[]>(() => {
    if (initial) return initial.payers.map((payer) => payer.memberId);
    const last = [...trip.expenses].sort((a, b) => b.createdAt - a.createdAt)[0];
    const lastPayer = last?.payers[0]?.memberId;
    if (lastPayer && trip.members.some((m) => m.id === lastPayer)) return [lastPayer];
    return trip.members[0] ? [trip.members[0].id] : [];
  });
  const [payerText, setPayerText] = useState<Record<string, string>>(() => {
    if (!initial || initial.payers.length < 2) return {};
    return Object.fromEntries(initial.payers.map((payer) => [payer.memberId, String(payer.amount)]));
  });
  const [splitIds, setSplitIds] = useState<string[]>(initial?.splitAmong ?? trip.members.map((m) => m.id));
  const [formError, setFormError] = useState<string | null>(null);
  const wasListening = useRef(false);

  const speech = useSpeech(lang);

  function applySentence(text: string) {
    const parsed = parseUtterance(text, trip.members);
    if (parsed.description) setDescription(parsed.description);
    if (parsed.amount != null) setAmountText(String(parsed.amount));
    if (parsed.currency) setCurrency(parsed.currency);
    if (parsed.method) setMethod(parsed.method);
    if (parsed.payerIds.length > 0) {
      setPayerIds(parsed.payerIds);
      const amount = parsed.amount ?? parseAmountInput(amountText);
      const nextCurrency = parsed.currency ?? currency;
      if (amount && parsed.payerIds.length > 1) {
        setPayerText(stringsFrom(equalSplit(amount, parsed.payerIds, nextCurrency)));
      }
    }
    if (parsed.splitIds.length > 0) setSplitIds(parsed.splitIds);
  }

  useEffect(() => {
    if (speech.heard) setSentence(speech.heard);
    if (wasListening.current && !speech.listening && speech.heard) applySentence(speech.heard);
    wasListening.current = speech.listening;
    // applySentence closes over the latest field state when listening stops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.heard, speech.listening]);

  function togglePayer(id: string) {
    setPayerIds((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      if (next.length > 1) {
        const amount = parseAmountInput(amountText);
        if (amount) setPayerText(stringsFrom(equalSplit(amount, next, currency)));
      }
      return next;
    });
  }

  function save() {
    const amount = parseAmountInput(amountText);
    const title = description.trim();
    if (!title) {
      setFormError("Say what this was for.");
      return;
    }
    if (amount == null) {
      setFormError("Enter an amount greater than zero.");
      return;
    }
    if (payerIds.length === 0) {
      setFormError("Choose who paid.");
      return;
    }
    if (splitIds.length === 0) {
      setFormError("Choose who shares this bill.");
      return;
    }
    let payers = payerIds.map((id) => ({ memberId: id, amount }));
    if (payerIds.length > 1) {
      payers = payerIds.map((id) => ({
        memberId: id,
        amount: parseAmountInput(payerText[id] ?? "") ?? 0,
      }));
      const sum = payers.reduce((total, payer) => total + payer.amount, 0);
      if (Math.abs(sum - amount) > moneyTolerance(currency)) {
        setFormError(
          `The payments add up to ${sum}, not the bill of ${amount}. Split them evenly or fix the amounts.`,
        );
        return;
      }
    }
    const payload = {
      description: title,
      category,
      amount,
      currency,
      method,
      payers,
      splitAmong: splitIds,
    };
    if (initial) onSave({ ...initial, ...payload });
    else onSave(payload);
  }

  const amount = parseAmountInput(amountText);
  const payerSum =
    payerIds.length > 1
      ? payerIds.reduce((sum, id) => sum + (parseAmountInput(payerText[id] ?? "") ?? 0), 0)
      : amount;
  const remainder = amount != null && payerSum != null ? amount - payerSum : 0;
  const unbalanced = payerIds.length > 1 && amount != null && Math.abs(remainder) > moneyTolerance(currency);
  const places = placeCurrencies(trip.place);
  const currencyHint =
    places.length > 1
      ? "This place uses more than one currency. Pick the one this bill was paid in."
      : !initial && currencyForPlace(trip.place) === currency
        ? `Set from the trip place (${trip.place}). Change it if this bill was in another currency.`
        : undefined;

  return (
    <Card>
      <h2 className="font-display text-2xl font-medium tracking-tight">
        {initial ? "Edit bill" : "Add a bill"}
      </h2>
      <p className="mt-2 text-base leading-relaxed text-muted">
        Fill in the fields below. Or dictate one sentence if that is easier.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        {!showSentence ? (
          <button
            type="button"
            className="self-start text-base font-medium text-primary underline"
            onClick={() => setShowSentence(true)}
          >
            Dictate or type a sentence instead
          </button>
        ) : (
          <Field
            label="Dictate or type one sentence"
            hint='Example: "Hongdae dinner 86000 won cash paid by Mei"'
          >
            <TextArea
              value={sentence}
              onChange={(event) => setSentence(event.target.value)}
              placeholder="Dinner 86 euro, card, Mei paid"
              aria-label="Expense sentence"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="speech-lang">
                Speech language
              </label>
              <select
                id="speech-lang"
                value={lang}
                onChange={(event) => setLang(event.target.value)}
                className="h-12 rounded-md border border-border bg-card px-3 text-base"
              >
                {SPEECH_LANGS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              {speech.listening ? (
                <Button variant="secondary" onClick={speech.stop}>
                  <Square className="size-4" />
                  Stop
                </Button>
              ) : (
                <Button variant="secondary" onClick={speech.start}>
                  <Mic className="size-4" />
                  Dictate
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => applySentence(sentence)}
                disabled={!sentence.trim()}
              >
                Fill fields
              </Button>
              <Button variant="ghost" onClick={() => setShowSentence(false)}>
                Hide
              </Button>
            </div>
            {speech.listening ? (
              <p className="mt-2 text-sm text-muted" aria-live="polite">
                Listening…
              </p>
            ) : null}
            {speech.error ? <p className="mt-2 text-sm text-danger">{speech.error}</p> : null}
          </Field>
        )}

        <Field label="What it was">
          <TextInput
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Dinner, taxi, museum"
            autoComplete="off"
          />
        </Field>

        <Field label="Amount">
          <TextInput
            inputMode="decimal"
            value={amountText}
            onChange={(event) => setAmountText(event.target.value)}
            placeholder="0"
            className="tabular-nums"
          />
        </Field>

        <Field label="Currency" hint={currencyHint}>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Currency">
            {CURRENCIES.map((item) => (
              <Chip
                key={item.id}
                selected={currency === item.id}
                role="radio"
                aria-checked={currency === item.id}
                onClick={() => setCurrency(item.id)}
              >
                {item.label}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Payment method">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Payment method">
            {METHODS.map((item) => {
              const Icon = item.icon;
              return (
                <Chip
                  key={item.id}
                  selected={method === item.id}
                  role="radio"
                  aria-checked={method === item.id}
                  onClick={() => setMethod(item.id)}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Chip>
              );
            })}
          </div>
        </Field>

        <Field label="Category">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((item) => {
              const Icon = item.icon;
              return (
                <Chip key={item.id} selected={category === item.id} onClick={() => setCategory(item.id)}>
                  <Icon className="size-4" />
                  {item.label}
                </Chip>
              );
            })}
          </div>
        </Field>

        <Field label="Who paid" hint="Tap everyone who put money in. One person is the usual case.">
          <div className="flex flex-wrap gap-2">
            {trip.members.map((member) => (
              <Chip
                key={member.id}
                selected={payerIds.includes(member.id)}
                onClick={() => togglePayer(member.id)}
              >
                {member.name}
              </Chip>
            ))}
          </div>
          {payerIds.length > 1 && amount != null ? (
            <div className="mt-3 flex flex-col gap-2">
              {payerIds.map((id) => {
                const member = trip.members.find((item) => item.id === id);
                return (
                  <label key={id} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-sm">{member?.name}</span>
                    <TextInput
                      inputMode="decimal"
                      aria-label={`${member?.name} paid`}
                      value={payerText[id] ?? ""}
                      className="tabular-nums"
                      onChange={(event) =>
                        setPayerText((current) => ({ ...current, [id]: event.target.value }))
                      }
                    />
                  </label>
                );
              })}
              <Button
                variant="ghost"
                className="self-start px-0"
                onClick={() => {
                  if (amount == null) return;
                  setPayerText(stringsFrom(equalSplit(amount, payerIds, currency)));
                }}
              >
                Split the payment evenly
              </Button>
              {unbalanced ? (
                <>
                  <p className="text-sm text-danger">
                    {remainder > 0
                      ? `${currencyLabel(currency)} ${Math.abs(remainder)} still not assigned.`
                      : `That's ${currencyLabel(currency)} ${Math.abs(remainder)} over the bill.`}
                  </p>
                  <Button
                    variant="ghost"
                    className="self-start px-0"
                    onClick={() => {
                      if (amount == null) return;
                      const current = Object.fromEntries(
                        payerIds.map((id) => [id, parseAmountInput(payerText[id] ?? "") ?? 0]),
                      );
                      setPayerText(stringsFrom(absorbRemainder(amount, payerIds, currency, current)));
                    }}
                  >
                    Even it out
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted">Payments match the bill.</p>
              )}
            </div>
          ) : null}
        </Field>

        <Field
          label="Who shares this bill"
          hint={
            splitIds.length === trip.members.length
              ? "Everyone is included. Tap a name to leave them out."
              : "Tap names to add or remove them from this bill."
          }
        >
          <div className="flex flex-wrap gap-2">
            {trip.members.map((member) => (
              <Chip
                key={member.id}
                selected={splitIds.includes(member.id)}
                onClick={() =>
                  setSplitIds((current) =>
                    current.includes(member.id)
                      ? current.filter((id) => id !== member.id)
                      : [...current, member.id],
                  )
                }
              >
                {member.name}
              </Chip>
            ))}
          </div>
        </Field>

        {formError ? <p className="text-sm text-danger">{formError}</p> : null}

        <div className="flex gap-2">
          <Button full onClick={save}>
            Save bill
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
}
