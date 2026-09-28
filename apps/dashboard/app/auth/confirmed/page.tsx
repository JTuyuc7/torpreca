"use client";

import { CheckCircle2 } from "lucide-react";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import { useTranslation } from "@/lib/i18n/use-translation";

// Reached from GET /auth/confirm?type=signup — a driver self-registering
// from mobile (CLAUDE.md: driver has no dashboard access), so this is a dead
// end on purpose: no login form, no redirect into the app, just point them
// back to the mobile app they already have.
export default function ConfirmedPage() {
  const { t } = useTranslation();
  usePageTitle(t.confirmed.title);

  return (
    <div className="flex flex-1 items-center justify-center bg-background px-4">
      <div className="flex max-w-sm flex-col items-center text-center">
        <CheckCircle2 className="h-10 w-10 text-primary" />
        <h1 className="mt-4 text-2xl text-text">{t.confirmed.title}</h1>
        <p className="mt-2 text-sm text-outline">{t.confirmed.description}</p>
      </div>
    </div>
  );
}
