import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/ui";
import { RecipeEditor } from "@/components/recipes/recipe-editor";
import { requireAppContext } from "@/lib/data/context";
import { getImageUrls, getProductOptions, getRecipe } from "@/lib/data/recipes";
import { canWrite } from "@/lib/data/types";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("recipes.edit") };
}

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) notFound();

  const ctx = await requireAppContext();
  const { household, role } = ctx.active;
  if (!canWrite(role)) redirect(`/recipes/${parsed.data}`);

  const { t } = await getTranslator();
  const recipe = await getRecipe(household.id, parsed.data);
  if (!recipe) notFound();
  const [products, urls] = await Promise.all([getProductOptions(household.id), getImageUrls([recipe.image_path])]);

  return (
    <>
      <PageHeader title={t("recipes.edit")} />
      <RecipeEditor
        householdId={household.id}
        recipeId={recipe.id}
        recipe={recipe}
        imageUrl={recipe.image_path ? (urls[recipe.image_path] ?? null) : null}
        products={products}
      />
    </>
  );
}
