import { WifiOff } from "lucide-react";
import { getTranslator } from "@/lib/i18n/server";

export default async function OfflinePage() {
  const { t } = await getTranslator();
  return (
    <main className="mx-auto grid min-h-dvh max-w-sm place-items-center p-6 text-center">
      <div className="space-y-3">
        <WifiOff className="mx-auto text-muted" size={40} aria-hidden />
        <h1 className="text-xl font-semibold">{t("offline.title")}</h1>
        <p className="text-sm text-muted">{t("offline.body")}</p>
      </div>
    </main>
  );
}
