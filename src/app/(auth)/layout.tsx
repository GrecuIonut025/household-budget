import { SetupRequired } from "@/components/setup-required";
import { getTranslator } from "@/lib/i18n/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (!getSupabaseEnv()) return <SetupRequired />;
  const { t } = await getTranslator();

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(124,58,237,0.18),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(6,182,212,0.08),_transparent_50%)]"
      />
      <div className="mb-8 flex items-center gap-3">
        <div className="relative size-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-emerald-400 p-0.5 shadow-lg shadow-indigo-600/30 ring-1 ring-white/20">
          <div className="flex size-full items-center justify-center overflow-hidden rounded-[14px] bg-sidebar p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon.svg" alt="" width={36} height={36} className="object-contain" />
          </div>
        </div>
        <div>
          <p className="text-lg font-bold tracking-tight text-fg">{t("app.name")}</p>
          <p className="text-[11px] font-medium text-muted">{t("app.tagline")}</p>
        </div>
      </div>
      <div className="dashboard-card p-5 sm:p-6">{children}</div>
    </main>
  );
}
