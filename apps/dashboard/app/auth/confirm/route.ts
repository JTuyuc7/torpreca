import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const appUrl = process.env.APP_URL;
if (!appUrl) throw new Error("Missing APP_URL");

// /auth/confirm is where an invite/signup confirmation email points
// (Supabase's default `{{ .ConfirmationURL }}` hits Supabase's own hosted
// /verify endpoint first, which appends the session to the redirect as a
// URL fragment; this app has no browser Supabase client to read that
// fragment with, TOR-124). Supabase's email templates must instead link
// here directly with `{{ .TokenHash }}`/`{{ .Type }}` (its documented
// SSR-friendly pattern — see the confirmation email template note in the
// dashboard's env/deploy docs), so verifyOtp can run server-side and land
// the session in the same httpOnly cookie every other route uses.
//
// The link is split across two verbs on purpose: email security scanners
// (Outlook Safe Links, Defender, corporate gateways) GET every link in a
// message before the recipient opens it, and the token is single-use — if
// GET ran verifyOtp, the scanner would burn it and the real click would
// land on "invalid or expired". So GET only forwards to a page with a
// "Continue" button; the button POSTs back here, and only that runs
// verifyOtp. Scanners don't submit forms.
//
// Redirects always build off `appUrl` (env, one value per Render service),
// never off this request's own Host header — `new URL(request.url).origin`
// reflects whatever Host a caller sends, and NextResponse.redirect requires
// an absolute URL, so trusting it would let a spoofed Host header send
// someone off this domain after a real, valid token_hash confirmation.
const confirmFailed = () => NextResponse.redirect(`${appUrl}/login?reason=confirm-failed`, 303);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (!tokenHash || !type) return confirmFailed();

  const params = new URLSearchParams({ token_hash: tokenHash, type });
  return NextResponse.redirect(`${appUrl}/auth/confirm/continue?${params}`, 303);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const tokenHash = form.get("token_hash");
  const type = form.get("type");

  if (typeof tokenHash !== "string" || typeof type !== "string" || !tokenHash || !type) {
    return confirmFailed();
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({
    type: type as EmailOtpType,
    token_hash: tokenHash,
  });

  if (error) return confirmFailed();

  // Invited users (admin/supervisor/admin invited from the dashboard)
  // have no password yet — inviteUserByEmail never asks for one — so
  // they set it here before landing in the app. A self-registered
  // driver already set theirs during mobile registration; this link
  // only confirms their email, and the dashboard isn't reachable for
  // that role anyway (CLAUDE.md role table), so it just shows a
  // confirmation message pointing them back to the app.
  const next = type === "invite" ? "/auth/set-password" : "/auth/confirmed";
  // 303 so the browser follows with a GET — NextResponse.redirect's default
  // 307 would replay this POST against the destination page.
  return NextResponse.redirect(`${appUrl}${next}`, 303);
}
