import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type EmptyStateAction = { label: string } & ({ onClick: () => void } | { href: string });

// Consistent "nothing here yet" treatment — replaces the one-line
// `<p className="text-sm text-outline">` empty messages used across every
// list screen. Early in the project most tables/lists are genuinely empty
// (no data seeded yet), and a plain gray sentence reads as broken more than
// as expected — an icon, a fuller explanation, and (where there's somewhere
// useful to send the user) an action make the difference legible.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  /** Tighter padding/icon for use inside a small area (e.g. a sidebar list). */
  compact?: boolean;
}) {
  const actionClassName =
    "mt-1 flex h-8 items-center gap-1.5 rounded-md border border-primary px-3 text-xs font-medium text-primary transition-opacity hover:opacity-90 cursor-pointer";

  return (
    <div
      className={`flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-outline/30 text-center ${
        compact ? "px-4 py-6" : "px-6 py-10"
      }`}
    >
      <Icon size={compact ? 18 : 24} className="text-outline" />
      <p className="text-sm font-medium text-text">{title}</p>
      {description && <p className="max-w-sm text-xs text-outline">{description}</p>}
      {action &&
        ("href" in action ? (
          <Link href={action.href} className={actionClassName}>
            {action.label}
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className={actionClassName}>
            {action.label}
          </button>
        ))}
    </div>
  );
}
