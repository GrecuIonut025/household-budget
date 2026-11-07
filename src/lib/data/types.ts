import type { SpendingScope, TransactionType } from "@/lib/budget-engine";

export type HouseholdRole = "owner" | "admin" | "member" | "viewer";

export interface Household {
  id: string;
  name: string;
  household_size: number;
  currency: string;
  locale: "ro" | "en";
  timezone: string;
  opening_balance: number;
}

export interface Membership {
  household: Household;
  role: HouseholdRole;
}

export interface MemberRow {
  user_id: string;
  role: HouseholdRole;
  joined_at: string;
  display_name: string;
}

export interface CategoryRow {
  id: string;
  kind: TransactionType;
  name: string;
  system_key: string | null;
  is_grocery: boolean;
  is_archived: boolean;
  sort_order: number;
}

export interface BudgetRow {
  id: string;
  name: string;
  period: "monthly" | "weekly" | "custom";
  start_date: string;
  end_date: string;
  spending_limit: number | null;
  grocery_limit: number | null;
  is_active: boolean;
}

export interface TransactionRow {
  id: string;
  type: TransactionType;
  amount: number;
  occurred_on: string;
  description: string;
  category_id: string | null;
  scope: SpendingScope;
  paid_by: string | null;
  created_by: string | null;
  note: string | null;
}

export interface SavingsGoalRow {
  id: string;
  name: string;
  target_amount: number;
  target_date: string | null;
  scope: SpendingScope;
  owner_id: string | null;
  status: "active" | "completed" | "archived";
}

export interface ContributionRow {
  goal_id: string;
  user_id: string | null;
  amount: number;
  contributed_on: string;
}

export interface InviteRow {
  id: string;
  email: string | null;
  role: HouseholdRole;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  created_at: string;
}

export interface ReservationRow {
  amount: number;
  status: "active" | "fulfilled" | "released";
  is_grocery: boolean;
}

export const ROLE_RANK: Record<HouseholdRole, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };

export function canWrite(role: HouseholdRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK.member;
}

export function isAdmin(role: HouseholdRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK.admin;
}
