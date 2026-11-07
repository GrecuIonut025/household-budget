import type { Metadata } from "next";
import { Package } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("nav.products") };
}

export default function Page() {
  return <PlaceholderPage title="nav.products" description="placeholder.products" icon={Package} />;
}
