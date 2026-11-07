"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/form-state";
import { describeDbError, getActionTranslator, readMoney } from "@/lib/actions";
import {
  completeListSchema,
  createListSchema,
  reserveBudgetSchema,
  toggleItemSchema,
  updateItemPriceSchema,
} from "@/lib/shopping/schema";
import { createClient } from "@/lib/supabase/server";

function revalidateLists() {
  revalidatePath("/shopping-lists", "layout");
  revalidatePath("/meal-planner", "layout");
  revalidatePath("/", "layout");
  revalidatePath("/transactions", "layout");
  revalidatePath("/products", "layout");
}

export async function createShoppingList(_: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getActionTranslator();
  const parsed = createListSchema.safeParse({
    householdId: formData.get("householdId"),
    name: formData.get("name"),
  });
  if (!parsed.success) return { error: t("shopping.error.invalid") };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("shopping_lists")
    .insert({
      household_id: parsed.data.householdId,
      name: parsed.data.name,
      status: "active",
      scope: "shared",
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: describeDbError(error ?? { message: "missing" }, t) };

  revalidateLists();
  redirect(`/shopping-lists/${data.id}`);
}

export async function toggleShoppingItem(formData: FormData): Promise<void> {
  const parsed = toggleItemSchema.safeParse({
    householdId: formData.get("householdId"),
    itemId: formData.get("itemId"),
    checked: formData.get("checked") === "true",
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase
    .from("shopping_list_items")
    .update({
      is_checked: parsed.data.checked,
      checked_by: parsed.data.checked ? (user?.id ?? null) : null,
      checked_at: parsed.data.checked ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.itemId)
    .eq("household_id", parsed.data.householdId);
  revalidateLists();
}

export async function updateItemActualPrice(_: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getActionTranslator();
  const money = readMoney(formData.get("actualUnitPrice"));
  if (money === null) return { error: t("shopping.error.invalidPrice") };
  const parsed = updateItemPriceSchema.safeParse({
    householdId: formData.get("householdId"),
    itemId: formData.get("itemId"),
    actualUnitPrice: money === undefined ? null : money,
  });
  if (!parsed.success) return { error: t("shopping.error.invalidPrice") };

  const supabase = await createClient();
  const { error } = await supabase
    .from("shopping_list_items")
    .update({ actual_unit_price: parsed.data.actualUnitPrice })
    .eq("id", parsed.data.itemId)
    .eq("household_id", parsed.data.householdId);
  if (error) return { error: describeDbError(error, t) };
  revalidateLists();
  return { ok: true };
}

export async function addShoppingItem(_: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getActionTranslator();
  const householdId = String(formData.get("householdId") ?? "");
  const listId = String(formData.get("listId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const quantity = Number(formData.get("quantity") ?? 1);
  const unit = String(formData.get("unit") ?? "").trim() || null;
  if (!householdId || !listId || !name || !(quantity > 0)) return { error: t("shopping.error.invalid") };

  const supabase = await createClient();
  const { data: maxSort } = await supabase
    .from("shopping_list_items")
    .select("sort_order")
    .eq("list_id", listId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("shopping_list_items").insert({
    household_id: householdId,
    list_id: listId,
    name,
    quantity,
    unit,
    sort_order: (maxSort?.sort_order ?? -1) + 1,
  });
  if (error) return { error: describeDbError(error, t) };
  revalidateLists();
  return { ok: true };
}

export async function deleteShoppingItem(formData: FormData): Promise<void> {
  const householdId = String(formData.get("householdId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  if (!householdId || !itemId) return;
  const supabase = await createClient();
  await supabase.from("shopping_list_items").delete().eq("id", itemId).eq("household_id", householdId);
  revalidateLists();
}

export async function reserveShoppingBudget(_: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getActionTranslator();
  const amount = readMoney(formData.get("amount"));
  if (amount === null || amount === undefined) return { error: t("shopping.error.invalidPrice") };
  const parsed = reserveBudgetSchema.safeParse({
    householdId: formData.get("householdId"),
    listId: formData.get("listId"),
    amount,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: t("shopping.error.invalid") };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reserve_shopping_budget", {
    p_list_id: parsed.data.listId,
    p_amount: parsed.data.amount,
    p_note: parsed.data.note ?? null,
  });
  if (error) {
    return {
      error: describeDbError(error, t, {
        P0002: t("shopping.error.noBudget"),
        "23514": t("shopping.error.cannotReserve"),
      }),
    };
  }
  revalidateLists();
  return { ok: true, message: t("shopping.reserve.ok") };
}

export async function releaseShoppingReservation(formData: FormData): Promise<void> {
  const householdId = String(formData.get("householdId") ?? "");
  const listId = String(formData.get("listId") ?? "");
  if (!householdId || !listId) return;
  const supabase = await createClient();
  await supabase
    .from("budget_reservations")
    .update({ status: "released", released_at: new Date().toISOString() })
    .eq("household_id", householdId)
    .eq("shopping_list_id", listId)
    .eq("status", "active");
  revalidateLists();
}

/**
 * Convert a finished shopping list into real expense transactions and product purchase history.
 * Planned lists / reservations are never auto-recorded — this only runs on explicit user action.
 */
export async function completeShoppingList(_: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getActionTranslator();
  const parsed = completeListSchema.safeParse({
    householdId: formData.get("householdId"),
    listId: formData.get("listId"),
    occurredOn: formData.get("occurredOn") || undefined,
    scope: formData.get("scope") || "shared",
  });
  if (!parsed.success) return { error: t("shopping.error.invalid") };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase.rpc("complete_shopping_list", {
    p_list_id: parsed.data.listId,
    p_occurred_on: parsed.data.occurredOn ?? null,
    p_paid_by: parsed.data.scope === "individual" ? (user?.id ?? null) : null,
    p_scope: parsed.data.scope ?? "shared",
  });
  if (error) {
    return {
      error: describeDbError(error, t, {
        "23514": t("shopping.error.cannotComplete"),
        P0002: t("shopping.error.notFound"),
      }),
    };
  }

  revalidateLists();
  return {
    ok: true,
    message: t("shopping.complete.ok", {
      count: Number((data as { purchases?: number } | null)?.purchases ?? 0),
    }),
  };
}

export async function archiveShoppingList(formData: FormData): Promise<void> {
  const householdId = String(formData.get("householdId") ?? "");
  const listId = String(formData.get("listId") ?? "");
  if (!householdId || !listId) return;
  const supabase = await createClient();
  await supabase
    .from("shopping_lists")
    .update({ status: "archived" })
    .eq("id", listId)
    .eq("household_id", householdId);
  // release any leftover reservation
  await supabase
    .from("budget_reservations")
    .update({ status: "released", released_at: new Date().toISOString() })
    .eq("household_id", householdId)
    .eq("shopping_list_id", listId)
    .eq("status", "active");
  revalidateLists();
  redirect("/shopping-lists");
}

export async function deleteShoppingList(formData: FormData): Promise<void> {
  const householdId = String(formData.get("householdId") ?? "");
  const listId = String(formData.get("listId") ?? "");
  if (!householdId || !listId) return;
  const supabase = await createClient();
  await supabase.from("shopping_lists").delete().eq("id", listId).eq("household_id", householdId);
  revalidateLists();
  redirect("/shopping-lists");
}
