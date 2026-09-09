"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

// One QueryClient per browser tab, created lazily inside useState so it
// survives re-renders but isn't shared across requests on the server (Next's
// App Router can render this module server-side too, even though the
// provider itself is client-only — a module-level singleton would leak
// state between unrelated requests there).
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}