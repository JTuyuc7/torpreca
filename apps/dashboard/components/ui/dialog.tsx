"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

// Headless primitives from Radix (focus trap, scroll lock, Esc-to-close,
// aria wiring) — we only own the Tailwind styling on top, same pattern as
// Input/Select/Textarea. Picked over a custom <dialog> build because this
// project has no prior modal code to model accessibility edge cases after.
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export function DialogContent({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      {/* Fixed black scrim (not a theme token) — a dark overlay reads the
          same regardless of light/dark mode, and --text at 40% in light
          mode wasn't dark enough to look like a proper backdrop. */}
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/60 data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        // Radix focuses the first focusable descendant on open by default —
        // without this override that's the (tabIndex=0) FieldHint icon next
        // to the first label, not the field itself. Focus the first real
        // input/select/textarea instead.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          const content = event.currentTarget as HTMLElement;
          const field = content.querySelector<HTMLElement>("input, select, textarea");
          // Confirmation views have no form fields — fall back to the first
          // real action button instead (skips the icon-only close button).
          const fallback = Array.from(content.querySelectorAll<HTMLElement>("button")).find(
            (button) => button.getAttribute("aria-label") !== "Cerrar",
          );
          (field ?? fallback)?.focus();
        }}
        className={`fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-outline/20 bg-surface p-5 shadow-lg outline-none ${className}`}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute right-4 top-4 rounded-md p-1 text-outline outline-none transition-opacity hover:opacity-70 focus-visible:ring-1 focus-visible:ring-primary cursor-pointer"
          aria-label="Cerrar"
        >
          <X size={16} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 flex flex-col gap-1 pr-6">{children}</div>;
}

export function DialogTitle({ children }: { children: React.ReactNode }) {
  return <DialogPrimitive.Title className="text-sm font-semibold text-text">{children}</DialogPrimitive.Title>;
}

export function DialogDescription({ children }: { children: React.ReactNode }) {
  return (
    <DialogPrimitive.Description className="text-xs text-outline">{children}</DialogPrimitive.Description>
  );
}

export function DialogFooter({ children }: { children: React.ReactNode }) {
  return <div className="mt-5 flex flex-wrap items-center justify-end gap-2">{children}</div>;
}