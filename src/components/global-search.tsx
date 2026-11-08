"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

/** Dashboard header search — navigates to Produse (or Rețete when prefixed). */
export function GlobalSearch({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    if (!query) {
      router.push("/products");
      return;
    }
    const lower = query.toLowerCase();
    if (lower.startsWith("rețet") || lower.startsWith("retet") || lower.startsWith("recipe")) {
      const rest = query.replace(/^(rețete?|retete?|recipes?)\s*/i, "").trim();
      router.push(rest ? `/recipes?q=${encodeURIComponent(rest)}` : "/recipes");
      return;
    }
    router.push(`/products?q=${encodeURIComponent(query)}`);
  };

  return (
    <form onSubmit={onSubmit} role="search" className="relative w-full max-w-xl">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-muted">
        <Search size={16} aria-hidden />
      </span>
      <input
        type="search"
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label={placeholder}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-2xl border border-border bg-surface py-2.5 pl-11 pr-4 text-sm text-fg shadow-inner placeholder:text-muted/80 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
      />
    </form>
  );
}
