import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { RecipeEditor } from "@/components/recipes/recipe-editor";
import { requireAppContext } from "@/lib/data/context";
import { getProductOptions } from "@/lib/data/recipes";
import { canWrite } from "@/lib/data/types";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("recipes.new") };
}

export default async function NewRecipePage() {
  const ctx = await requireAppContext();
  if (!canWrite(ctx.active.role)) redirect("/recipes");
  const { t } = await getTranslator();
  const products = await getProductOptions(ctx.active.household.id);

  return (
    <>
      <PageHeader title={t("recipes.new")} />
      <RecipeEditor householdId={ctx.active.household.id} recipeId={crypto.randomUUID()} recipe={null} imageUrl={null} products={products} />
    </>
  );
}
