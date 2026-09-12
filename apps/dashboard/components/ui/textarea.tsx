import { forwardRef } from "react";

// Same visual language as Input — see its comment for why full-opacity
// border-outline + a focus ring, not border-outline/30.
export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className = "", ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      {...rest}
      className={`rounded-md border border-outline bg-background px-2 py-1.5 text-sm text-text outline-none transition-colors focus:ring-1 focus:ring-primary ${className}`}
    />
  );
});