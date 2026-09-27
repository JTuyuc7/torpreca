import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useInactivityTimeout } from "./use-inactivity-timeout";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useInactivityTimeout", () => {
  it("fires onTimeout after timeoutMs with no activity", () => {
    const onTimeout = vi.fn();
    renderHook(() => useInactivityTimeout(1000, onTimeout));

    vi.advanceTimersByTime(999);
    expect(onTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("resets the clock on activity, so it never fires while the user is active", () => {
    const onTimeout = vi.fn();
    renderHook(() => useInactivityTimeout(1000, onTimeout));

    vi.advanceTimersByTime(700);
    window.dispatchEvent(new Event("mousedown"));
    vi.advanceTimersByTime(700);
    expect(onTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("never fires when disabled", () => {
    const onTimeout = vi.fn();
    renderHook(() => useInactivityTimeout(1000, onTimeout, false));

    vi.advanceTimersByTime(5000);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("stops the timer on unmount", () => {
    const onTimeout = vi.fn();
    const { unmount } = renderHook(() => useInactivityTimeout(1000, onTimeout));

    unmount();
    vi.advanceTimersByTime(5000);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
