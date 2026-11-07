import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("nav.mealPlanner") };
}

export default function Page() {
  return <PlaceholderPage title="nav.mealPlanner" description="placeholder.mealPlanner" icon={CalendarDays} />;
}
