"use client";

import { ShoppingBag, X } from "lucide-react";
import { useMemo, useState } from "react";
import { buttonClass } from "@/components/ui";
import {
  formatCartChecklist,
  openGlovoCartHandoff,
  type CartLine,
} from "@/lib/glovo/deep-links";

type OrderLabels = {
  prepareOrder: string;
  itemsCount: string;
  openInGlovo: string;
  clearCart: string;
  copyList: string;
  copied: string;
  handoffNote: string;
  emptyCart: string;
};

export function useGlovoCart() {
  const [lines, setLines] = useState<CartLine[]>([]);

  const add = (line: Omit<CartLine, "qty">) => {
    setLines((prev) => {
      // Switching market clears other retailers' lines (one Glovo store cart).
      const sameStore = prev.filter((p) => p.retailer === line.retailer);
      const base = sameStore.length === prev.length ? prev : [];
      const existing = base.find((p) => p.id === line.id);
      if (existing) {
        return base.map((p) => (p.id === line.id ? { ...p, qty: p.qty + 1 } : p));
      }
      return [...base, { ...line, qty: 1 }];
    });
  };

  const setQty = (id: string, qty: number) => {
    setLines((prev) =>
      prev
        .map((p) => (p.id === id ? { ...p, qty } : p))
        .filter((p) => p.qty > 0),
    );
  };

  const clear = () => setLines([]);

  const totalQty = useMemo(() => lines.reduce((n, l) => n + l.qty, 0), [lines]);

  return { lines, add, setQty, clear, totalQty };
}

export function GlovoOrderBar({
  lines,
  totalQty,
  labels,
  onClear,
  onSetQty,
}: {
  lines: CartLine[];
  totalQty: number;
  labels: OrderLabels;
  onClear: () => void;
  onSetQty: (id: string, qty: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (totalQty === 0) return null;

  const storeSlug = lines[0]?.storeSlug;
  const checklist = formatCartChecklist(lines);

  const prepare = async () => {
    setOpen(true);
    try {
      await navigator.clipboard.writeText(checklist);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may be denied — still open sheet
    }
  };

  const openGlovo = () => {
    if (!storeSlug || lines.length === 0) return;
    openGlovoCartHandoff(lines);
  };

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-3">
        <button
          type="button"
          onClick={() => void prepare()}
          className="pointer-events-auto btn-gradient flex min-h-12 w-full max-w-lg items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg touch-manipulation"
        >
          <span className="inline-flex items-center gap-2">
            <ShoppingBag size={18} aria-hidden />
            {labels.prepareOrder}
          </span>
          <span className="rounded-full bg-white/20 px-2.5 py-0.5 tabular-nums">
            {labels.itemsCount.replace("{count}", String(totalQty))}
          </span>
        </button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={labels.prepareOrder}
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-surface p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-fg">{labels.prepareOrder}</h2>
              <button
                type="button"
                className={`${buttonClass("ghost")} inline-flex size-10 items-center justify-center touch-manipulation`}
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mb-3 text-xs text-muted">{labels.handoffNote}</p>
            <ul className="mb-4 divide-y divide-border rounded-2xl border border-border">
              {lines.map((line) => (
                <li key={line.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-2">
                    {line.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={line.imageUrl}
                        alt=""
                        className="size-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <ShoppingBag size={16} className="text-muted" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium text-fg">{line.name}</p>
                    {line.priceDisplay ? (
                      <p className="text-xs text-muted">{line.priceDisplay}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className={`${buttonClass("secondary")} !min-h-9 !px-2 touch-manipulation`}
                      onClick={() => onSetQty(line.id, line.qty - 1)}
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm tabular-nums">{line.qty}</span>
                    <button
                      type="button"
                      className={`${buttonClass("secondary")} !min-h-9 !px-2 touch-manipulation`}
                      onClick={() => onSetQty(line.id, line.qty + 1)}
                    >
                      +
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {lines.length === 0 ? (
              <p className="mb-3 text-sm text-muted">{labels.emptyCart}</p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className={`${buttonClass("primary")} flex-1 touch-manipulation`}
                onClick={openGlovo}
                disabled={!storeSlug || lines.length === 0}
              >
                {labels.openInGlovo}
              </button>
              <button
                type="button"
                className={`${buttonClass("secondary")} touch-manipulation`}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(checklist);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    /* ignore */
                  }
                }}
              >
                {copied ? labels.copied : labels.copyList}
              </button>
              <button
                type="button"
                className={`${buttonClass("ghost")} touch-manipulation`}
                onClick={onClear}
              >
                {labels.clearCart}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
