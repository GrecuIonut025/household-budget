import type { MessageKey } from "@/lib/i18n";

export type CommunityTipId =
  | "batch-cook"
  | "price-compare"
  | "list-before-shop"
  | "leftovers"
  | "seasonal"
  | "pantry-first";

export interface CommunityTip {
  id: CommunityTipId;
  titleKey: MessageKey;
  bodyKey: MessageKey;
  ctaKey: MessageKey;
  href: string;
  accent: "purple" | "cyan" | "emerald" | "amber";
}

/** Curated inspiration tips — educational CTAs, never fake money. */
export const COMMUNITY_TIPS: readonly CommunityTip[] = [
  {
    id: "batch-cook",
    titleKey: "community.tip.batchCook.title",
    bodyKey: "community.tip.batchCook.body",
    ctaKey: "community.tip.batchCook.cta",
    href: "/meal-planner",
    accent: "purple",
  },
  {
    id: "price-compare",
    titleKey: "community.tip.priceCompare.title",
    bodyKey: "community.tip.priceCompare.body",
    ctaKey: "community.tip.priceCompare.cta",
    href: "/price-comparison",
    accent: "cyan",
  },
  {
    id: "list-before-shop",
    titleKey: "community.tip.listBeforeShop.title",
    bodyKey: "community.tip.listBeforeShop.body",
    ctaKey: "community.tip.listBeforeShop.cta",
    href: "/shopping-lists",
    accent: "emerald",
  },
  {
    id: "leftovers",
    titleKey: "community.tip.leftovers.title",
    bodyKey: "community.tip.leftovers.body",
    ctaKey: "community.tip.leftovers.cta",
    href: "/recipes",
    accent: "amber",
  },
  {
    id: "seasonal",
    titleKey: "community.tip.seasonal.title",
    bodyKey: "community.tip.seasonal.body",
    ctaKey: "community.tip.seasonal.cta",
    href: "/products",
    accent: "emerald",
  },
  {
    id: "pantry-first",
    titleKey: "community.tip.pantryFirst.title",
    bodyKey: "community.tip.pantryFirst.body",
    ctaKey: "community.tip.pantryFirst.cta",
    href: "/recipes/new",
    accent: "purple",
  },
];
