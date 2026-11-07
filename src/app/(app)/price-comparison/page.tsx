import type { Metadata } from "next";
import { Scale } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("nav.priceComparison") };
}

export default function Page() {
  return <PlaceholderPage title="nav.priceComparison" description="placeholder.priceComparison" icon={Scale} />;
}
