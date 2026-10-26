import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Download, Plus, RefreshCw, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ExpenseForm, categoryMeta, methodLabel } from "@/components/expense-form";
import { Button, Card, Chip, Field, Shell, TextInput } from "@/components/ui";
import {
  CURRENCIES,
  convert,
  currencyName,
  formatDay,
  formatISODate,
  formatMoney,
  formatStamp,
  perUsdFromDisplayed,
  rateLot,
  roundMoney,
  yahooQuoteUrl,
} from "@/lib/money";
import { exportTripToCsv } from "@/lib/export-trip";
import { settle } from "@/lib/settle";
import { createShare, unshareTrip } from "@/lib/share";
import { SAMPLE_TRIP_ID, useWayfare } from "@/lib/store";
import { useShareSync } from "@/lib/use-share-sync";
import type { Currency, Expense } from "@/lib/types";

export function TripView({ tripId }: { tripId: string }) {
  const trip = useWayfare((s) => s.trips.find((item) => item.id === tripId));
  const rates = useWayfare((s) => s.rates);
  const rateStatus = useWayfare((s) => s.rateStatus);
  const rateError = useWayfare((s) => s.rateError);
  const updateTrip = useWayfare((s) => s.updateTrip);
  const deleteTrip = useWayfare((s) => s.deleteTrip);
  const addMember = useWayfare((s) => s.addMember);
  const removeMember = useWayfare((s) => s.removeMember);
  const addExpense = useWayfare((s) => s.addExpense);
  const updateExpense = useWayfare((s) => s.updateExpense);
  const deleteExpense = useWayfare((s) => s.deleteExpense);
  const refreshRates = useWayfare((s) => s.refreshRates);
  const setManualRate = useWayfare((s) => s.setManualRate);
  const lockRates = useWayfare((s) => s.lockRates);
  const unlockRates = useWayfare((s) => s.unlockRates);
  const setTripRate = useWayfare((s) => s.setTripRate);
  const refreshTripRates = useWayfare((s) => s.refreshTripRates);
  const markShare = useWayfare((s) => s.markShare);
  const clearShare = useWayfare((s) => s.clearShare);
  const navigate = useNavigate();

  const [tab, setTab] = useState<"bills" | "settle" | "rates">("bills");
  const [editing, setEditing] = useState<Expense | null | "new" | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<{ text: string; csv: string } | null>(null);
  async function handleExport() {
    if (!trip || exporting) return;
    setExporting(true);
    setExportNote(null);
    try {
      const book = trip.rateBook ?? rates;
      const result = settle(trip, book.perUsd);
      const saved = await exportTripToCsv(trip, result, book);
      if (saved.status === "cancelled") return;
      if (saved.status === "shared") {
        setExportNote({ text: "Choose Save to Files on the share sheet.", csv: "" });
        return;
      }
      setExportNote({
        text: saved.offerCopy
          ? "If the file did not appear, copy it and paste into Numbers or Sheets."
          : "Download started.",
        csv: saved.offerCopy ? saved.csv : "",
      });
    } catch (err) {
      console.error(err);
      alert("Could not export the trip. Try again.");
    } finally {
      setExporting(false);
    }
  }

  async function copyCsv() {
    if (!exportNote?.csv) return;
    try {
      await navigator.clipboard.writeText(exportNote.csv);
      setExportNote({ text: "Copied. Paste it into a spreadsheet.", csv: exportNote.csv });
    } catch {
      setExportNote({
        text: "Press and hold the text below, then choose Copy.",
        csv: exportNote.csv,
      });
    }
  }

  const [showEdit, setShowEdit] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [memberError, setMemberError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmExpense, setConfirmExpense] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [confirmUnshare, setConfirmUnshare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const { note: shareNote, setNote: setShareNote } = useShareSync(trip, editing !== null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  if (!trip) {
    return (
      <Shell>
        <h1 className="font-display text-3xl font-medium">This trip isn't here</h1>
        <p className="mt-2 text-sm text-muted">It may have been deleted on this device.</p>
        <Link to="/" className="mt-6 inline-flex h-11 items-center text-sm font-medium">
          Back to trips
        </Link>
      </Shell>
    );
  }

  const book = trip.rateBook ?? rates;
  const result = settle(trip, book.perUsd);
  const formOpen = editing !== null;
  const current = trip;
  const isSample = current.id === SAMPLE_TRIP_ID;

  async function startShare() {
    if (isSample || shareBusy) return;
    setShareBusy(true);
    setShareError(null);
    try {
      const created = await createShare({ data: { trip: current } });
      if (!created.ok) {
        setShareError(created.error);
        return;
      }
      markShare(current.id, created.code, created.version);
      setShareOpen(true);
      setCopied(false);
    } catch {
      setShareError("Couldn't share this trip. Your copy is still on this device.");
    } finally {
      setShareBusy(false);
    }
  }

  async function stopSharing() {
    if (!current.shareCode || shareBusy) return;
    setShareBusy(true);
    setShareError(null);
    try {
      const stopped = await unshareTrip({ data: { code: current.shareCode } });
      if (!stopped.ok) {
        setShareError(stopped.error);
        return;
      }
      clearShare(current.id);
      setConfirmUnshare(false);
      setShareOpen(false);
      setShareNote(null);
    } catch {
      setShareError("Couldn't stop sharing. The trip is still on this device.");
    } finally {
      setShareBusy(false);
    }
  }

  async function copyLink() {
    if (!current.shareCode) return;
    const link = `${window.location.origin}/join/${current.shareCode}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setShareError(null);
    } catch {
      setCopied(false);
      setShareError("Select the link and copy it.");
    }
  }

  function saveExpense(expense: Expense | Omit<Expense, "id" | "createdAt">) {
    if ("id" in expense) updateExpense(tripId, expense);
    else addExpense(tripId, expense);
    setEditing(null);
    setTab("bills");
  }

  const days = [...trip.expenses].sort((a, b) => b.createdAt - a.createdAt);
  const grouped = new Map<string, Expense[]>();
  for (const expense of days) {
    const key = formatDay(expense.createdAt);
    const list = grouped.get(key) ?? [];
    list.push(expense);
    grouped.set(key, list);
  }

  return (
    <Shell>
      <Link to="/" className="inline-flex h-11 items-center gap-2 text-sm font-medium text-muted">
        <ArrowLeft className="size-4" />
        Trips
      </Link>

      {formOpen ? (
        <div className="mt-4">
          {shareNote ? <p className="mb-3 text-sm leading-normal text-muted">{shareNote}</p> : null}
          <ExpenseForm
            trip={trip}
            initial={editing === "new" ? null : editing}
            onCancel={() => setEditing(null)}
            onSave={saveExpense}
          />
        </div>
      ) : (
        <>
          <h1 className="mt-2 font-display text-4xl font-medium tracking-tight">{trip.name}</h1>
          <p className="mt-2 text-base leading-relaxed text-muted">
            {[trip.place, trip.startDate ? formatISODate(trip.startDate) : "", trip.endDate ? formatISODate(trip.endDate) : ""]
              .filter(Boolean)
              .join(" · ") || "Add a place from trip details"}
          </p>
          <p className="mt-1 text-base text-muted">
            {trip.members.map((member) => member.name).join(", ")} · totals in {currencyName(trip.settleCurrency)}
            {trip.shareCode ? " · shared" : ""}
          </p>

          <p className="mt-6 font-display text-4xl font-medium tabular-nums tracking-tight">
            {formatMoney(result.spent, trip.settleCurrency)}
          </p>
          <p className="mt-1 text-base text-muted">
            {trip.expenses.length} {trip.expenses.length === 1 ? "bill" : "bills"} converted with{" "}
            {book.source === "yahoo"
              ? "Yahoo Finance"
              : book.source === "manual"
                ? "your rates"
                : "estimated rates"}
            {trip.rateBook ? " · locked for this trip" : ""}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={handleExport}
              disabled={exporting || trip.expenses.length === 0}
            >
              <Download className="size-4" />
              {exporting ? "Preparing…" : "Download CSV"}
            </Button>
            {isSample ? null : (
              <Button
                variant="secondary"
                onClick={() => {
                  setShareError(null);
                  setConfirmUnshare(false);
                  setShareOpen((open) => !open);
                }}
              >
                <Share2 className="size-4" />
                {trip.shareCode ? "Shared" : "Share"}
              </Button>
            )}
          </div>
          {isSample ? (
            <p className="mt-3 text-sm leading-normal text-muted">The sample trip stays on this device.</p>
          ) : null}
          {shareNote ? <p className="mt-3 text-sm leading-normal text-muted">{shareNote}</p> : null}
          {!isSample && shareOpen ? (
            <Card className="mt-3">
              {trip.shareCode ? (
                <>
                  <h2 className="font-display text-2xl font-medium">Shared trip</h2>
                  <p className="mt-2 text-sm leading-normal text-muted">
                    Bills already on this trip went with the code. Anyone with it can add bills. If you both change a bill at the same time, the later save wins.
                  </p>
                  <p className="mt-4 font-display text-3xl font-medium tracking-tight">{trip.shareCode}</p>
                  <p className="mt-2 break-all text-sm text-muted">
                    {origin ? `${origin}/join/${trip.shareCode}` : `Join code ${trip.shareCode}`}
                  </p>
                  {shareError ? <p className="mt-3 text-sm text-danger">{shareError}</p> : null}
                  {confirmUnshare ? (
                    <div className="mt-4 flex flex-col items-start gap-2">
                      <p className="text-sm leading-normal text-muted">
                        Stop sharing? The trip stays on this device. The link stops working.
                      </p>
                      <div className="flex gap-2">
                        <Button variant="danger" onClick={() => void stopSharing()} disabled={shareBusy}>
                          {shareBusy ? "Stopping…" : "Stop sharing"}
                        </Button>
                        <Button variant="ghost" onClick={() => setConfirmUnshare(false)}>
                          Keep
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => void copyLink()}>
                        {copied ? "Copied" : "Copy link"}
                      </Button>
                      <Button variant="ghost" className="text-muted" onClick={() => setConfirmUnshare(true)}>
                        Stop sharing
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h2 className="font-display text-2xl font-medium">Share this trip</h2>
                  <p className="mt-2 text-sm leading-normal text-muted">
                    Bills you've already logged go with the code. Your friend should not type them again. The code is the only key.
                  </p>
                  {shareError ? <p className="mt-3 text-sm text-danger">{shareError}</p> : null}
                  <div className="mt-4 flex gap-2">
                    <Button onClick={() => void startShare()} disabled={shareBusy}>
                      {shareBusy ? "Sharing…" : "Create a code"}
                    </Button>
                    <Button variant="secondary" onClick={() => setShareOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </Card>
          ) : null}
          {exportNote ? (
              <div className="mt-3">
                <p className="text-sm leading-normal text-muted">{exportNote.text}</p>
                {exportNote.csv ? (
                  <>
                    <button
                      type="button"
                      className="mt-2 text-base font-medium text-foreground underline"
                      onClick={() => void copyCsv()}
                    >
                      Copy CSV
                    </button>
                    <textarea
                      readOnly
                      className="mt-2 h-28 w-full rounded-md border border-border bg-background p-3 text-sm"
                      value={exportNote.csv}
                      aria-label="CSV file"
                    />
                  </>
                ) : null}
              </div>
            ) : null}

          <div className="mt-6 grid grid-cols-3 gap-2" role="tablist" aria-label="Trip sections">
            {(
              [
                ["bills", "Bills"],
                ["settle", "Settle"],
                ["rates", "Rates"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={
                  tab === id
                    ? "press h-12 rounded-md bg-primary text-base font-medium text-primary-foreground"
                    : "press h-12 rounded-md border border-border bg-card text-base font-medium text-muted"
                }
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "bills" ? (
            <div className="mt-4 flex flex-col gap-3">
              <Button full onClick={() => setEditing("new")}>
                <Plus className="size-4" />
                Add a bill
              </Button>

              <button
                type="button"
                className="self-start text-sm font-medium text-muted"
                onClick={() => setShowEdit((value) => !value)}
              >
                {showEdit ? "Hide trip details" : "Trip details"}
              </button>
              {showEdit ? (
                <TripEditor
                  tripId={tripId}
                  name={trip.name}
                  place={trip.place}
                  startDate={trip.startDate}
                  endDate={trip.endDate}
                  members={trip.members}
                  memberName={memberName}
                  memberError={memberError}
                  confirmDelete={confirmDelete}
                  shared={Boolean(trip.shareCode)}
                  onName={(value) => updateTrip(tripId, { name: value })}
                  onPlace={(value) => updateTrip(tripId, { place: value })}
                  onStart={(value) => updateTrip(tripId, { startDate: value })}
                  onEnd={(value) => updateTrip(tripId, { endDate: value })}
                  onMemberName={setMemberName}
                  onAddMember={() => {
                    const message = addMember(tripId, memberName);
                    setMemberError(message);
                    if (!message) setMemberName("");
                  }}
                  onRemoveMember={(id) => setMemberError(removeMember(tripId, id))}
                  onAskDelete={() => setConfirmDelete(true)}
                  onCancelDelete={() => setConfirmDelete(false)}
                  onDelete={() => {
                    deleteTrip(tripId);
                    void navigate({ to: "/" });
                  }}
                />
              ) : null}

              {trip.expenses.length === 0 ? (
                <Card>
                  <h2 className="font-display text-2xl font-medium">No bills yet</h2>
                  <p className="mt-2 text-sm leading-normal text-muted">
                    Add the first one. You can type it or dictate a sentence.
                  </p>
                </Card>
              ) : (
                [...grouped.entries()].map(([day, expenses]) => (
                  <div key={day}>
                    <h2 suppressHydrationWarning className="mb-2 text-sm font-medium text-muted">
                      {day}
                    </h2>
                    <div className="flex flex-col gap-2">
                      {expenses.map((expense) => {
                        const Icon = categoryMeta(expense.category).icon;
                        const payerNames = expense.payers
                          .map((payer) => trip.members.find((member) => member.id === payer.memberId)?.name)
                          .filter(Boolean)
                          .join(" & ");
                        const approx = convert(expense.amount, expense.currency, trip.settleCurrency, rates.perUsd);
                        return (
                          <Card key={expense.id} className="p-0">
                            <button
                              type="button"
                              className="flex w-full items-start justify-between gap-3 rounded-xl p-4 text-left"
                              onClick={() => setEditing(expense)}
                            >
                              <span>
                                <span className="flex items-center gap-2 font-medium">
                                  <Icon className="size-4 text-muted" />
                                  {expense.description}
                                </span>
                                <span className="mt-1 block text-base text-muted">
                                  {methodLabel(expense.method)} · {payerNames || "No payer"} paid ·{" "}
                                  {expense.splitAmong.length} sharing
                                </span>
                              </span>
                              <span className="text-right">
                                <span className="block font-medium tabular-nums">
                                  {formatMoney(expense.amount, expense.currency)}
                                </span>
                                {expense.currency !== trip.settleCurrency ? (
                                  <span className="mt-1 block text-sm tabular-nums text-muted">
                                    ≈ {formatMoney(approx, trip.settleCurrency)}
                                  </span>
                                ) : null}
                              </span>
                            </button>
                            <div className="flex justify-end px-4 pb-3">
                              {confirmExpense === expense.id ? (
                                <div className="flex items-center gap-2">
                                  <Button variant="danger" onClick={() => deleteExpense(tripId, expense.id)}>
                                    Remove
                                  </Button>
                                  <Button variant="ghost" onClick={() => setConfirmExpense(null)}>
                                    Keep
                                  </Button>
                                </div>
                              ) : (
                                <Button variant="ghost" className="text-muted" onClick={() => setConfirmExpense(expense.id)}>
                                  Remove
                                </Button>
                              )}
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {tab === "settle" ? (
            <div className="mt-4 flex flex-col gap-3">
              <Card>
                <h2 className="font-display text-2xl font-medium">Who is ahead</h2>
                <p className="mt-2 text-sm leading-normal text-muted">
                  Each person is credited for what they already paid. Someone who covered a bill owes less, or
                  is owed money back.
                </p>
                <Field label="Show totals and the split in" hint="Change this any time. Bills stay in the currency they were paid.">
                  <div className="mt-3 flex flex-wrap gap-2">
                    {CURRENCIES.map((currency) => (
                      <Chip
                        key={currency.id}
                        selected={trip.settleCurrency === currency.id}
                        onClick={() => updateTrip(tripId, { settleCurrency: currency.id })}
                      >
                        {currency.label}
                      </Chip>
                    ))}
                  </div>
                </Field>
                <ul className="mt-4 flex flex-col gap-3">
                  {result.balances.map((balance) => (
                    <li key={balance.memberId} className="border-t border-border pt-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-medium">{balance.name}</span>
                        <span
                          className={
                            balance.net > 0
                              ? "text-sm font-medium tabular-nums text-success"
                              : balance.net < 0
                                ? "text-sm font-medium tabular-nums text-danger"
                                : "text-sm font-medium text-muted"
                          }
                        >
                          {balance.net > 0
                            ? `is owed ${formatMoney(balance.net, trip.settleCurrency)}`
                            : balance.net < 0
                              ? `owes ${formatMoney(Math.abs(balance.net), trip.settleCurrency)}`
                              : "settled"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm tabular-nums text-muted">
                        Paid {formatMoney(balance.paid, trip.settleCurrency)} · share{" "}
                        {formatMoney(balance.share, trip.settleCurrency)}
                      </p>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card>
                <h2 className="font-display text-2xl font-medium">Who pays whom</h2>
                <p className="mt-2 text-sm leading-normal text-muted">
                  The shortest set of payments to close the trip.
                </p>
                {trip.expenses.length === 0 ? (
                  <p className="mt-4 text-sm text-muted">Add a few bills first.</p>
                ) : result.transfers.length === 0 ? (
                  <p className="mt-4 text-sm text-foreground">Nothing to move. Everyone is even.</p>
                ) : (
                  <ul className="mt-4 flex flex-col gap-3">
                    {result.transfers.map((transfer) => (
                      <li
                        key={`${transfer.fromId}-${transfer.toId}`}
                        className="flex items-baseline justify-between gap-3 border-t border-border pt-3"
                      >
                        <span>
                          {transfer.fromName} pays {transfer.toName}
                        </span>
                        <span className="font-medium tabular-nums">
                          {formatMoney(transfer.amount, trip.settleCurrency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Button
                variant="secondary"
                onClick={handleExport}
                disabled={exporting || trip.expenses.length === 0}
              >
                <Download className="size-4" />
                {exporting ? "Preparing…" : "Download CSV"}
              </Button>
            </div>
          ) : null}

          {tab === "rates" ? (
            <RatesPanel
              settleCurrency={trip.settleCurrency}
              perUsd={book.perUsd}
              source={book.source}
              fetchedAt={book.fetchedAt}
              locked={Boolean(trip.rateBook)}
              status={rateStatus}
              error={rateError}
              onRefresh={() =>
                void (trip.rateBook ? refreshTripRates(tripId) : refreshRates({ force: true }))
              }
              onEdit={(currency, value) =>
                trip.rateBook ? setTripRate(tripId, currency, value) : setManualRate(currency, value)
              }
              onLock={() => lockRates(tripId)}
              onUnlock={() => unlockRates(tripId)}
            />
          ) : null}
        </>
      )}
    </Shell>
  );
}

function TripEditor(props: {
  tripId: string;
  name: string;
  place: string;
  startDate: string;
  endDate: string;
  members: { id: string; name: string }[];
  memberName: string;
  memberError: string | null;
  confirmDelete: boolean;
  shared: boolean;
  onName: (value: string) => void;
  onPlace: (value: string) => void;
  onStart: (value: string) => void;
  onEnd: (value: string) => void;
  onMemberName: (value: string) => void;
  onAddMember: () => void;
  onRemoveMember: (id: string) => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  return (
    <Card>
      <div className="flex flex-col gap-4">
        <Field label="Trip name">
          <TextInput value={props.name} onChange={(event) => props.onName(event.target.value)} />
        </Field>
        <Field label="Place">
          <TextInput value={props.place} onChange={(event) => props.onPlace(event.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts">
            <TextInput type="date" value={props.startDate} onChange={(event) => props.onStart(event.target.value)} />
          </Field>
          <Field label="Ends">
            <TextInput type="date" value={props.endDate} onChange={(event) => props.onEnd(event.target.value)} />
          </Field>
        </div>
        <Field label="Travelers">
          <ul className="flex flex-col gap-2">
            {props.members.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-3">
                <span>{member.name}</span>
                <Button variant="ghost" className="text-muted" onClick={() => props.onRemoveMember(member.id)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <TextInput
              value={props.memberName}
              placeholder="Add a name"
              aria-label="New traveler"
              onChange={(event) => props.onMemberName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") props.onAddMember();
              }}
            />
            <Button variant="secondary" onClick={props.onAddMember}>
              Add
            </Button>
          </div>
          {props.memberError ? <p className="mt-2 text-sm text-danger">{props.memberError}</p> : null}
        </Field>
        {props.shared ? (
          <p className="text-sm leading-normal text-muted">
            Delete removes this trip from this device only. Stop sharing if the link should stop working.
          </p>
        ) : null}
        {props.confirmDelete ? (
          <div className="flex items-center gap-2">
            <Button variant="danger" onClick={props.onDelete}>
              Delete trip
            </Button>
            <Button variant="ghost" onClick={props.onCancelDelete}>
              Keep
            </Button>
          </div>
        ) : (
          <Button variant="danger" className="self-start px-0" onClick={props.onAskDelete}>
            Delete trip
          </Button>
        )}
      </div>
    </Card>
  );
}

function RatesPanel({
  settleCurrency,
  perUsd,
  source,
  fetchedAt,
  locked,
  status,
  error,
  onRefresh,
  onEdit,
  onLock,
  onUnlock,
}: {
  settleCurrency: Currency;
  perUsd: Record<Currency, number>;
  source: "yahoo" | "manual" | "estimate";
  fetchedAt: number | null;
  locked: boolean;
  status: "idle" | "loading";
  error: string | null;
  onRefresh: () => void;
  onEdit: (currency: Exclude<Currency, "USD">, value: number) => void;
  onLock: () => void;
  onUnlock: () => void;
}) {
  const note =
    source === "yahoo"
      ? `Yahoo Finance${fetchedAt ? ` · ${formatStamp(fetchedAt)}` : ""}`
      : source === "manual"
        ? "Using numbers you typed. Refresh to replace them with Yahoo."
        : "Estimated until Yahoo Finance answers. You can type a rate if you're offline.";
  const settle = CURRENCIES.find((item) => item.id === settleCurrency);

  return (
    <div className="mt-4 flex flex-col gap-3">
      <Card>
        <h2 className="font-display text-2xl font-medium">Currency rates</h2>
        <p className="mt-2 text-sm leading-normal text-muted">{note}</p>
        <p className="mt-2 text-base leading-relaxed text-muted">
          {locked
            ? "Locked for this trip. Other trips keep their own rates."
            : "Following the shared rates. Lock them if you want this trip to stay put."}
        </p>
        <p className="mt-2 text-base leading-relaxed text-muted">
          Shown in {currencyName(settleCurrency)}. A round amount of each currency converts into{" "}
          {settle?.symbol ?? settleCurrency}. Yahoo still quotes against the US dollar.
        </p>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <div className="mt-4 flex flex-col gap-2">
          <Button variant="secondary" onClick={onRefresh} disabled={status === "loading"}>
            <RefreshCw className="size-4" />
            {status === "loading" ? "Checking Yahoo…" : "Refresh from Yahoo"}
          </Button>
          {locked ? (
            <Button variant="ghost" className="self-start px-0" onClick={onUnlock}>
              Unlock
            </Button>
          ) : (
            <Button variant="secondary" onClick={onLock}>
              Use these rates for this trip
            </Button>
          )}
        </div>
        <ul className="mt-4 flex flex-col gap-4">
          {CURRENCIES.map((currency) => {
            if (currency.id === settleCurrency) {
              return (
                <li key={currency.id} className="border-t border-border pt-4">
                  <span className="font-medium">{currency.name}</span>
                  <p className="mt-2 text-base text-muted">Totals and the split use this currency.</p>
                </li>
              );
            }
            const lot = rateLot(currency.id, settleCurrency, perUsd);
            const shown = roundMoney(lot.amount, settleCurrency);
            const quoteCurrency = currency.id === "USD" ? settleCurrency : currency.id;
            const yahoo =
              quoteCurrency === "USD" ? null : yahooQuoteUrl(quoteCurrency);
            return (
              <li key={currency.id} className="border-t border-border pt-4">
                <span className="font-medium">{currency.name}</span>
                <RateEditor
                  label={`${formatUnits(lot.units)} ${currency.symbol}`}
                  settleSymbol={settle?.symbol ?? ""}
                  value={shown}
                  yahooHref={yahoo ?? "#"}
                  yahooName={currency.name}
                  onCommit={(amount) => {
                    const next = perUsdFromDisplayed(currency.id, settleCurrency, lot.units, amount, perUsd);
                    if (next) onEdit(next.currency, next.perUsd);
                  }}
                />
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function formatUnits(units: number): string {
  return new Intl.NumberFormat("en-US").format(units);
}

function RateEditor({
  label,
  settleSymbol,
  value,
  yahooHref,
  yahooName,
  onCommit,
}: {
  label: string;
  settleSymbol: string;
  value: number;
  yahooHref: string;
  yahooName: string;
  onCommit: (amount: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  const shown = focused ? text : String(value);

  return (
    <div className="mt-2">
      <label className="flex flex-col gap-1 text-base text-muted">
        <span>{label} =</span>
        <span className="flex items-center gap-2">
          <input
            inputMode="decimal"
            aria-label={`${label} in ${settleSymbol}`}
            className="h-12 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-base tabular-nums text-foreground"
            value={shown}
            onFocus={() => {
              setFocused(true);
              setText(String(value));
            }}
            onChange={(event) => setText(event.target.value)}
            onBlur={() => {
              setFocused(false);
              const next = Number(text.replace(",", "."));
              if (Number.isFinite(next) && next > 0 && Math.abs(next - value) > 0.0000001) onCommit(next);
              else setText(String(value));
            }}
          />
          <span className="shrink-0 font-medium text-foreground">{settleSymbol}</span>
        </span>
      </label>
      <a
        className="mt-1 inline-flex h-12 items-center text-base font-medium text-foreground underline"
        href={yahooHref}
        target="_blank"
        rel="noreferrer"
      >
        Open {yahooName} on Yahoo
      </a>
    </div>
  );
}
