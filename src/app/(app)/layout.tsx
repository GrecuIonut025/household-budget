import Link from "next/link";
import { Bell, ChevronDown, LogOut, Search } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { BottomNav, SidebarNav } from "@/components/nav";
import { SetupRequired } from "@/components/setup-required";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireAppContext } from "@/lib/data/context";
import { getTranslator } from "@/lib/i18n/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase();
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!getSupabaseEnv()) return <SetupRequired />;
  const ctx = await requireAppContext();
  const { t } = await getTranslator();
  const firstName = ctx.displayName.trim().split(/\s+/)[0] || ctx.displayName;

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15.5rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-5 bg-sidebar p-3 text-sidebar-fg md:flex lg:p-4">
        <div className="flex items-center gap-2.5 px-2 pt-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon.svg"
            alt=""
            width={36}
            height={36}
            className="rounded-[12px]"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold tracking-tight text-sidebar-fg">
              {t("app.name")}
            </p>
            <p className="truncate text-[11px] text-sidebar-muted">{t("app.tagline")}</p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-0.5">
          <SidebarNav />
        </div>

        <div className="space-y-3">
          <ThemeToggle variant="pill" />
          <div className="flex items-center justify-between gap-1 border-t border-sidebar-border pt-2">
            <p className="min-w-0 flex-1 truncate px-1 text-[11px] text-sidebar-muted" title={ctx.user.email}>
              {ctx.active.household.name}
            </p>
            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex size-10 items-center justify-center rounded-[var(--radius-md)] text-sidebar-muted transition hover:bg-sidebar-hover hover:text-sidebar-fg"
                aria-label={t("auth.signOut")}
                title={ctx.user.email}
              >
                <LogOut size={18} aria-hidden />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="min-w-0 bg-bg">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-bg/90 px-4 py-3 backdrop-blur md:px-7">
          <div className="mx-auto flex w-full max-w-[1400px] items-center gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2 md:hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/icon.svg"
                alt=""
                width={26}
                height={26}
                className="rounded-[8px]"
              />
              <p className="min-w-0 flex-1 truncate text-sm font-semibold">{t("app.name")}</p>
            </div>

            <form action="/products" method="get" className="relative hidden min-w-0 flex-1 md:block">
              <Search
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                aria-hidden
              />
              <input
                type="search"
                name="q"
                placeholder={t("nav.searchPlaceholder")}
                aria-label={t("nav.searchPlaceholder")}
                className="h-11 w-full rounded-full border border-border bg-surface pl-10 pr-4 text-sm text-fg outline-none transition placeholder:text-muted focus:border-brand/50"
              />
            </form>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <span className="md:hidden">
                <ThemeToggle compact />
              </span>
              <details className="relative hidden sm:block">
                <summary
                  className="relative inline-flex size-10 list-none items-center justify-center rounded-full border border-border bg-surface text-muted marker:content-none [&::-webkit-details-marker]:hidden"
                  aria-label={t("dashboard.notifications")}
                >
                  <Bell size={17} aria-hidden />
                  <span className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-danger" aria-hidden />
                </summary>
                <div className="absolute right-0 z-20 mt-2 w-56 rounded-[var(--radius-md)] border border-border bg-surface p-3 text-sm text-muted shadow-[var(--shadow-card)]">
                  {t("dashboard.notificationsEmpty")}
                </div>
              </details>
              <Link
                href="/settings#preferences"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-2.5 transition hover:bg-surface-2"
              >
                <span className="inline-flex size-8 items-center justify-center rounded-full brand-gradient text-xs font-semibold text-brand-fg">
                  {initials(ctx.displayName)}
                </span>
                <span className="hidden max-w-[7rem] truncate text-sm font-medium text-fg sm:inline">
                  {firstName}
                </span>
                <ChevronDown size={14} className="hidden text-muted sm:inline" aria-hidden />
              </Link>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 pb-28 pt-5 sm:px-6 md:px-8 md:pb-10 md:pt-6">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
