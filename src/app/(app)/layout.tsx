import { LogOut } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { BottomNav, SidebarNav } from "@/components/nav";
import { SetupRequired } from "@/components/setup-required";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireAppContext } from "@/lib/data/context";
import { getTranslator } from "@/lib/i18n/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!getSupabaseEnv()) return <SetupRequired />;
  const ctx = await requireAppContext();
  const { t } = await getTranslator();

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15.5rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-5 border-r border-border bg-surface p-3 md:flex lg:p-4">
        <div className="flex items-center gap-2.5 px-2 pt-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon.svg"
            alt=""
            width={32}
            height={32}
            className="rounded-[var(--radius-sm)]"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {ctx.active.household.name}
            </p>
            <p className="truncate text-xs text-muted">
              {t(`role.${ctx.active.role}`)}
            </p>
          </div>
          <ThemeToggle compact />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-0.5">
          <SidebarNav />
        </div>
        <form action={signOut} className="border-t border-border pt-3">
          <button
            type="submit"
            className="flex min-h-10 w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg"
          >
            <LogOut size={17} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-left">
              {t("auth.signOut")}
            </span>
          </button>
          <p className="mt-1 truncate px-3 text-xs text-muted">
            {ctx.user.email}
          </p>
        </form>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-surface/90 px-4 py-2.5 backdrop-blur md:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon.svg"
            alt=""
            width={26}
            height={26}
            className="rounded-[var(--radius-sm)]"
          />
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">
            {ctx.active.household.name}
          </p>
          <ThemeToggle compact />
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-7">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
