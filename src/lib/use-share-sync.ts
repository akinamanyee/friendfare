import { useEffect, useRef, useState } from "react";
import { tripBody } from "@/lib/share-code";
import { readShare, saveShare } from "@/lib/share";
import { useWayfare } from "@/lib/store";
import type { Trip } from "@/lib/types";

export function useShareSync(trip: Trip | undefined, pauseRemote: boolean) {
  const adoptSharedTrip = useWayfare((s) => s.adoptSharedTrip);
  const markShare = useWayfare((s) => s.markShare);
  const [note, setNote] = useState<string | null>(null);
  const lastBody = useRef("");
  const tripRef = useRef(trip);
  const pauseRef = useRef(pauseRemote);
  const seq = useRef(0);
  tripRef.current = trip;
  pauseRef.current = pauseRemote;

  useEffect(() => {
    const current = tripRef.current;
    lastBody.current = current ? tripBody(current) : "";
  }, [trip?.id, trip?.shareCode]);

  useEffect(() => {
    const current = tripRef.current;
    if (!current?.shareCode) return;
    const body = tripBody(current);
    if (body === lastBody.current) return;
    const timer = window.setTimeout(() => {
      void push();
    }, 700);
    return () => window.clearTimeout(timer);
  }, [trip ? tripBody(trip) : ""]);

  useEffect(() => {
    const code = trip?.shareCode;
    const id = trip?.id;
    if (!code || !id) return;
    let cancel = false;
    async function pull() {
      const current = tripRef.current;
      if (cancel || !current?.shareCode) return;
      if (tripBody(current) !== lastBody.current) return;
      try {
        const row = await readShare({ data: { code: current.shareCode } });
        if (cancel || !row.ok) return;
        if (row.version <= (tripRef.current?.shareVersion ?? 0)) return;
        if (pauseRef.current) {
          setNote("Someone updated this trip. Close the bill to refresh.");
          return;
        }
        const next = { ...row.trip, shareCode: current.shareCode, shareVersion: row.version };
        lastBody.current = tripBody(next);
        adoptSharedTrip(next);
        setNote("This trip was updated.");
      } catch {
        // A missed poll leaves the copy on this device.
      }
    }
    void pull();
    const timer = window.setInterval(() => void pull(), 4000);
    return () => {
      cancel = true;
      window.clearInterval(timer);
    };
  }, [trip?.id, trip?.shareCode, pauseRemote, adoptSharedTrip]);

  async function push() {
    const current = tripRef.current;
    if (!current?.shareCode) return;
    const body = tripBody(current);
    if (body === lastBody.current) return;
    const mine = ++seq.current;
    try {
      const saved = await saveShare({ data: { code: current.shareCode, trip: current } });
      if (mine !== seq.current) return;
      if (!saved.ok) {
        setNote(saved.error);
        return;
      }
      lastBody.current = body;
      if (saved.version > (current.shareVersion ?? 0) + 1) {
        setNote("Your latest change replaced a newer copy.");
      } else {
        setNote(null);
      }
      if (saved.version !== current.shareVersion) markShare(current.id, current.shareCode, saved.version);
    } catch {
      if (mine === seq.current) setNote("Couldn't update the shared trip. Your copy is still on this device.");
    }
  }

  return { note, setNote };
}
