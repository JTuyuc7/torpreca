const CHANNEL_NAME = "torpreca:session";

// Replaces the old cross-tab "signed out elsewhere" detection, which relied
// on the `storage` event Supabase's browser SDK fired whenever it wrote the
// session to localStorage. TOR-124 removed that SDK from the browser
// entirely — the session lives in an httpOnly cookie now, invisible to JS in
// every tab, so there's nothing left to listen for. Each tab now explicitly
// announces its own sign-out instead; other tabs react to the broadcast the
// same way the old storage listener reacted to the write.
let channel: BroadcastChannel | null | undefined;

function getChannel(): BroadcastChannel | null {
  if (channel !== undefined) return channel;
  channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

export function announceSignedOut(): void {
  getChannel()?.postMessage("signed-out");
}

// A BroadcastChannel never delivers a tab's own postMessage back to itself
// (same semantics as the storage event it replaces), so this only ever
// fires for a sign-out that happened in a different tab.
export function onSignedOutElsewhere(callback: () => void): () => void {
  const ch = getChannel();
  if (!ch) return () => {};
  const listener = () => callback();
  ch.addEventListener("message", listener);
  return () => ch.removeEventListener("message", listener);
}
