// `aria-live="polite"` announces the message to screen readers as soon as it
// appears (e.g. after a field is blurred with an invalid value) without
// requiring focus to move there — `role="alert"` alone only announces
// content present at render, not content that shows up after user input.
// `id` is optional: pass it when the input references this message via
// `aria-describedby` so the two stay linked.
export function FieldError({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" aria-live="polite" className="text-xs text-error">
      {children}
    </p>
  );
}