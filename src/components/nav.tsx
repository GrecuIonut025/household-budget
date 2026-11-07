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
  return (
    <nav aria-label={t("nav.primary")} className="flex flex-col gap-4">
      {NAV_GROUPS.map((group) => {
        const GroupIcon = group.icon;
        const groupActive = group.href ? isActive(pathname, group.href) : false;

        if (group.href && GroupIcon) {
          return (
            <div key={group.id}>
              <Link
                href={group.href}
                aria-current={groupActive ? "page" : undefined}
                className={clsx(
                  "flex min-h-10 items-center gap-2.5 rounded-[var(--radius-md)] px-3 text-sm font-semibold transition",
                  groupActive
                    ? "bg-brand text-brand-fg"
                    : "text-sidebar-fg/90 hover:bg-sidebar-hover hover:text-sidebar-fg",
                )}
              >
                <GroupIcon size={17} aria-hidden strokeWidth={groupActive ? 2.25 : 2} />
                {t("nav.dashboardHome")}
              </Link>
              <ul className="mt-1.5 flex flex-col gap-0.5 pl-2">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={`${item.href}-${item.label}`}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={clsx(
                          "flex min-h-9 items-center rounded-full px-3 text-[13px] font-medium transition",
                          active
                            ? "bg-brand-soft text-brand-strong"
                            : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg",
                        )}
                      >
                        {t(item.label)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        }

        return (
          <div key={group.id}>
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
              {t(group.label)}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={`${item.href}-${item.label}`}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={clsx(
                        "flex min-h-10 items-center gap-2.5 rounded-[var(--radius-md)] px-3 text-sm font-medium transition",
                        active
                          ? "bg-brand-soft text-brand-strong"
                          : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg",
                      )}
                    >
                      <Icon size={17} aria-hidden strokeWidth={active ? 2.25 : 2} />
                      {t(item.label)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
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
