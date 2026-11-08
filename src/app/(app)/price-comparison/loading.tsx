export default function PriceComparisonLoading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-surface-2" />
      <div className="h-36 animate-pulse rounded-[var(--radius-lg)] bg-surface-2" />
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="h-20 animate-pulse rounded-[var(--radius-lg)] bg-surface-2" />
        <div className="h-20 animate-pulse rounded-[var(--radius-lg)] bg-surface-2" />
      </div>
    </div>
  );
}
