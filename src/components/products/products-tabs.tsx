import clsx from "clsx";
import Link from "next/link";
import type { Translate } from "@/lib/i18n";

export function ProductsTabs({ active, t }: { active: "catalogue" | "rankings"; t: Translate }) {
  const tab = "flex min-h-11 flex-1 items-center justify-center rounded-lg px-3 text-sm font-medium transition";
  return (
    <nav aria-label={t("products.title")} className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
      <Link
        href="/products"
        aria-current={active === "catalogue" ? "page" : undefined}
        className={clsx(tab, active === "catalogue" ? "bg-surface text-fg shadow-sm" : "text-muted")}
      >
        {t("products.tabCatalogue")}
      </Link>
      <Link
        href="/products/rankings"
        aria-current={active === "rankings" ? "page" : undefined}
        className={clsx(tab, active === "rankings" ? "bg-surface text-fg shadow-sm" : "text-muted")}
      >
        {t("products.tabRankings")}
      </Link>
    </nav>
  );
}
