import type { Metadata } from "next";
import { ChefHat } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("nav.recipes") };
}

export default function Page() {
  return <PlaceholderPage title="nav.recipes" description="placeholder.recipes" icon={ChefHat} />;
}
