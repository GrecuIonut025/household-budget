"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n/provider";

/** Bottom sheet on mobile, centred dialog on larger screens, built on the native <dialog>. */
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
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-3xl border border-border bg-surface p-0 text-fg shadow-xl sm:m-auto sm:max-w-lg sm:rounded-[var(--radius-lg)]"
    >
      {open ? (
        <div className="p-5 pb-8 sm:pb-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
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
      ) : null}
    </dialog>
  );
}
