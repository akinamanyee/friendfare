import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell } from "@/components/ui";
import { readShare } from "@/lib/share";
import { normalizeShareCode } from "@/lib/share-code";
import { useWayfare } from "@/lib/store";

export const Route = createFileRoute("/join/$code")({
  component: JoinPage,
});

function JoinPage() {
  const { code } = Route.useParams();
  const adoptSharedTrip = useWayfare((s) => s.adoptSharedTrip);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      try {
        const row = await readShare({ data: { code: normalizeShareCode(code) } });
        if (cancel) return;
        if (!row.ok) {
          setError(row.error);
          return;
        }
        const trip = { ...row.trip, shareCode: row.code, shareVersion: row.version };
        adoptSharedTrip(trip);
        void navigate({ to: "/trip/$tripId", params: { tripId: trip.id }, replace: true });
      } catch {
        if (!cancel) setError("Couldn't open that trip. Try again.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [adoptSharedTrip, code, navigate]);

  return (
    <Shell>
      <h1 className="font-display text-3xl font-medium">Joining the trip</h1>
      <p className="mt-2 text-base text-muted">{error ?? "Opening the shared trip…"}</p>
      <Link to="/" className="mt-6 inline-flex h-12 items-center text-base font-medium">
        Back to trips
      </Link>
    </Shell>
  );
}
