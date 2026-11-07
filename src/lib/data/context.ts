import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Household, HouseholdRole, MemberRow, Membership } from "./types";

export const ACTIVE_HOUSEHOLD_COOKIE = "hb_household";

export const getUser = cache(async () => {
  if (!getSupabaseEnv()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getMemberships = cache(async (): Promise<Membership[]> => {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("household_members")
    .select("role, households(id, name, household_size, currency, locale, timezone, opening_balance)")
    .eq("user_id", user.id)
    .order("joined_at");
  if (error) throw new Error(`Could not load households: ${error.message}`);
  return (data ?? []).flatMap((row) => {
    const h = row.households as unknown as Household | null;
    return h ? [{ role: row.role as HouseholdRole, household: { ...h, opening_balance: Number(h.opening_balance) } }] : [];
  });
});

export interface AppContext {
  user: { id: string; email: string | undefined };
  displayName: string;
  memberships: Membership[];
  active: Membership;
}

/** Requires a signed-in user with at least one household; redirects otherwise. */
export const requireAppContext = cache(async (): Promise<AppContext> => {
  const user = await getUser();
  if (!user) redirect("/login");
  const memberships = await getMemberships();
  if (memberships.length === 0) redirect("/onboarding");

  const stored = (await cookies()).get(ACTIVE_HOUSEHOLD_COOKIE)?.value;
  const active = memberships.find((m) => m.household.id === stored) ?? memberships[0];

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  const displayName = profile?.display_name || user.email?.split("@")[0] || "";
  return { user: { id: user.id, email: user.email }, displayName, memberships, active };
});

export async function getMembers(householdId: string): Promise<MemberRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("household_members")
    .select("user_id, role, joined_at, profiles(display_name)")
    .eq("household_id", householdId)
    .order("joined_at");
  if (error) throw new Error(`Could not load members: ${error.message}`);
  return (data ?? []).map((m) => {
    const profile = m.profiles as unknown as { display_name: string } | null;
    return {
      user_id: m.user_id,
      role: m.role as HouseholdRole,
      joined_at: m.joined_at,
      display_name: profile?.display_name || "—",
    };
  });
}
