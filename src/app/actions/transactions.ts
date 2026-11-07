"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/form-state";
import { isValidISODate } from "@/lib/dates";
import { describeDbError, getActionTranslator, readMoney } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  householdId: z.uuid(),
  id: z.uuid().optional(),
  type: z.enum(["income", "expense"]),
  scope: z.enum(["shared", "individual"]),
  description: z.string().trim().max(300),
  note: z.string().trim().max(1000),
  categoryId: z.uuid().nullable(),
  paidBy: z.uuid().nullable(),
});

export async function saveTransaction(_: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getActionTranslator();
  const str = (name: string) => {
    const v = formData.get(name);
    return typeof v === "string" ? v : "";
  };

  const amount = readMoney(formData.get("amount"));
  if (!amount || amount <= 0) return { error: t("tx.invalidAmount") };
  const occurredOn = str("occurredOn");
  if (!isValidISODate(occurredOn)) return { error: t("tx.invalidDate") };

  const parsed = schema.safeParse({
    householdId: str("householdId"),
    id: str("id") || undefined,
    type: str("type"),
    scope: str("scope"),
    description: str("description"),
    note: str("note"),
    categoryId: str("categoryId") || null,
    paidBy: str("paidBy") || null,
  });
  if (!parsed.success) return { error: t("common.errorGeneric") };
  const v = parsed.data;
  if (v.scope === "individual" && !v.paidBy) return { error: t("common.errorGeneric") };

  const row = {
    household_id: v.householdId,
    type: v.type,
    amount,
    occurred_on: occurredOn,
    description: v.description,
    note: v.note || null,
    category_id: v.categoryId,
    scope: v.scope,
    paid_by: v.paidBy,
  };

  const supabase = await createClient();
  if (v.id) {
    const { data, error } = await supabase.from("transactions").update(row).eq("id", v.id).select("id");
    if (error) return { error: describeDbError(error, t) };
    // RLS hides rows the user may not edit: an update that matches nothing means "not allowed".
    if (!data?.length) return { error: t("common.noPermission") };
  } else {
    const { error } = await supabase.from("transactions").insert(row);
    if (error) return { error: describeDbError(error, t, { "23514": t("common.errorGeneric") }) };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: t("tx.saved") };
}

export async function deleteTransaction(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("transactions").delete().eq("id", id.data);
  revalidatePath("/", "layout");
}
