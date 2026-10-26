import { createFileRoute } from "@tanstack/react-router";
import { TripView } from "@/components/trip-view";

export const Route = createFileRoute("/trip/$tripId")({
  component: TripPage,
});

function TripPage() {
  const { tripId } = Route.useParams();
  return <TripView tripId={tripId} />;
}
