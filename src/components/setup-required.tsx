import { getTranslator } from "@/lib/i18n/server";
import { Card } from "./ui";

export async function SetupRequired() {
  const { t } = await getTranslator();
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center p-6">
      <Card className="space-y-2">
        <h1 className="text-lg font-semibold">{t("setup.title")}</h1>
        <p className="text-sm text-muted">{t("setup.body")}</p>
        <pre className="overflow-x-auto rounded-[var(--radius-md)] bg-surface-2 p-3 text-xs">
{`NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...`}
        </pre>
      </Card>
    </main>
  );
}
