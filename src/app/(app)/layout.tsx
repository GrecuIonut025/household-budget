import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { BottomNav, SidebarNav } from "@/components/nav";
import { SetupRequired } from "@/components/setup-required";
import { ThemeToggle } from "@/components/theme-toggle";
import { getMembers, requireAppContext } from "@/lib/data/context";
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
  const members = await getMembers(ctx.active.household.id);

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[13.25rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-5 bg-sidebar p-3 text-sidebar-fg md:flex lg:p-4">
        <div className="flex items-center gap-2.5 px-2 pt-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon.svg"
            alt=""
            width={36}
            height={36}
            className="rounded-[var(--radius-sm)]"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight text-sidebar-fg">
              {t("app.name")}
            </p>
            <p className="truncate text-xs text-sidebar-muted">{t("app.tagline")}</p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-0.5">
          <SidebarNav />
        </div>

        <div className="space-y-3">
          <div className="rounded-[var(--radius-lg)] border border-sidebar-border bg-sidebar-hover/70 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
              {t("nav.yourHousehold")}
            </p>
            <p className="mt-1 truncate text-sm font-medium text-sidebar-fg">
              {ctx.active.household.name}
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <div className="flex -space-x-1.5">
                {members.slice(0, 4).map((m) => (
                  <span
                    key={m.user_id}
                    title={m.display_name}
                    className="inline-flex size-7 items-center justify-center rounded-full border-2 border-sidebar bg-brand text-[10px] font-semibold text-brand-fg"
                  >
                    {initials(m.display_name)}
                  </span>
                ))}
              </div>
              <p className="min-w-0 flex-1 truncate text-xs text-sidebar-muted">
                {t("nav.membersCount", { count: members.length })}
              </p>
              <Link
                href="/settings#members"
                className="inline-flex shrink-0 items-center rounded-full bg-sidebar px-2.5 py-1 text-[11px] font-semibold text-sidebar-fg ring-1 ring-sidebar-border transition hover:bg-sidebar-border"
              >
                {t("nav.manageHousehold")}
              </Link>
            </div>
          </div>

          <div className="flex items-center justify-between gap-1 border-t border-sidebar-border pt-2">
            <ThemeToggle compact tone="sidebar" />
            <div className="flex items-center">
              <Link
                href="/settings"
                className="inline-flex size-10 items-center justify-center rounded-[var(--radius-md)] text-sidebar-muted transition hover:bg-sidebar-hover hover:text-sidebar-fg"
                aria-label={t("nav.settings")}
              >
                <Settings size={18} aria-hidden />
              </Link>
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
        </div>
      </aside>

      <div className="min-w-0 bg-bg">
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-surface/90 px-4 py-2.5 backdrop-blur md:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon.svg"
            alt=""
            width={26}
            height={26}
            className="rounded-[var(--radius-sm)]"
          />
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">{t("app.name")}</p>
          <ThemeToggle compact />
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 pb-28 pt-5 sm:px-6 md:px-8 md:pb-10 md:pt-6">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
