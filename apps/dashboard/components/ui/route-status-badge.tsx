import type { Route } from "@torpreca/shared";
import { useTranslation } from "@/lib/i18n/use-translation";

// Only the tokens the design system actually defines (outline/primary/error)
// — no new colors invented for this: neutral for pending, primary for the
// two "moving forward" states, error for the two "went wrong" states.
const STATUS_BADGE_CLASSES: Record<Route["status"], string> = {
  pending: "bg-outline/15 text-outline",
  in_progress: "bg-primary/15 text-primary",
  completed: "bg-primary text-on-primary",
  delayed: "bg-error/15 text-error",
  cancelled: "bg-error text-on-error",
};

// Extracted from app/(protected)/rutas/page.tsx (TOR-30) when
// "Detalle de conductor" (TOR-33) became a second screen needing the same
// route-status coloring for a driver's route history.
//
// `overdue` (see isRouteOverdue in @torpreca/shared) replaces the stored
// status with "Sin completar": a route whose day passed without being
// finished isn't really "pending" or "in progress" anymore.
export function RouteStatusBadge({
  status,
  overdue = false,
}: {
  status: Route["status"];
  overdue?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${overdue ? "bg-error/15 text-error" : STATUS_BADGE_CLASSES[status]}`}
    >
      {overdue ? t.routeStatus.overdue : t.routeStatus[status]}
    </span>
  );
}
