import { redirect } from "next/navigation";
import { ContinueForm } from "./continue-form";

// Landing page for GET /auth/confirm — see the note in ../route.ts for why
// the token isn't verified until the button on this page is pressed.
export default async function ConfirmContinuePage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const { token_hash: tokenHash, type } = await searchParams;

  if (!tokenHash || !type) redirect("/login?reason=confirm-failed");

  return <ContinueForm tokenHash={tokenHash} type={type} />;
}
