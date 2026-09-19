"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";

// Deliberately doesn't reuse components/ui/dialog.tsx's DialogContent: that
// one always renders a Close (X) button, and this dialog has to be
// non-dismissable — the session is already gone by the time it's shown
// (TOR-123's onTimeout already called signOut()), so Esc/outside-click/close
// would just leave the user staring at a dead page instead of logging back in.
export function SessionExpiredDialog({ onLoginAgain }: { onLoginAgain: () => void }) {
  return (
    <DialogPrimitive.Root open modal>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <DialogPrimitive.Content
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-outline/20 bg-surface p-5 shadow-lg outline-none"
        >
          <DialogPrimitive.Title className="text-sm font-semibold text-text">
            Tu sesión expiró
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-2 text-sm text-outline">
            Por seguridad cerramos tu sesión después de un periodo sin actividad. Inicia sesión de
            nuevo para continuar.
          </DialogPrimitive.Description>
          <button
            type="button"
            onClick={onLoginAgain}
            className="mt-5 w-full rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-on-primary transition-opacity hover:opacity-90 cursor-pointer"
          >
            Iniciar sesión de nuevo
          </button>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
