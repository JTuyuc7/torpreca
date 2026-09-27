// Where to send the user back to after logging in again post-inactivity
// (TOR-123). Base64'd on top of URI-encoding — not a security boundary,
// just keeps the destination from being legible at a glance in the address
// bar/browser history the way a plain `?returnTo=/users/42` would be.
export function encodeReturnTo(path: string): string {
  return btoa(encodeURIComponent(path));
}

export function decodeReturnTo(encoded: string | null): string | null {
  if (!encoded) return null;
  try {
    const decoded = decodeURIComponent(atob(encoded));
    return isSafeReturnPath(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

// Guards against an open redirect via a crafted `returnTo` value — only a
// same-origin relative path is ever honored.
function isSafeReturnPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("://");
}
