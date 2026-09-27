import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

// Server-only Supabase client (TOR-124) — replaces the old browser client
// (lib/supabase/client.ts, deleted). The session lives entirely in httpOnly
// cookies this client reads/writes via next/headers `cookies()`; the browser
// never gets a Supabase client of its own and never sees the JWT, closing
// the XSS-can-steal-the-token-from-localStorage gap the old setup had.
// `httpOnly: true` here is what actually makes that true — @supabase/ssr's
// own default cookie options do NOT set it, because createBrowserClient()
// normally needs to read the cookie itself. This app has no browser client,
// so nothing needs to read it except this server-side one.
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl as string, supabaseAnonKey as string, {
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // Route Handlers and Server Actions can write cookies; plain Server
        // Components can't (Next.js throws) — callers here are always the
        // former (see lib/auth/resolve-auth-user.ts and app/api/auth/*), so
        // this never actually hits that case, but the try/catch matches the
        // defensive pattern @supabase/ssr's own docs use for this callback.
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component — no-op (see comment above).
        }
      },
    },
  });
}
