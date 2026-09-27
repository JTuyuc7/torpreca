"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";

// Headless primitives from Radix (focus trap, keyboard nav, click-outside/Esc
// to close, aria wiring) — we only own the Tailwind styling on top, same
// pattern as components/ui/dialog.tsx.
export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export function DropdownMenuContent({
  children,
  align = "end",
}: {
  children: React.ReactNode;
  align?: "start" | "center" | "end";
}) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        align={align}
        sideOffset={4}
        className="z-50 min-w-40 rounded-md border border-outline/20 bg-surface p-1 shadow-lg outline-none data-[state=open]:animate-fade-in"
      >
        {children}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  children,
  onSelect,
  disabled = false,
  destructive = false,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.Item
      onSelect={onSelect}
      disabled={disabled}
      className={`flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm capitalize outline-none transition-colors data-[highlighted]:bg-primary/10 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 ${
        destructive ? "text-error" : "text-text"
      }`}
    >
      {children}
    </DropdownMenuPrimitive.Item>
  );
}

export function DropdownMenuLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2 py-1.5 text-[10px] uppercase tracking-wide text-outline">{children}</div>;
}

export function DropdownMenuSeparator() {
  return <DropdownMenuPrimitive.Separator className="my-1 h-px bg-outline/20" />;
}
