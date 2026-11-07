import { redirect } from "next/navigation";
import { SetupRequired } from "@/components/setup-required";
import { InviteAcceptForm } from "@/components/invite-accept-form";
import { getUser } from "@/lib/data/context";
import { getTranslator } from "@/lib/i18n/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  if (!getSupabaseEnv()) return <SetupRequired />;
  const { token } = await params;
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  const { t } = await getTranslator();
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-md place-items-center px-5">
      <div className="w-full space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("invite.title")}</h1>
          <p className="text-sm text-muted">{t("invite.body")}</p>
        </header>
        <InviteAcceptForm token={token} />
      </div>
    </main>
  );
}
