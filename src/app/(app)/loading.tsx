/** Instant partial-prefetch shell for dynamic app routes (see Next.js linking docs). */
export default function AppLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-surface-2" />
      <div className="h-4 w-72 max-w-full animate-pulse rounded bg-surface-2" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="h-28 animate-pulse rounded-[var(--radius-lg)] bg-surface-2" />
        <div className="h-28 animate-pulse rounded-[var(--radius-lg)] bg-surface-2" />
        <div className="h-28 animate-pulse rounded-[var(--radius-lg)] bg-surface-2" />
        <div className="h-28 animate-pulse rounded-[var(--radius-lg)] bg-surface-2" />
      </div>
    </div>
  );
}
