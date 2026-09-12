import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withQueryClient } from "@/lib/test-utils/query-client";

vi.mock("@/lib/supabase/access-token", () => ({ getAccessToken: vi.fn(async () => "tok") }));

const getDashboardSummary = vi.fn();
vi.mock("@/lib/api/dashboard-client", () => ({
  getDashboardSummary: (...args: unknown[]) => getDashboardSummary(...args),
}));

import { useDashboardSummary } from "./use-dashboard-summary";

const summary = {
  routesInProgress: 2,
  routesPendingToday: 1,
  vehiclesActive: 5,
  driversActive: 4,
  driversOnline: 3,
};

beforeEach(() => {
  getDashboardSummary.mockReset();
});

function renderUseDashboardSummary() {
  return renderHook(() => useDashboardSummary(), {
    wrapper: ({ children }) => withQueryClient(children),
  });
}

describe("useDashboardSummary", () => {
  it("loads and exposes the summary", async () => {
    getDashboardSummary.mockResolvedValue({ ok: true, summary });

    const { result } = renderUseDashboardSummary();

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.summary).toEqual(summary));
    expect(result.current.error).toBeNull();
  });

  it("surfaces an error message when the request fails", async () => {
    getDashboardSummary.mockResolvedValue({ ok: false, status: 500 });

    const { result } = renderUseDashboardSummary();

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.summary).toBeUndefined();
  });
});