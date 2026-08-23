import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

// zod v4 bakes `.optional`/`.pick`/etc-style methods onto each schema instance
// at construction time, so a method added to `ZodType.prototype` later does
// NOT retroactively apply to schemas already built. extendZodWithOpenApi()
// must therefore run before any `z.object(...)` in this package — this
// module is imported first (see index.ts) precisely to guarantee that, and
// every schema file imports `z` from here instead of "zod" directly so the
// backend's OpenAPI registry can call `.register()`/`.openapi()` on them.
extendZodWithOpenApi(z);

export { z };
