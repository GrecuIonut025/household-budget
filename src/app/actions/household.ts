"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/form-state";
import { describeDbError, getActionTranslator, readMoney } from "@/lib/actions";
import { isValidISODate } from "@/lib/dates";
import { extractInviteToken } from "@/lib/invite-token";
import { ACTIVE_HOUSEHOLD_COOKIE } from "@/lib/data/context";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

const COOKIE_OPTIONS = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const };

function text(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

async function setActiveHousehold(id: string) {
  (await cookies()).set(ACTIVE_HOUSEHOLD_COOKIE, id, COOKIE_OPTIONS);
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  size: z.coerce.number().int().min(1).max(50),
  currency: z.string().regex(/^[A-Z]{3}$/),
  locale: z.enum(["ro", "en"]),
});

export async function createHousehold(_: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getActionTranslator();
  const parsed = createSchema.safeParse({
    name: text(formData, "name"),
    size: text(formData, "size") || "1",
    currency: text(formData, "currency") || "RON",
    locale: text(formData, "locale") || "ro",
  });
  const spending = readMoney(formData.get("spendingLimit"));
  const grocery = readMoney(formData.get("groceryLimit"));
  if (!parsed.success || spending === null || grocery === null) return { error: t("common.errorGeneric") };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_household", {
    p_name: parsed.data.name,
    p_household_size: parsed.data.size,
    p_currency: parsed.data.currency,
    p_locale: parsed.data.locale,
    p_budget_name: null,
    p_spending_limit: spending ?? null,
    p_grocery_limit: grocery ?? null,
  });
  if (error || !data) return { error: error ? describeDbError(error, t) : t("common.errorGeneric") };

  await setActiveHousehold(data as string);
  (await cookies()).set(LOCALE_COOKIE, parsed.data.locale, COOKIE_OPTIONS);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function acceptInvite(_: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getActionTranslator();
  const token = extractInviteToken(text(formData, "token"));
  if (!token) return { error: t("invite.invalid") };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_household_invite", { p_token: token });
  if (error || !data) return { error: t("invite.invalid") };

  await setActiveHousehold(data as string);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function switchHousehold(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(text(formData, "householdId"));
  if (!id.success) return;
  await setActiveHousehold(id.data);
  revalidatePath("/", "layout");
  redirect("/settings");
}

export async function setLanguage(formData: FormData): Promise<void> {
  const locale = text(formData, "locale");
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, COOKIE_OPTIONS);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await supabase.from("profiles").update({ locale }).eq("id", user.id);
  revalidatePath("/", "layout");
}

const householdSchema = z.object({
  householdId: z.uuid(),
  name: z.string().trim().min(1).max(120),
  size: z.coerce.number().int().min(1).max(50),
});

export async function updateHousehold(_: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getActionTranslator();
  const parsed = householdSchema.safeParse({
    householdId: text(formData, "householdId"),
    name: text(formData, "name"),
    size: text(formData, "size"),
  });
  const opening = readMoney(formData.get("openingBalance"));
  if (!parsed.success || opening === null) return { error: t("common.errorGeneric") };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("households")
    .update({ name: parsed.data.name, household_size: parsed.data.size, opening_balance: opening ?? 0 })
    .eq("id", parsed.data.householdId)
    .select("id");
  if (error) return { error: describeDbError(error, t) };
  if (!data?.length) return { error: t("common.noPermission") };
  revalidatePath("/", "layout");
  return { ok: true, message: t("settings.saved") };
}

const budgetSchema = z.object({
  householdId: z.uuid(),
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(120),
  startDate: z.string(),
  endDate: z.string(),
});

export async function saveBudget(_: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getActionTranslator();
  const parsed = budgetSchema.safeParse({
    householdId: text(formData, "householdId"),
    id: text(formData, "id") || undefined,
    name: text(formData, "name"),
    startDate: text(formData, "startDate"),
    endDate: text(formData, "endDate"),
  });
  const spending = readMoney(formData.get("spendingLimit"));
  const grocery = readMoney(formData.get("groceryLimit"));
  if (!parsed.success || spending === null || grocery === null) return { error: t("common.errorGeneric") };
  const v = parsed.data;
  if (!isValidISODate(v.startDate) || !isValidISODate(v.endDate)) return { error: t("tx.invalidDate") };
  if (v.endDate < v.startDate) return { error: t("settings.budgetDates") };

  const row = {
    household_id: v.householdId,
    name: v.name,
    period: "custom" as const,
    start_date: v.startDate,
    end_date: v.endDate,
    spending_limit: spending ?? null,
    grocery_limit: grocery ?? null,
  };
  const supabase = await createClient();
  const overrides = { "23P01": t("settings.budgetOverlap") };
  if (v.id) {
    const { data, error } = await supabase.from("budgets").update(row).eq("id", v.id).select("id");
    if (error) return { error: describeDbError(error, t, overrides) };
    if (!data?.length) return { error: t("common.noPermission") };
  } else {
    const { error } = await supabase.from("budgets").insert(row);
    if (error) return { error: describeDbError(error, t, overrides) };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: t("settings.saved") };
}

const roleSchema = z.enum(["admin", "member", "viewer"]);

