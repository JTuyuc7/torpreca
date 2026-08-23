import { describe, expect, it } from "bun:test";
import { deprecated } from "./deprecation";

const ctx = { req: new Request("http://x/api/v1/routes"), params: {} };

describe("deprecated", () => {
  it("sets Deprecation and Sunset headers on the response", async () => {
    const mw = deprecated({ sunset: new Date("2027-01-01T00:00:00Z") });
    const res = await mw(ctx, async () => Response.json({ ok: true }));

    expect(res.headers.get("Deprecation")).toBe("true");
    expect(res.headers.get("Sunset")).toBe("Fri, 01 Jan 2027 00:00:00 GMT");
    expect(res.headers.has("Link")).toBe(false);
  });

  it("adds a Link header with rel=sunset when a migration link is given", async () => {
    const mw = deprecated({
      sunset: new Date("2027-01-01T00:00:00Z"),
      link: "https://docs.torpreca.dev/migrating-to-v2",
    });
    const res = await mw(ctx, async () => Response.json({ ok: true }));

    expect(res.headers.get("Link")).toBe(
      '<https://docs.torpreca.dev/migrating-to-v2>; rel="sunset"',
    );
  });
});
