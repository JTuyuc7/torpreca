import { useEffect } from "react";

// Every screen under app/ is a client component ("use client"), so none of
// them can export the App Router's `metadata`/`generateMetadata` (server-only
// API) to set their own <title> — this is the client-side equivalent, kept
// as one hook instead of repeating the same effect on every page.
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · Torpreca`;
  }, [title]);
}