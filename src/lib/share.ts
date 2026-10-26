import { createServerFn } from "@tanstack/react-start";
import { makeShareCode, normalizeShareCode, readTripJson } from "@/lib/share-code";
import { SAMPLE_TRIP_ID, type Trip } from "@/lib/types";

export type ShareWrite =
  | { ok: true; code: string; version: number }
  | { ok: false; error: string };

export type ShareRead =
  | { ok: true; trip: Trip; code: string; version: number }
  | { ok: false; error: string };

function reject(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

export const createShare = createServerFn({ method: "POST" })
  .validator((input: { trip?: Trip }) => {
    if (input?.trip?.id === SAMPLE_TRIP_ID) return reject("The sample trip stays on this device.");
    const trip = readTripJson(input?.trip);
    if (!trip) return reject("That trip can't be shared.");
    return { ok: true as const, trip };
  })
  .handler(async ({ data }): Promise<ShareWrite> => {
    if (!data.ok) return data;
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const body = JSON.stringify(data.trip);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = makeShareCode();
      const rows = await sql<{ code: string; version: number }>`
        insert into shared_trips (code, trip, version)
        values (${code}, ${body}::jsonb, 1)
        on conflict (code) do nothing
        returning code, version
      `;
      if (rows[0]) return { ok: true, code: rows[0].code, version: Number(rows[0].version) };
    }
    return reject("Couldn't make a code. Try again.");
  });

export const readShare = createServerFn({ method: "POST" })
  .validator((input: { code?: string }) => normalizeShareCode(input?.code ?? ""))
  .handler(async ({ data }): Promise<ShareRead> => {
    if (data.length < 4) return reject("Enter the trip code.");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{ trip: unknown; version: number; code: string }>`
      select code, trip, version from shared_trips where code = ${data}
    `;
    const row = rows[0];
    if (!row) return reject("No trip uses that code.");
    const trip = readTripJson(row.trip);
    if (!trip) return reject("That shared trip can't be opened.");
    return { ok: true, trip, code: row.code, version: Number(row.version) };
  });

export const saveShare = createServerFn({ method: "POST" })
  .validator((input: { code?: string; trip?: Trip }) => {
    const code = normalizeShareCode(input?.code ?? "");
    const trip = readTripJson(input?.trip);
    if (code.length < 4 || !trip) return reject("That trip can't be updated.");
    return { ok: true as const, code, trip };
  })
  .handler(async ({ data }): Promise<ShareWrite> => {
    if (!data.ok) return data;
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{ version: number }>`
      update shared_trips
      set trip = ${JSON.stringify(data.trip)}::jsonb,
          version = version + 1,
          updated_at = now()
      where code = ${data.code}
      returning version
    `;
    if (!rows[0]) return reject("This shared trip is no longer available.");
    return { ok: true, code: data.code, version: Number(rows[0].version) };
  });

export const unshareTrip = createServerFn({ method: "POST" })
  .validator((input: { code?: string }) => normalizeShareCode(input?.code ?? ""))
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (data.length < 4) return reject("That code doesn't look right.");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`delete from shared_trips where code = ${data}`;
    return { ok: true };
  });
