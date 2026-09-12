import { Loader2 } from "lucide-react";

// First shared UI primitive (see context/dashboard/design-system-v2-tokens.md
// — pulled out once a second screen needed the same loading treatment as
// Gestión de usuarios). Plain Tailwind + lucide, no headless library: this is
// a visual-only spinner, not an interactive component.
export function Spinner({ className = "" }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden="true" />;
}