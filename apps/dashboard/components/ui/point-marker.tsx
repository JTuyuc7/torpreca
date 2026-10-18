import { MapPin, X } from "lucide-react";

export type PointRole = "origin" | "destination";

// The A (origin) / B (destination) pin shared by the km calculator and the
// live map. With `onRemove` it also shows a small X to drop the point; without
// it the pin is read-only (the live map only displays them).
export function PointMarker({
  role,
  onRemove,
  removeLabel,
}: {
  role: PointRole;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  const colorClass = role === "origin" ? "text-primary" : "text-error";
  return (
    <div className="group relative flex flex-col items-center">
      {onRemove && (
        <button
          type="button"
          aria-label={removeLabel}
          title={removeLabel}
          onClick={(e) => {
            // Don't let the click fall through to the map and place a new point.
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -right-3 -top-3 z-10 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-surface text-text shadow cursor-pointer hover:bg-error hover:text-white"
        >
          <X size={10} />
        </button>
      )}
      <span
        className={`absolute -top-4 rounded-full border border-white px-1 text-[10px] font-bold text-white shadow ${role === "origin" ? "bg-primary" : "bg-error"}`}
      >
        {role === "origin" ? "A" : "B"}
      </span>
      <MapPin
        size={34}
        className={`${colorClass} drop-shadow-lg`}
        fill="currentColor"
        strokeWidth={1.5}
      />
    </div>
  );
}
