import { forwardRef } from "react";

// Matches the login screen's input style (border-outline at full opacity +
// a focus ring) instead of the fainter border-outline/30 the first pass of
// these forms used — the fainter version read as "empty/disabled" against
// the dark surface rather than as an editable field.
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...rest }, ref) {
    return (
      <input
        ref={ref}
        {...rest}
        className={`h-9 rounded-md border border-outline bg-background px-2 text-sm text-text outline-none transition-colors focus:ring-1 focus:ring-primary ${className}`}
      />
    );
  },
);