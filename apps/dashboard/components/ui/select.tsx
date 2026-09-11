import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";

// Wraps a native <select> with a consistent look across the app: the raw
// element renders its own OS-drawn dropdown arrow (looks inconsistent
// between browsers/OSes, and clashes with the surrounding dark theme more
// than the plain text inputs do) — `appearance-none` strips it and this
// overlays a themed chevron in its place. The <select>'s own popup list still
// uses the browser's native picker (color-scheme in globals.css keeps that
// themed too); only the closed-state trigger is restyled here.
//
// forwardRef matters: react-hook-form's register() attaches a ref to read
// the field and to reset it — a plain function component here would silently
// break reset() on this field (the DOM value would stay stuck after a
// successful submit).
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = "", ...rest }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          {...rest}
          className={`h-9 w-full appearance-none rounded-md border border-outline/30 bg-background px-2 pr-8 text-sm text-text ${className}`}
        />
        <ChevronDown
          size={14}
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-outline"
        />
      </div>
    );
  },
);