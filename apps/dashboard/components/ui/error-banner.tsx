import { AlertCircle } from "lucide-react";

// Replaces the old bare `<p role="alert" className="text-error">` — same
// role/semantics for a11y, but readable as an actual error state instead of
// a stray line of red text sitting under the page header.
export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
    >
      <div className="flex items-center gap-2">
        <AlertCircle size={16} className="shrink-0" />
        <span>{message}</span>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-md border border-error/40 px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-90 cursor-pointer"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}