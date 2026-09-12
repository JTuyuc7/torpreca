// Shimmer placeholder — used instead of a spinner for content that has a
// predictable shape (table rows, cards), so the page occupies roughly the
// same height before/after loading and avoids the pop-in layout shift a
// centered spinner causes once real content replaces it.
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-outline/15 ${className}`} />;
}