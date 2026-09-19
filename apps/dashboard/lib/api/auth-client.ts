import type { AuthUser } from "@torpreca/shared";

// Browser-side calls to this app's own /api/auth/* BFF route handlers.
// TOR-124: none of these take or send a token anymore — the session lives in
// an httpOnly cookie the browser can't read, and same-origin fetch() sends
// it automatically. login()/logout() also stopped taking an access token for
// the same reason: signInWithPassword/signOut now happen entirely inside the
// route handlers (lib/supabase/server.ts), not in the browser.

export type AuthResult = { ok: true; user: AuthUser } | { ok: false; status: number };

// `status: 0` marks a network-level failure — the request never got a real
// HTTP response, or the body couldn't be parsed as JSON despite `res.ok`
// (e.g. a proxy layer mangling Content-Encoding — see passthroughResponse()
// in lib/backend/signed-fetch.ts for a real instance of this). Without this
// try/catch, that kind of failure was an uncaught exception that left the
// login button stuck on "Ingresando..." forever with no visible error.
async function parseAuthResponse(res: Response): Promise<AuthResult> {
  if (!res.ok) return { ok: false, status: res.status };
  try {
    const user = (await res.json()) as AuthUser;
    return { ok: true, user };
  } catch {
    return { ok: false, status: 0 };
  }
}

export async function login(email: string, password: string): Promise<AuthResult> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return await parseAuthResponse(res);
  } catch {
    return { ok: false, status: 0 };
  }
}

export async function verifySession(): Promise<AuthResult> {
  try {
    const res = await fetch("/api/auth/session");
    return await parseAuthResponse(res);
  } catch {
    return { ok: false, status: 0 };
  }
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
}
