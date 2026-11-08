import { getSupabaseEnvStatus } from "@/lib/supabase/env";
import { getTranslator } from "@/lib/i18n/server";
import { Card } from "./ui";

export async function SetupRequired() {
  const { t } = await getTranslator();
  const status = getSupabaseEnvStatus();

  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center p-6">
      <Card className="space-y-3">
        <h1 className="text-lg font-semibold">{t("setup.title")}</h1>
        <p className="text-sm text-muted">{t("setup.body")}</p>
        <ul className="space-y-1 text-sm">
          <li>
            <span className="font-medium">NEXT_PUBLIC_SUPABASE_URL:</span>{" "}
            {status.url ? t("setup.keyOk") : t("setup.keyMissing")}
          </li>
          <li>
            <span className="font-medium">NEXT_PUBLIC_SUPABASE_ANON_KEY:</span>{" "}
            {status.anonKey ? t("setup.keyOk") : t("setup.keyMissing")}
          </li>
        </ul>
        <pre className="overflow-x-auto rounded-[var(--radius-md)] bg-surface-2 p-3 text-xs">
{`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...`}
        </pre>
        <p className="text-xs text-muted">{t("setup.checklist")}</p>
      </Card>
    </main>
  );
}
