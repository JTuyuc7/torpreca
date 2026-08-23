import type { Middleware } from "../http/context";

interface DeprecationOptions {
  /** When the deprecated version stops being served. */
  sunset: Date;
  /** Optional URL to a migration guide, sent as a Link header (rel="sunset"). */
  link?: string;
}

// Not wired to any route group yet — v1 is the only version. When v2 ships,
// mount this over v1's group: router.withPrefix("/api/v1", deprecated({ ... })).
// Headers follow RFC 8594 (Sunset) and the IETF draft-ietf-httpapi-deprecation-header.
export function deprecated({ sunset, link }: DeprecationOptions): Middleware {
  return async (_ctx, next) => {
    const res = await next();
    res.headers.set("Deprecation", "true");
    res.headers.set("Sunset", sunset.toUTCString());
    if (link) res.headers.set("Link", `<${link}>; rel="sunset"`);
    return res;
  };
}
