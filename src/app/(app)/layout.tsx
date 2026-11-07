import { LogOut } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { BottomNav, SidebarNav } from "@/components/nav";
import { SetupRequired } from "@/components/setup-required";
import { requireAppContext } from "@/lib/data/context";
import { getTranslator } from "@/lib/i18n/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!getSupabaseEnv()) return <SetupRequired />;
  const ctx = await requireAppContext();
  const { t } = await getTranslator();

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-border bg-surface p-4 md:flex">
        <div className="flex items-center gap-3 px-2 pt-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon.svg" alt="" width={36} height={36} className="rounded-lg" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{ctx.active.household.name}</p>
            <p className="truncate text-xs text-muted">{t(`role.${ctx.active.role}`)}</p>
          </div>
        </div>
        <SidebarNav />
        <form action={signOut} className="mt-auto">
          <button type="submit" className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg">
            <LogOut size={18} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-left">{t("auth.signOut")}</span>
          </button>
          <p className="mt-1 truncate px-3 text-xs text-muted">{ctx.user.email}</p>
        </form>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-surface/90 px-4 py-3 backdrop-blur md:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon.svg" alt="" width={28} height={28} className="rounded-md" />
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">{ctx.active.household.name}</p>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
