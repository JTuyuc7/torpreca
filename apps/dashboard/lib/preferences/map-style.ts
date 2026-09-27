import { MAP_STYLES, type MapStyleValue } from "@/lib/map/styles";

const KEY = "torpreca:map-style";
const DEFAULT_STYLE: MapStyleValue = MAP_STYLES[0].value;

// Global map style preference, shared by every map in the dashboard —
// changed today from the style picker on Panel principal, the only place
// that currently exposes it. TODO(TOR-131): move this into a real Settings
// screen instead of a picker embedded in Panel principal.
//
// localStorage (not a backend setting): same per-viewer-convenience
// reasoning as lib/preferences/sidebar.ts — which map tiles you'd rather
// look at isn't shared team data.
export function readStoredMapStyle(): MapStyleValue {
  if (typeof window === "undefined") return DEFAULT_STYLE;
  const stored = window.localStorage.getItem(KEY);
  return (MAP_STYLES as readonly { value: string }[]).some((s) => s.value === stored)
    ? (stored as MapStyleValue)
    : DEFAULT_STYLE;
}

export function writeStoredMapStyle(style: MapStyleValue): void {
  window.localStorage.setItem(KEY, style);
}
