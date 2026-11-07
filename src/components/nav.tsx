"use client";

import clsx from "clsx";
import { Ellipsis } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { isActive, NAV_GROUPS, NAV_ITEMS } from "@/lib/nav";
import { Sheet } from "./sheet";

export function SidebarNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const items = NAV_ITEMS.filter((item) => !item.href.includes("#"));

  return (
    <nav aria-label={t("nav.primary")} className="flex flex-col gap-1">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex min-h-11 items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm font-medium transition",
              active
                ? "bg-brand text-brand-fg shadow-[0_8px_24px_-12px_var(--brand)]"
                : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg",
            )}
          >
            <Icon size={18} aria-hidden strokeWidth={active ? 2.25 : 2} />
            {t(item.label)}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const [moreOpen, setMoreOpen] = useState(false);
  const primary = NAV_ITEMS.filter((i) => i.primary && !i.href.includes("#"));
  const secondary = NAV_ITEMS.filter((i) => !i.primary);
  const secondaryActive = secondary.some((i) => isActive(pathname, i.href));

  const tab = (active: boolean) =>
    clsx(
      "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium transition",
      active ? "text-brand-strong" : "text-muted",
    );

  return (
    <>
      <nav
        aria-label={t("nav.primary")}
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface/95 backdrop-blur md:hidden"
      >
        {primary.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={tab(active)}
            >
              <Icon size={22} aria-hidden strokeWidth={active ? 2.4 : 2} />
              <span className="max-w-full truncate">{t(item.label)}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={tab(secondaryActive)}
          aria-haspopup="dialog"
        >
          <Ellipsis size={22} aria-hidden />
          <span>{t("nav.more")}</span>
        </button>
      </nav>
      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title={t("nav.more")}>
        <div className="grid gap-5">
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter((i) => !i.primary);
            if (items.length === 0) return null;
            return (
              <div key={group.id}>
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted/80">
                  {t(group.label)}
                </p>
                <ul className="grid gap-0.5">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(pathname, item.href);
                    return (
                      <li key={`${item.href}-${item.label}`}>
                        <Link
                          href={item.href}
                          onClick={() => setMoreOpen(false)}
                          aria-current={active ? "page" : undefined}
                          className={clsx(
                            "flex min-h-12 items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm font-medium",
                            active ? "bg-brand-soft text-brand-strong" : "hover:bg-surface-2",
                          )}
                        >
                          <Icon size={18} aria-hidden className={active ? undefined : "text-muted"} />
                          {t(item.label)}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}
