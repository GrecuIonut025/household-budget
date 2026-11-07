import {
  ArrowLeftRight,
  CalendarDays,
  ChartNoAxesColumn,
  ChefHat,
  House,
  LayoutDashboard,
  Package,
  Scale,
  Settings,
  ShoppingCart,
  UserRound,
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
  /** When set, the group header itself acts as a top-level nav row (Dashboard). */
  href?: string;
  icon?: LucideIcon;
  items: readonly NavItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: "overview",
    label: "nav.group.overview",
    href: "/",
    icon: LayoutDashboard,
    items: [{ href: "/", label: "nav.dashboard", icon: House, primary: true }],
  },
  {
    id: "finances",
    label: "nav.group.finances",
    items: [
      { href: "/transactions", label: "nav.transactions", icon: ArrowLeftRight, primary: true },
      { href: "/analytics", label: "nav.analytics", icon: ChartNoAxesColumn, primary: false },
    ],
  },
  {
    id: "planning",
    label: "nav.group.planning",
    items: [
      { href: "/shopping-lists", label: "nav.shoppingLists", icon: ShoppingCart, primary: true },
      { href: "/products", label: "nav.products", icon: Package, primary: false },
      { href: "/price-comparison", label: "nav.priceComparison", icon: Scale, primary: false },
    ],
  },
  {
    id: "kitchen",
    label: "nav.group.kitchen",
    items: [
      { href: "/recipes", label: "nav.recipes", icon: ChefHat, primary: false },
      { href: "/meal-planner", label: "nav.mealPlanner", icon: CalendarDays, primary: false },
    ],
  },
  {
    id: "settings",
    label: "nav.group.settings",
    items: [
      { href: "/settings#preferences", label: "nav.account", icon: UserRound, primary: false },
      { href: "/settings", label: "nav.settings", icon: Settings, primary: true },
    ],
  },
];

export const NAV_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function isActive(pathname: string, href: string): boolean {
  const path = href.split("#")[0] || href;
  return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
}