export async function changeMemberRole(formData: FormData): Promise<void> {
  const householdId = z.uuid().safeParse(text(formData, "householdId"));
  const userId = z.uuid().safeParse(text(formData, "userId"));
  const role = roleSchema.safeParse(text(formData, "role"));
  if (!householdId.success || !userId.success || !role.success) return;
  const supabase = await createClient();
  await supabase
    .from("household_members")
    .update({ role: role.data })
    .eq("household_id", householdId.data)
    .eq("user_id", userId.data);
  revalidatePath("/", "layout");
}

export async function removeMember(formData: FormData): Promise<void> {
  const householdId = z.uuid().safeParse(text(formData, "householdId"));
  const userId = z.uuid().safeParse(text(formData, "userId"));
  if (!householdId.success || !userId.success) return;
  const supabase = await createClient();
  await supabase.from("household_members").delete().eq("household_id", householdId.data).eq("user_id", userId.data);
  revalidatePath("/", "layout");
}

export async function leaveHousehold(formData: FormData): Promise<void> {
  const householdId = z.uuid().safeParse(text(formData, "householdId"));
  if (!householdId.success) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("household_members").delete().eq("household_id", householdId.data).eq("user_id", user.id);
  (await cookies()).delete(ACTIVE_HOUSEHOLD_COOKIE);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function transferOwnership(formData: FormData): Promise<void> {
  const householdId = z.uuid().safeParse(text(formData, "householdId"));
  const userId = z.uuid().safeParse(text(formData, "userId"));
  if (!householdId.success || !userId.success) return;
  const supabase = await createClient();
  await supabase.rpc("transfer_household_ownership", { p_household_id: householdId.data, p_new_owner: userId.data });
  revalidatePath("/", "layout");
}

export async function deleteHousehold(formData: FormData): Promise<void> {
  const householdId = z.uuid().safeParse(text(formData, "householdId"));
  if (!householdId.success) return;
  const supabase = await createClient();
  await supabase.from("households").delete().eq("id", householdId.data);
  (await cookies()).delete(ACTIVE_HOUSEHOLD_COOKIE);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function createInvite(_: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getActionTranslator();
  const householdId = z.uuid().safeParse(text(formData, "householdId"));
  const role = roleSchema.safeParse(text(formData, "role"));
  const email = z.union([z.email(), z.literal("")]).safeParse(text(formData, "email").trim());
  if (!householdId.success || !role.success || !email.success) return { error: t("common.errorGeneric") };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_household_invite", {
    p_household_id: householdId.data,
    p_email: email.data || null,
    p_role: role.data,
  });
  if (error || !data) return { error: error ? describeDbError(error, t) : t("common.errorGeneric") };

  const origin = (await headers()).get("origin") ?? "";
  revalidatePath("/settings");
  return { ok: true, secret: `${origin}/invite/${data as string}` };
}

export async function revokeInvite(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(text(formData, "id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("household_invites").update({ status: "revoked" }).eq("id", id.data);
  revalidatePath("/settings");
}

const goalSchema = z.object({
  householdId: z.uuid(),
  name: z.string().trim().min(1).max(120),
  scope: z.enum(["shared", "individual"]),
  ownerId: z.uuid().nullable(),
  targetDate: z.string(),
});

export async function createGoal(_: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getActionTranslator();
  const parsed = goalSchema.safeParse({
    householdId: text(formData, "householdId"),
    name: text(formData, "name"),
    scope: text(formData, "scope"),
    ownerId: text(formData, "ownerId") || null,
    targetDate: text(formData, "targetDate"),
  });
  const target = readMoney(formData.get("targetAmount"));
  if (!parsed.success || !target || target <= 0) return { error: t("tx.invalidAmount") };
  const v = parsed.data;
  if (v.targetDate && !isValidISODate(v.targetDate)) return { error: t("tx.invalidDate") };
  if (v.scope === "individual" && !v.ownerId) return { error: t("common.errorGeneric") };

  const supabase = await createClient();
  const { error } = await supabase.from("savings_goals").insert({
    household_id: v.householdId,
    name: v.name,
    target_amount: target,
    target_date: v.targetDate || null,
    scope: v.scope,
    owner_id: v.scope === "individual" ? v.ownerId : null,
  });
  if (error) return { error: describeDbError(error, t) };
  revalidatePath("/", "layout");
  return { ok: true, message: t("settings.saved") };
}

export async function contributeToGoal(_: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getActionTranslator();
  const householdId = z.uuid().safeParse(text(formData, "householdId"));
  const goalId = z.uuid().safeParse(text(formData, "goalId"));
  const userId = z.uuid().safeParse(text(formData, "userId"));
  const amount = readMoney(formData.get("amount"));
  const direction = text(formData, "direction") === "withdraw" ? -1 : 1;
  if (!householdId.success || !goalId.success || !userId.success) return { error: t("common.errorGeneric") };
  if (!amount || amount <= 0) return { error: t("tx.invalidAmount") };

  const supabase = await createClient();
  const { error } = await supabase.from("savings_goal_contributions").insert({
    household_id: householdId.data,
    goal_id: goalId.data,
    user_id: userId.data,
    amount: amount * direction,
  });
  if (error) return { error: describeDbError(error, t) };
  revalidatePath("/", "layout");
  return { ok: true, message: t("settings.saved") };
}

export async function deleteGoal(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(text(formData, "id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("savings_goals").delete().eq("id", id.data);
  revalidatePath("/", "layout");
}
