import { useEffect, useRef } from "react";

const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll"] as const;

// TOR-123: Supabase's refresh token doesn't expire on its own by inactivity
// (lasts weeks), so a dashboard tab left open stays "logged in" indefinitely
// without this. `onTimeout` fires once after `timeoutMs` with none of the
// events above; any of them resets the clock.
export function useInactivityTimeout(
  timeoutMs: number,
  onTimeout: () => void,
  enabled = true,
): void {
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout>;
    function reset() {
      clearTimeout(timer);
      timer = setTimeout(() => onTimeoutRef.current(), timeoutMs);
    }

    reset();
    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, reset, { passive: true });

    return () => {
      clearTimeout(timer);
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, reset);
    };
  }, [timeoutMs, enabled]);
}
