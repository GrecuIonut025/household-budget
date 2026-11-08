import { notFound } from "next/navigation";
import { ForceDark } from "@/components/dashboard/force-dark";

/** Dev-only note: Comparare browse is client-driven via /api/glovo/catalog. */
export default function VisualGlovoPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="min-h-dvh bg-bg px-4 py-6 text-fg sm:px-8">
      <ForceDark />
      <div className="mx-auto max-w-3xl space-y-3">
        <h1 className="text-xl font-bold">Glovo browse preview</h1>
        <p className="text-sm text-muted">
          Open <code className="text-fg">/price-comparison</code> while signed in — catalog loads once
          from <code className="text-fg">/api/glovo/catalog</code>, then category/search/pagination stay
          on the client (&lt;300ms).
        </p>
      </div>
    </div>
  );
}
