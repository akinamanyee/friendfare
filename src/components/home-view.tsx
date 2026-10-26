import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { CURRENCIES, currencyName, formatISODate, formatMoney } from "@/lib/money";
import { settle } from "@/lib/settle";
import { readShare } from "@/lib/share";
import { normalizeShareCode } from "@/lib/share-code";
import { SAMPLE_TRIP_ID, useWayfare } from "@/lib/store";
import type { Currency } from "@/lib/types";
import { Button, Card, Chip, Field, Shell, TextInput } from "@/components/ui";

export function HomeView() {
  const trips = useWayfare((s) => s.trips);
  const rates = useWayfare((s) => s.rates);
  const addTrip = useWayfare((s) => s.addTrip);
  const deleteTrip = useWayfare((s) => s.deleteTrip);
  const restoreSample = useWayfare((s) => s.restoreSample);
  const adoptSharedTrip = useWayfare((s) => s.adoptSharedTrip);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [place, setPlace] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [settleCurrency, setSettleCurrency] = useState<Currency>("HKD");
  const [names, setNames] = useState(["", ""]);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const hasSample = trips.some((trip) => trip.id === SAMPLE_TRIP_ID);

  function createTrip() {
    const people = names.map((item) => item.trim()).filter(Boolean);
    if (!name.trim()) {
      setError("Name the trip.");
      return;
    }
    if (people.length < 2) {
      setError("Add at least two people so there's someone to split with.");
      return;
    }
    const unique = new Set(people.map((item) => item.toLowerCase()));
    if (unique.size !== people.length) {
      setError("Each person needs a different name.");
      return;
    }
    const id = addTrip({
      name,
      place,
      settleCurrency,
      memberNames: people,
      startDate,
      endDate,
    });
    void navigate({ to: "/trip/$tripId", params: { tripId: id } });
  }

  async function joinTrip() {
    const code = normalizeShareCode(joinCode);
    if (code.length < 4) {
      setJoinError("Enter the trip code.");
      return;
    }
    setJoining(true);
    setJoinError(null);
    try {
      const row = await readShare({ data: { code } });
      if (!row.ok) {
        setJoinError(row.error);
        return;
      }
      adoptSharedTrip({ ...row.trip, shareCode: row.code, shareVersion: row.version });
      void navigate({ to: "/trip/$tripId", params: { tripId: row.trip.id } });
    } catch {
      setJoinError("Couldn't open that trip. Try again.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <Shell>
      <p className="text-sm font-medium text-muted">Travel ledger</p>
      <h1 className="mt-2 font-display text-4xl font-medium tracking-tight text-foreground">Friendfare</h1>
      <p className="mt-3 max-w-md text-base leading-relaxed text-muted">
        Log what the group spends on the road — in yen, won, euros, US dollars, RMB, or Hong Kong dollars.
        Choose the currency you want totals and the final split shown in. Spend in local money; see it converted.
        One person starts the trip. Share a code only if a friend should use the same one. Logging alone doesn't need a code.
      </p>

      <div className="mt-8">
        {open ? (
          <Card>
            <h2 className="font-display text-2xl font-medium tracking-tight">New trip</h2>
            <div className="mt-4 flex flex-col gap-4">
              <Field label="Trip name">
                <TextInput
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Korea and Japan"
                  autoComplete="off"
                />
              </Field>
              <Field label="Place" hint="Optional.">
                <TextInput
                  value={place}
                  onChange={(event) => setPlace(event.target.value)}
                  placeholder="Seoul, Busan, Osaka"
                  autoComplete="off"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Starts">
                  <TextInput type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                </Field>
                <Field label="Ends">
                  <TextInput type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                </Field>
              </div>
              <Field label="Show totals and the split in" hint="Expenses can be in any currency. Everything converts to this.">
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Settlement currency">
                  {CURRENCIES.map((currency) => (
                    <Chip
                      key={currency.id}
                      selected={settleCurrency === currency.id}
                      onClick={() => setSettleCurrency(currency.id)}
                      role="radio"
                      aria-checked={settleCurrency === currency.id}
                    >
                      {currency.label}
                    </Chip>
                  ))}
                </div>
              </Field>
              <Field label="Travelers" hint="Whoever might pay or share a bill.">
                <div className="flex flex-col gap-2">
                  {names.map((value, index) => (
                    <TextInput
                      key={index}
                      value={value}
                      aria-label={`Traveler ${index + 1}`}
                      placeholder={index === 0 ? "Mei" : "Ken"}
                      autoComplete="off"
                      onChange={(event) => {
                        const next = [...names];
                        next[index] = event.target.value;
                        setNames(next);
                      }}
                    />
                  ))}
                  <Button variant="ghost" className="self-start px-0" onClick={() => setNames([...names, ""])}>
                    <Plus className="size-4" />
                    Add another person
                  </Button>
                </div>
              </Field>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <div className="flex gap-2">
                <Button full onClick={createTrip}>
                  Create trip
                </Button>
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Button full onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            New trip
          </Button>
        )}
      </div>

      <Card className="mt-3">
        <Field label="Have a code from a friend?" hint="They create the trip, then send the code. You don't need one to start.">
          <div className="flex gap-2">
            <TextInput
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              placeholder="Code"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              aria-label="Trip code"
              onKeyDown={(event) => {
                if (event.key === "Enter") void joinTrip();
              }}
            />
            <Button onClick={() => void joinTrip()} disabled={joining}>
              {joining ? "Joining…" : "Join"}
            </Button>
          </div>
        </Field>
        {joinError ? <p className="mt-2 text-sm text-danger">{joinError}</p> : null}
      </Card>

      <div className="mt-8 flex flex-col gap-3">
        {trips.length === 0 ? (
          <Card>
            <h2 className="font-display text-2xl font-medium">No trips yet</h2>
            <p className="mt-2 text-sm leading-normal text-muted">
              One person starts the trip. Join only if a friend sent a code.
            </p>
          </Card>
        ) : (
          trips.map((trip) => {
            const result = settle(trip, (trip.rateBook ?? rates).perUsd);
            const owes = result.transfers.length > 0;
            const when = [trip.startDate, trip.endDate].filter(Boolean);
            return (
              <Card key={trip.id} className="p-0">
                <Link
                  to="/trip/$tripId"
                  params={{ tripId: trip.id }}
                  className="block rounded-xl p-4 no-underline"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-2xl font-medium tracking-tight">{trip.name}</h2>
                      <p className="mt-1 text-sm text-muted">
                        {trip.place || "No place yet"}
                        {when.length > 0 ? ` · ${when.map(formatISODate).join(" – ")}` : ""}
                      </p>
                    </div>
                    {trip.id === SAMPLE_TRIP_ID ? (
                      <span className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted">
                        Sample
                      </span>
                    ) : trip.shareCode ? (
                      <span className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted">
                        Shared
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-4 text-sm text-muted">
                    {trip.members.map((member) => member.name).join(", ")}
                  </p>
                  <p className="mt-3 font-display text-3xl font-medium tabular-nums tracking-tight">
                    {formatMoney(result.spent, trip.settleCurrency)}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {trip.expenses.length} {trip.expenses.length === 1 ? "bill" : "bills"} ·{" "}
                    {owes ? "still to settle" : "settled"} in {currencyName(trip.settleCurrency)}
                  </p>
                </Link>
                <div className="flex justify-end px-4 pb-4">
                  {pendingDelete === trip.id ? (
                    <div className="flex flex-col items-end gap-2">
                      {trip.shareCode ? (
                        <span className="text-sm text-muted">This deletes it here. The shared link keeps working.</span>
                      ) : (
                        <span className="text-sm text-muted">Delete this trip?</span>
                      )}
                      <div className="flex items-center gap-2">
                        <Button variant="danger" onClick={() => deleteTrip(trip.id)}>
                          Delete
                        </Button>
                        <Button variant="ghost" onClick={() => setPendingDelete(null)}>
                          Keep
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="ghost" className="text-muted" onClick={() => setPendingDelete(trip.id)}>
                      <Trash2 className="size-4" />
                      Delete
                    </Button>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {!hasSample ? (
        <div className="mt-4">
          <Button variant="secondary" onClick={restoreSample}>
            Load the sample trip
          </Button>
        </div>
      ) : null}

      <p className="mt-8 text-sm leading-normal text-muted">
        Rates come from Yahoo Finance. A trip stays on this device until you share it.
      </p>
    </Shell>
  );
}
