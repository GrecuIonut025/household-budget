import { ChefHat, Clock, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui";
import type { MessageKey, Translate } from "@/lib/i18n";
import type { RecipeRow } from "@/lib/recipes/types";
import { formatQuantity } from "@/lib/recipes/scaling";
import { FavoriteButton } from "./favorite-button";

export interface RecipeCardCost {
  perServing: string | null;
  /** some ingredient prices are missing, so the figure is a lower bound */
  partial: boolean;
}

export function RecipeCard({
  recipe,
  imageUrl,
  cost,
  t,
  locale,
  householdId,
  canWrite,
}: {
  recipe: RecipeRow;
  imageUrl: string | null;
  cost: RecipeCardCost;
  t: Translate;
  locale: string;
  householdId: string;
  canWrite: boolean;
}) {
  const minutes = (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0);
  return (
    <li className="group relative overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface transition hover:-translate-y-0.5">
      <Link href={`/recipes/${recipe.id}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-brand-soft to-surface-2">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" loading="lazy" className="size-full object-cover transition duration-300 group-hover:scale-[1.03]" />
          ) : (
            <div className="grid size-full place-items-center text-brand/60">
              <ChefHat size={44} aria-hidden />
            </div>
          )}
        </div>
        <div className="space-y-2 p-4">
          <h3 className="line-clamp-2 text-base font-semibold leading-snug tracking-tight">{recipe.title}</h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <Users size={14} aria-hidden />
              {t("recipes.servingsCount", { count: formatQuantity(recipe.servings, locale) })}
            </span>
            {minutes > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Clock size={14} aria-hidden />
                {t("recipes.minutes", { count: minutes })}
              </span>
            ) : null}
            {recipe.category ? <Badge>{t(`recipes.category.${recipe.category}` as MessageKey)}</Badge> : null}
          </div>
          <p className="tabular text-sm">
            {cost.perServing ? (
              <>
                <span className="font-semibold">
                  {cost.partial ? "≥ " : ""}
                  {cost.perServing}
                </span>{" "}
                <span className="text-muted">{t("recipes.cost.perServingShort")}</span>
              </>
            ) : (
              <span className="text-muted">{t("recipes.cost.unknown")}</span>
            )}
          </p>
        </div>
      </Link>
      {canWrite ? (
        <div className="absolute right-2 top-2">
          <FavoriteButton
            recipeId={recipe.id}
            householdId={householdId}
            isFavorite={recipe.is_favorite}
            label={recipe.is_favorite ? t("recipes.unfavorite") : t("recipes.favorite")}
          />
        </div>
      ) : recipe.is_favorite ? (
        <span className="absolute right-3 top-3 rounded-full bg-surface/90 px-2 py-1 text-xs text-danger">♥</span>
      ) : null}
    </li>
  );
}
