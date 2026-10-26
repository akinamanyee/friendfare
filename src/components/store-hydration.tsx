import { useEffect } from "react";
import { ESTIMATE_PER_USD } from "@/lib/money";
import { useWayfare } from "@/lib/store";

const SIX_HOURS = 6 * 60 * 60 * 1000;

export function StoreHydration() {
  useEffect(() => {
    let cancel = false;
    void (async () => {
      await useWayfare.persist.rehydrate();
      if (cancel) return;
      const state = useWayfare.getState();
      useWayfare.setState({ rates: { ...state.rates, perUsd: { ...ESTIMATE_PER_USD, ...state.rates.perUsd } } });
      const { rates, refreshRates } = useWayfare.getState();
      const stale = rates.fetchedAt == null || Date.now() - rates.fetchedAt > SIX_HOURS;
      if (rates.source !== "manual" && (rates.source === "estimate" || stale)) {
        await refreshRates();
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);
  return null;
}
