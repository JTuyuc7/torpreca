import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/access-token", () => ({ getAccessToken: vi.fn(async () => "tok") }));

const getLatestLocations = vi.fn();
const mintWsTicket = vi.fn();
vi.mock("@/lib/api/dashboard-client", () => ({
  getLatestLocations: (...args: unknown[]) => getLatestLocations(...args),
  mintWsTicket: (...args: unknown[]) => mintWsTicket(...args),
}));

import { useLiveLocations } from "./use-live-locations";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  close() {
    this.closed = true;
  }
}

// `recordedAt` has to be "now" at test-run time, not a fixed past date — the
// hook filters out anything older than STALE_AFTER_MS (see its doc comment),
// and every other test here relies on location1 counting as fresh.
const location1 = {
  id: "l1",
  driverId: "d1",
  routeId: null,
  lat: 14.6,
  lng: -90.5,
  speed: null,
  recordedAt: new Date().toISOString(),
  synced: true,
  createdAt: "t",
  updatedAt: "t",
};

beforeEach(() => {
  getLatestLocations.mockReset();
  mintWsTicket.mockReset();
  MockWebSocket.instances = [];
  vi.stubGlobal("WebSocket", MockWebSocket);
});

describe("useLiveLocations", () => {
  it("seeds locations from the REST snapshot, then opens a WS connection with the minted ticket", async () => {
    getLatestLocations.mockResolvedValue({ ok: true, locations: [location1] });
    mintWsTicket.mockResolvedValue({ ok: true, ticket: "tick-1" });

    const { result } = renderHook(() => useLiveLocations());

    await waitFor(() => expect(result.current.locations).toEqual([location1]));
    await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1));
    expect(MockWebSocket.instances[0].url).toBe("ws://localhost:3000/ws?ticket=tick-1");
  });

  it("flips to connected on open and upserts a driver's location on broadcast", async () => {
    getLatestLocations.mockResolvedValue({ ok: true, locations: [] });
    mintWsTicket.mockResolvedValue({ ok: true, ticket: "tick-1" });

    const { result } = renderHook(() => useLiveLocations());

    await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1));
    const ws = MockWebSocket.instances[0];

    act(() => ws.onopen?.());
    await waitFor(() => expect(result.current.status).toBe("connected"));

    act(() =>
      ws.onmessage?.({ data: JSON.stringify({ type: "location:broadcast", payload: location1 }) }),
    );
    await waitFor(() => expect(result.current.locations).toEqual([location1]));
  });

  it("moves a driver's marker instead of duplicating it on a second broadcast", async () => {
    getLatestLocations.mockResolvedValue({ ok: true, locations: [] });
    mintWsTicket.mockResolvedValue({ ok: true, ticket: "tick-1" });

    const { result } = renderHook(() => useLiveLocations());
    await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1));
    const ws = MockWebSocket.instances[0];

    const moved = { ...location1, lat: 14.7 };
    act(() => {
      ws.onmessage?.({ data: JSON.stringify({ type: "location:broadcast", payload: location1 }) });
      ws.onmessage?.({ data: JSON.stringify({ type: "location:broadcast", payload: moved }) });
    });

    await waitFor(() => expect(result.current.locations).toEqual([moved]));
  });

  it("sets status to error when minting the ticket fails", async () => {
    getLatestLocations.mockResolvedValue({ ok: true, locations: [] });
    mintWsTicket.mockResolvedValue({ ok: false, status: 401 });

    const { result } = renderHook(() => useLiveLocations());

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it("excludes a driver's last known location once it's older than 30s (stopped tracking)", async () => {
    const stale = { ...location1, recordedAt: new Date(Date.now() - 25_000).toISOString() };
    getLatestLocations.mockResolvedValue({ ok: true, locations: [stale] });
    mintWsTicket.mockResolvedValue({ ok: true, ticket: "tick-1" });

    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { result } = renderHook(() => useLiveLocations());

      // Still within the 30s window (25s old) — counts as online.
      await waitFor(() => expect(result.current.locations).toEqual([stale]));

      // The 5s tick pushes elapsed time past 30s with no new ping arriving —
      // this is exactly the case listLatestPerDriver() alone can't catch.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6_000);
      });
      expect(result.current.locations).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});