"use client";

import { Link2, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { ProductOption } from "@/lib/recipes/types";
import { inputClass } from "@/components/ui";

const MAX_RESULTS = 8;

export function ProductPicker({
  products,
  value,
  onChange,
  label,
}: {
  products: ProductOption[];
  value: string | null;
  onChange: (product: ProductOption | null) => void;
  label: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = value ? products.find((p) => p.id === value) : undefined;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? products.filter((p) => `${p.name} ${p.brand ?? ""}`.toLowerCase().includes(q)) : products;
    return list.slice(0, MAX_RESULTS);
  }, [products, query]);

  if (selected && !open) {
    return (
      <div className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-border bg-surface-2 px-3 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <Link2 size={14} className="shrink-0 text-brand" aria-hidden />
          <span className="truncate font-medium">
            {selected.name}
            {selected.brand ? <span className="font-normal text-muted"> · {selected.brand}</span> : null}
          </span>
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={t("recipes.editor.unlinkProduct")}
          className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 w-full items-center gap-2 rounded-xl border border-dashed border-border px-3 text-sm text-muted hover:bg-surface-2 hover:text-fg"
      >
        <Link2 size={14} aria-hidden />
        {t("recipes.editor.linkProduct")}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-2">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <input
          autoFocus
          type="search"
          aria-label={label}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("recipes.editor.searchProducts")}
          className={`${inputClass} pl-9`}
        />
      </div>
      {products.length === 0 ? (
        <p className="px-2 py-3 text-sm text-muted">{t("recipes.editor.noProducts")}</p>
      ) : results.length === 0 ? (
        <p className="px-2 py-3 text-sm text-muted">{t("recipes.editor.noMatches")}</p>
      ) : (
        <ul className="mt-1">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(p);
                  setOpen(false);
                  setQuery("");
                }}
                className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-2 text-left text-sm hover:bg-surface-2"
              >
                <span className="truncate">{p.name}</span>
                {p.brand ? <span className="shrink-0 text-xs text-muted">{p.brand}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setQuery("");
        }}
        className="mt-1 min-h-10 w-full rounded-lg text-sm text-muted hover:bg-surface-2"
      >
        {t("common.cancel")}
      </button>
    </div>
  );
}
