import { Info } from "lucide-react";

// A small "?" icon next to a label that reveals a short explanation on
// hover/focus — for fields whose purpose isn't obvious from the label alone
// (e.g. what unit "Capacidad" is measured in). Pure CSS (group-hover), no
// tooltip library and no JS state.
//
// `align` picks which edge of the icon the tooltip box hangs from instead of
// centering on it — a centered box clips against the viewport/card edge for
// any field near the left or right side of a form. Default "left" covers the
// common case (first field in a row); pass "right" for a field near the
// row's right edge instead.
export function FieldHint({ text, align = "left" }: { text: string; align?: "left" | "right" }) {
  return (
    <span tabIndex={0} aria-label={text} className="group relative inline-flex outline-none">
      <Info size={13} className="cursor-help text-outline" />
      {/* aria-hidden: the wrapper's aria-label above already exposes `text`
          as this element's accessible name — without hiding this visual
          copy too, screen readers (and any getByLabelText query on a
          neighboring <label>) would pick up both concatenated. */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute bottom-full z-10 mb-1.5 w-44 rounded-md bg-text px-2 py-1.5 text-xs leading-snug text-background opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100 ${
          align === "left" ? "left-0" : "right-0"
        }`}
      >
        {text}
      </span>
    </span>
  );
}