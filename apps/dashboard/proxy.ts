import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// TOR-124: `middleware.ts` was renamed to `proxy.ts` in Next.js 16 (same
// runtime, same file conventions — just `proxy` instead of `middleware` as
// the exported function name). Next's own docs are explicit that Proxy must
// stay an *optimistic* check only — "should not be used as a full session
// management or authorization solution" — so this only redirects based on
// whether a session cookie decodes to a user, never touches this app's own
// backend/DB. The real per-request authorization still happens in every
// Route Handler (lib/auth/server-access-token.ts) and in the protected
// layout's own GET /api/auth/session call.
//
// It still calls supabase.auth.getUser() (a real round trip to Supabase
// Auth), not the cheaper local-decode getSession() — with no browser-side
// Supabase client left to refresh tokens on its own (TOR-124 removed it),
// this is the only place in the app that keeps a long-lived browsing session
// alive by writing a refreshed access/refresh token pair back to the cookie
// before it expires. getSession() alone wouldn't do that.
const PUBLIC_PATHS = ["/login"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.includes(request.nextUrl.pathname);

  if (!user && !isPublicPath) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isPublicPath) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

// /api is excluded on purpose: every Route Handler under app/api/* resolves
// and checks the session itself (it needs the real access token, not just
// "is there a user"), so an optimistic redirect here would just be a second,
// redundant check — not a gap. See the file-level comment above.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
