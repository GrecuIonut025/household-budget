"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/form-state";
import { describeDbError, getActionTranslator } from "@/lib/actions";
import { fromMinor } from "@/lib/money";
import { createListFromPlanSchema, deleteMealSchema, upsertMealSchema } from "@/lib/shopping/schema";
import { generateBasketFromMealWeek } from "@/lib/data/shopping-lists";
import { createClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/dates";
import { todayFor } from "@/lib/format";

function revalidatePlanner() {
  revalidatePath("/meal-planner", "layout");
  revalidatePath("/shopping-lists", "layout");
  revalidatePath("/", "layout");
}

export async function upsertMealPlan(_: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getActionTranslator();
  const recipeRaw = formData.get("recipeId");
  const customRaw = formData.get("customTitle");
  const servingsRaw = formData.get("servings");
  const parsed = upsertMealSchema.safeParse({
    householdId: formData.get("householdId"),
    id: formData.get("id") || undefined,
    planDate: formData.get("planDate"),
    mealType: formData.get("mealType"),
    recipeId: recipeRaw === "" || recipeRaw === null ? null : recipeRaw,
    customTitle: customRaw === "" || customRaw === null ? null : customRaw,
    servings: servingsRaw === "" || servingsRaw === null ? null : servingsRaw,
    note: formData.get("note") || null,
  });
  if (!parsed.success) return { error: t("meals.error.invalid") };

  const data = parsed.data;
  if (!data.recipeId && !data.customTitle) return { error: t("meals.error.needRecipeOrTitle") };

  const supabase = await createClient();
  const row = {
    household_id: data.householdId,
    plan_date: data.planDate,
    meal_type: data.mealType,
    recipe_id: data.recipeId ?? null,
    custom_title: data.customTitle ?? null,
    servings: data.servings ?? null,
    note: data.note ?? null,
  };

  if (data.id) {
    const { error } = await supabase.from("meal_plans").update(row).eq("id", data.id).eq("household_id", data.householdId);
    if (error) return { error: describeDbError(error, t) };
  } else {
    const { error } = await supabase.from("meal_plans").insert(row);
    if (error) return { error: describeDbError(error, t) };
  }

  revalidatePlanner();
  return { ok: true };
}

export async function deleteMealPlan(formData: FormData): Promise<void> {
  const parsed = deleteMealSchema.safeParse({
    householdId: formData.get("householdId"),
    id: formData.get("id"),
  });
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from("meal_plans").delete().eq("id", parsed.data.id).eq("household_id", parsed.data.householdId);
  revalidatePlanner();
}

export async function createShoppingListFromMealPlan(_: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getActionTranslator();
  const includeOptional = formData.get("includeOptional") === "1" || formData.get("includeOptional") === "true";
  const preferredRaw = formData.get("preferredRetailerId");
  const parsed = createListFromPlanSchema.safeParse({
    householdId: formData.get("householdId"),
    weekStart: formData.get("weekStart"),
    name: formData.get("name"),
    includeOptional,
    preferredRetailerId: preferredRaw === "" || preferredRaw === null ? null : preferredRaw,
    strategy: formData.get("strategy") || "cheapest_combo",
  });
  if (!parsed.success) return { error: t("shopping.error.invalid") };

  const { householdId, weekStart, name, preferredRetailerId, strategy } = parsed.data;
  const weekEnd = addDays(weekStart, 6);

  const supabase = await createClient();
  const { data: household } = await supabase
    .from("households")
    .select("currency, timezone")
    .eq("id", householdId)
    .maybeSingle();
  if (!household) return { error: t("common.errorGeneric") };

  const basket = await generateBasketFromMealWeek({
    householdId,
    currency: household.currency,
    today: todayFor(household.timezone),
    weekStart,
    weekEnd,
    preferredRetailerId,
    includeOptional,
  });

  const toBuy = basket.needs.filter((n) => n.toBuyQuantity === null || n.toBuyQuantity > 0);
  if (toBuy.length === 0) return { error: t("shopping.error.emptyFromPlan") };

  const strategyResult = basket.strategies.find((s) => s.kind === (strategy ?? "cheapest_combo"));
  const assignmentByKey = new Map((strategyResult?.assignments ?? []).map((a) => [a.key, a]));

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: list, error: listError } = await supabase
    .from("shopping_lists")
    .insert({
      household_id: householdId,
      name,
      status: "active",
      scope: "shared",
      preferred_retailer_id: preferredRetailerId ?? null,
      strategy: strategy ?? "cheapest_combo",
      meal_week_start: weekStart,
      planned_for: weekEnd,
      planned_budget: strategyResult?.totalMinor != null ? fromMinor(strategyResult.totalMinor) : null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (listError || !list) return { error: describeDbError(listError ?? { message: "missing" }, t) };

  const items = toBuy.map((need, index) => {
    const assignment = assignmentByKey.get(need.key);
    const unitPrice =
      assignment?.unitPriceMinor != null ? fromMinor(assignment.unitPriceMinor) : null;
    return {
      household_id: householdId,
      list_id: list.id,
      product_id: need.productId,
      recipe_id: need.sources[0]?.recipeId ?? null,
      name: need.name,
      quantity: Math.max(need.toBuyQuantity ?? 1, 0.001),
      unit: need.unit,
      estimated_unit_price: unitPrice,
      retailer_id: assignment?.retailerId && assignment.retailerId !== "last-purchase" ? assignment.retailerId : null,
      note: need.notes[0] ?? null,
      sort_order: index,
    };
  });

  const { error: itemsError } = await supabase.from("shopping_list_items").insert(items);
  if (itemsError) {
    await supabase.from("shopping_lists").delete().eq("id", list.id);
    return { error: describeDbError(itemsError, t) };
  }

  revalidatePlanner();
  redirect(`/shopping-lists/${list.id}`);
}
