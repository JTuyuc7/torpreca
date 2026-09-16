import type { Route } from "@torpreca/shared";

const STATUS_LABELS: Record<Route["status"], string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Completada",
  delayed: "Retrasada",
  cancelled: "Cancelada",
};

// Only the tokens the design system actually defines (outline/primary/error)
// — no new colors invented for this: neutral for pending, primary for the
// two "moving forward" states, error for the two "went wrong" states.
const STATUS_BADGE_CLASSES: Record<Route["status"], string> = {
  pending: "bg-outline/15 text-outline",
  in_progress: "bg-primary/15 text-primary",
  completed: "bg-primary text-white",
  delayed: "bg-error/15 text-error",
  cancelled: "bg-error text-white",
};

// Extracted from app/(protected)/rutas/page.tsx (TOR-30) when
// "Detalle de conductor" (TOR-33) became a second screen needing the same
// route-status coloring for a driver's route history.
export function RouteStatusBadge({ status }: { status: Route["status"] }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
