import type { LucideIcon } from "lucide-react";
import { getTranslator } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n";
import { Card, EmptyState, PageHeader } from "./ui";

export async function PlaceholderPage({ title, description, icon: Icon }: { title: MessageKey; description: MessageKey; icon: LucideIcon }) {
  const { t } = await getTranslator();
  return (
    <>
      <PageHeader title={t(title)} />
      <Card>
        <EmptyState icon={<Icon size={32} aria-hidden />} title={t("placeholder.title")} body={`${t(description)} ${t("placeholder.status")}`} />
      </Card>
    </>
  );
}
