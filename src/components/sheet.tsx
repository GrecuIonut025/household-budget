"use client";

import { X } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Bottom sheet on mobile, centred dialog on larger screens.
 * Portaled to document.body with position:fixed so ancestors with
 * transform/filter/backdrop-filter (sticky blurred chrome) cannot trap it.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const titleId = useId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label={t("common.close")}
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[min(92dvh,100%)] w-full max-w-none flex-col overflow-hidden rounded-t-3xl border border-border bg-surface text-fg shadow-xl sm:max-w-lg sm:rounded-[var(--radius-lg)]"
        style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom))" }}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 pb-8 sm:pb-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id={titleId} className="text-base font-semibold tracking-tight">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              className="grid size-9 place-items-center rounded-[var(--radius-md)] text-muted hover:bg-surface-2 hover:text-fg"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
