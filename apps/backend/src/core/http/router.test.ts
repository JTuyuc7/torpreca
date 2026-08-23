import { describe, expect, it } from "bun:test";
import { Router } from "./router";

describe("Router.withPrefix", () => {
  it("mounts routes under the given prefix", async () => {
    const router = new Router();
    const v1 = router.withPrefix("/api/v1");
    v1.get("/ping", () => Response.json({ pong: true }));

    const res = await router.handle(new Request("http://x/api/v1/ping"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pong: true });

    const unprefixed = await router.handle(new Request("http://x/ping"));
    expect(unprefixed.status).toBe(404);
  });

  it("keeps params working through the prefix", async () => {
    const router = new Router();
    const v1 = router.withPrefix("/api/v1");
    v1.get("/items/:id", (ctx) => Response.json({ id: ctx.params.id }));

    const res = await router.handle(new Request("http://x/api/v1/items/42"));
    expect(await res.json()).toEqual({ id: "42" });
  });

  it("runs extra middlewares before the route's own middlewares", async () => {
    const router = new Router();
    const order: string[] = [];
    const tagA: import("./context").Middleware = async (_ctx, next) => {
      order.push("extra");
      return next();
    };
    const tagB: import("./context").Middleware = async (_ctx, next) => {
      order.push("own");
      return next();
    };

    const v1 = router.withPrefix("/api/v1", tagA);
    v1.get("/tagged", tagB, () => Response.json({ order }));

    await router.handle(new Request("http://x/api/v1/tagged"));
    expect(order).toEqual(["extra", "own"]);
  });
});
