// Torpreca operates in Guatemala (UTC-6, no DST). A route's `date` is the
// calendar day in that timezone, not in UTC — `new Date().toISOString()`
// flips to "tomorrow" at 18:00 local, so a route created in the evening got
// tomorrow's date and the driver app (which queries by the phone's local
// date) never found it (TOR-136).
export const BUSINESS_TIMEZONE = "America/Guatemala";

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** `yyyy-MM-dd` for [date] (default: now) in the business timezone. */
export function businessDate(date: Date = new Date()): string {
  return formatter.format(date);
}

// Fixed offset is safe: Guatemala has no DST.
const BUSINESS_UTC_OFFSET = "-06:00";

/**
 * The instant a business day ends — the following local midnight. Used to
 * cap the kilometers of a route that was closed days after its own date, so
 * the GPS pings of the days in between aren't counted against it.
 */
export function endOfBusinessDay(date: string): Date {
  const start = new Date(`${date}T00:00:00${BUSINESS_UTC_OFFSET}`);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}
