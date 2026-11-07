import {
  ArrowLeftRight,
  CalendarDays,
  ChartNoAxesColumn,
  ChefHat,
  LayoutDashboard,
  Package,
  Scale,
  Settings,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";
import type { MessageKey } from "@/lib/i18n";

export interface NavItem {
  href: string;
  label: MessageKey;
  icon: LucideIcon;
  /** shown directly in the mobile bottom bar; the rest live under "More" */
  primary: boolean;
}

export interface NavGroup {
  id: string;
  label: MessageKey;
  items: readonly NavItem[];
}

/** Flat primary sidebar order matches the Bugetify reference shell. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "nav.dashboardHome", icon: LayoutDashboard, primary: true },
  { href: "/transactions", label: "nav.transactions", icon: ArrowLeftRight, primary: true },
  { href: "/products", label: "nav.products", icon: Package, primary: false },
  { href: "/recipes", label: "nav.recipes", icon: ChefHat, primary: false },
  { href: "/shopping-lists", label: "nav.shoppingLists", icon: ShoppingCart, primary: true },
  { href: "/price-comparison", label: "nav.priceComparison", icon: Scale, primary: false },
  { href: "/analytics", label: "nav.analytics", icon: ChartNoAxesColumn, primary: false },
  { href: "/meal-planner", label: "nav.mealPlanner", icon: CalendarDays, primary: false },
  { href: "/settings", label: "nav.settings", icon: Settings, primary: true },
];

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: "main",
    label: "nav.primary",
    items: NAV_ITEMS,
  },
];

export function isActive(pathname: string, href: string): boolean {
  const path = href.split("#")[0] || href;
  return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
}
