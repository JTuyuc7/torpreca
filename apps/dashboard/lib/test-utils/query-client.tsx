import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Shared by every test that renders a component or hook depending on
// TanStack Query (anything using lib/hooks/*). `retry: false` makes a failed
// query/mutation fail the test immediately instead of retrying 3x with
// backoff — tests assert on the first attempt's outcome.
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

export function withQueryClient(children: React.ReactNode, client = createTestQueryClient()) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}