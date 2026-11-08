import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { BottomNav, SidebarNav } from "@/components/nav";
import { NotificationsBell } from "@/components/notifications/bell";
import { SetupRequired } from "@/components/setup-required";
import { ThemeToggle } from "@/components/theme-toggle";
import { getNotifications } from "@/lib/data/community";
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
  const notifications = await getNotifications(ctx.user.id, 20).catch(() => ({
    items: [],
    unreadCount: 0,
  }));

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_1fr]">
      <aside className="sticky top-0 z-30 hidden h-dvh flex-col justify-between border-r border-sidebar-border bg-sidebar p-5 text-sidebar-fg md:flex">
        <div className="flex min-h-0 flex-1 flex-col gap-7">
          <div className="flex items-center gap-3 px-1 pt-1">
            <div className="relative size-11 shrink-0 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-emerald-400 p-0.5 shadow-lg shadow-indigo-600/30 ring-1 ring-white/20">
              <div className="flex size-full items-center justify-center overflow-hidden rounded-[14px] bg-sidebar p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icons/icon.svg"
                  alt=""
                  width={36}
                  height={36}
                  className="size-full object-contain drop-shadow-md"
                />
              </div>
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold leading-tight tracking-tight text-white">
                {t("app.name")}
              </p>
              <p className="truncate text-[11px] font-medium tracking-tight text-sidebar-muted">
                {t("app.tagline")}
              </p>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <SidebarNav />
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-4">
          <div className="relative overflow-hidden rounded-2xl border border-[#232a48] bg-gradient-to-b from-[#181d33] to-[#121626] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
              {t("nav.yourHousehold")}
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-white">
              {ctx.active.household.name}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex -space-x-2">
                {members.slice(0, 4).map((m) => (
                  <span
                    key={m.user_id}
                    title={m.display_name}
                    className="inline-flex size-7 items-center justify-center rounded-full bg-brand text-[10px] font-semibold text-brand-fg ring-2 ring-[#121626]"
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
                className="inline-flex shrink-0 items-center rounded-xl bg-sidebar px-2.5 py-1 text-[11px] font-semibold text-sidebar-fg ring-1 ring-sidebar-border transition hover:bg-sidebar-hover"
              >
                {t("nav.manageHousehold")}
              </Link>
            </div>
          </div>

          <ThemeToggle variant="pill" />

          <div className="flex items-center justify-center gap-1">
            <NotificationsBell
              items={notifications.items}
              unreadCount={notifications.unreadCount}
              compact
            />
            <Link
              href="/settings"
              className="inline-flex size-10 items-center justify-center rounded-2xl text-sidebar-muted transition hover:bg-sidebar-hover hover:text-sidebar-fg"
              aria-label={t("nav.settings")}
            >
              <Settings size={18} aria-hidden />
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex size-10 items-center justify-center rounded-2xl text-sidebar-muted transition hover:bg-sidebar-hover hover:text-sidebar-fg"
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
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-surface/90 px-4 py-2.5 backdrop-blur md:hidden">
          <div className="relative size-8 shrink-0 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-emerald-400 p-0.5">
            <div className="flex size-full items-center justify-center overflow-hidden rounded-[10px] bg-sidebar p-0.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/icon.svg" alt="" width={24} height={24} />
            </div>
          </div>
          <p className="min-w-0 flex-1 truncate text-sm font-bold">{t("app.name")}</p>
          <NotificationsBell
            items={notifications.items}
            unreadCount={notifications.unreadCount}
          />
          <ThemeToggle compact />
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 pb-28 pt-5 sm:px-6 md:px-7 md:pb-10 md:pt-7">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
