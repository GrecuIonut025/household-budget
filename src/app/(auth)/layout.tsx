import { SetupRequired } from "@/components/setup-required";
import { getSupabaseEnv } from "@/lib/supabase/env";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (!getSupabaseEnv()) return <SetupRequired />;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-8 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon.svg" alt="" width={44} height={44} className="rounded-[var(--radius-md)]" />
      </div>
      {children}
    </main>
  );
}
