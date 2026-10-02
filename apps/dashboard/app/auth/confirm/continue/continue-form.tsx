"use client";

import { usePageTitle } from "@/lib/hooks/use-page-title";
import { useTranslation } from "@/lib/i18n/use-translation";

// A plain <form method="POST">, no JS handler: the browser submits it and
// follows the 303 from POST /auth/confirm on its own.
export function ContinueForm({ tokenHash, type }: { tokenHash: string; type: string }) {
  const { t } = useTranslation();
  usePageTitle(t.confirmContinue.title);

  return (
    <div className="flex flex-1 items-center justify-center bg-background px-4">
      <form method="POST" action="/auth/confirm" className="flex max-w-sm flex-col items-center text-center">
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={type} />
        <h1 className="text-2xl text-text">{t.confirmContinue.title}</h1>
        <p className="mt-2 text-sm text-outline">{t.confirmContinue.description}</p>
        <button
          type="submit"
          className="mt-6 w-full rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-on-primary transition-opacity hover:opacity-90 cursor-pointer"
        >
          {t.confirmContinue.button}
        </button>
      </form>
    </div>
  );
}
