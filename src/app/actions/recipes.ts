"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/form-state";
import { describeDbError, getActionTranslator } from "@/lib/actions";
import { RECIPE_MEDIA_BUCKET } from "@/lib/data/recipes";
import { recipePayloadSchema } from "@/lib/recipes/schema";
import { createClient } from "@/lib/supabase/server";

function toRpcPayload(p: z.infer<typeof recipePayloadSchema>) {
  return {
    recipe: {
      id: p.id,
      title: p.title,
      description: p.description,
      servings: p.servings,
      prep_minutes: p.prepMinutes,
      cook_minutes: p.cookMinutes,
      instructions: p.instructions,
      category: p.category,
      tags: p.tags,
      image_path: p.imagePath,
      source_url: p.sourceUrl,
    },
    ingredients: p.ingredients.map((i) => ({
      product_id: i.productId,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      is_optional: i.isOptional,
      is_at_home: i.isAtHome,
      note: i.note,
      substitutions: i.substitutions.map((s) => ({
        product_id: s.productId,
        name: s.name,
        quantity: s.quantity,
        unit: s.unit,
        note: s.note,
      })),
    })),
  };
}

async function removePhoto(path: string | null | undefined, householdId: string) {
  if (!path || !path.startsWith(`${householdId}/`)) return;
  const supabase = await createClient();
  await supabase.storage.from(RECIPE_MEDIA_BUCKET).remove([path]);
}

export async function saveRecipe(_: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getActionTranslator();
  const raw = formData.get("payload");
  if (typeof raw !== "string") return { error: t("common.errorGeneric") };

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { error: t("common.errorGeneric") };
  }
  const parsed = recipePayloadSchema.safeParse(json);
  if (!parsed.success) return { error: t("recipes.error.invalid") };
  const payload = parsed.data;
  if (payload.imagePath && !payload.imagePath.startsWith(`${payload.householdId}/`)) {
    return { error: t("recipes.error.invalid") };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("recipes")
    .select("image_path")
    .eq("household_id", payload.householdId)
    .eq("id", payload.id)
    .maybeSingle();

  const { recipe, ingredients } = toRpcPayload(payload);
  const { error } = await supabase.rpc("save_recipe", {
    p_household_id: payload.householdId,
    p_recipe: recipe,
    p_ingredients: ingredients,
  });
  if (error) return { error: describeDbError(error, t, { "23514": t("recipes.error.invalid"), "23503": t("recipes.error.invalid") }) };

  if (existing?.image_path && existing.image_path !== payload.imagePath) {
    await removePhoto(existing.image_path, payload.householdId);
  }
  revalidatePath("/recipes", "layout");
  redirect(`/recipes/${payload.id}`);
}

const idSchema = z.object({ id: z.uuid(), householdId: z.uuid() });

export async function deleteRecipe(formData: FormData): Promise<void> {
  const parsed = idSchema.safeParse({ id: formData.get("id"), householdId: formData.get("householdId") });
  if (!parsed.success) return;
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("recipes")
    .select("image_path")
    .eq("household_id", parsed.data.householdId)
    .eq("id", parsed.data.id)
    .maybeSingle();
  const { data, error } = await supabase.from("recipes").delete().eq("id", parsed.data.id).select("id");
  if (error || !data?.length) return;
  await removePhoto(existing?.image_path, parsed.data.householdId);
  revalidatePath("/", "layout");
  redirect("/recipes");
}

export async function toggleFavorite(formData: FormData): Promise<void> {
  const parsed = idSchema.extend({ favorite: z.enum(["true", "false"]) }).safeParse({
    id: formData.get("id"),
    householdId: formData.get("householdId"),
    favorite: formData.get("favorite"),
  });
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase
    .from("recipes")
    .update({ is_favorite: parsed.data.favorite === "true" })
    .eq("id", parsed.data.id)
    .eq("household_id", parsed.data.householdId);
  revalidatePath("/recipes", "layout");
  revalidatePath("/community");
  revalidatePath("/");
}

export async function toggleIngredientAtHome(formData: FormData): Promise<void> {
  const parsed = idSchema.extend({ atHome: z.enum(["true", "false"]) }).safeParse({
    id: formData.get("id"),
    householdId: formData.get("householdId"),
    atHome: formData.get("atHome"),
  });
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase
    .from("recipe_ingredients")
    .update({ is_at_home: parsed.data.atHome === "true" })
    .eq("id", parsed.data.id)
    .eq("household_id", parsed.data.householdId);
  revalidatePath("/recipes", "layout");
}
