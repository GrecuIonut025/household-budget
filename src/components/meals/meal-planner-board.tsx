"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { MealPlanRow } from "@/lib/data/meal-plans";
import type { MealType } from "@/lib/shopping/types";
import { MEAL_TYPES } from "@/lib/shopping/week";
import type { MessageKey } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/provider";
import { formatDate } from "@/lib/format";
import { MealFormSheet, type RecipeOption } from "./meal-form";
import { Badge } from "@/components/ui";

const MEAL_LABEL: Record<MealType, MessageKey> = {
  breakfast: "meals.breakfast",
  lunch: "meals.lunch",
  dinner: "meals.dinner",
  snack: "meals.snack",
};

export function MealPlannerBoard({
  householdId,
  days,
  meals,
  recipes,
  canWrite,
  costs,
}: {
  householdId: string;
  days: string[];
  meals: MealPlanRow[];
  recipes: RecipeOption[];
  canWrite: boolean;
  costs: Record<string, string | null>;
}) {
  const { t, locale } = useI18n();
  const [slot, setSlot] = useState<{ date: string; mealType: MealType; meal?: MealPlanRow } | null>(null);

  const bySlot = useMemo(() => {
    const map = new Map<string, MealPlanRow[]>();
    for (const meal of meals) {
      const key = `${meal.plan_date}:${meal.meal_type}`;
      const list = map.get(key) ?? [];
      list.push(meal);
      map.set(key, list);
    }
    return map;
  }, [meals]);

  return (
    <>
      <div className="space-y-4">
        {days.map((day) => (
          <section key={day} className="rounded-2xl border border-border bg-surface p-3 shadow-card sm:p-4">
            <h2 className="mb-3 text-sm font-semibold tracking-tight">{formatDate(day, locale, { weekday: "long", day: "numeric", month: "short" })}</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {MEAL_TYPES.map((mealType) => {
                const key = `${day}:${mealType}`;
                const slotMeals = bySlot.get(key) ?? [];
                return (
                  <div key={mealType} className="rounded-xl bg-surface-2/70 p-2.5">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">{t(MEAL_LABEL[mealType])}</p>
                      {canWrite ? (
                        <button
                          type="button"
                          onClick={() => setSlot({ date: day, mealType })}
                          className="grid size-8 place-items-center rounded-lg text-brand hover:bg-brand-soft"
                          aria-label={t("meals.add")}
                        >
                          <Plus size={16} aria-hidden />
                        </button>
                      ) : null}
                    </div>
                    {slotMeals.length === 0 ? (
                      <p className="px-1 py-2 text-sm text-muted">{t("meals.emptySlot")}</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {slotMeals.map((meal) => (
                          <li key={meal.id}>
                            <button
                              type="button"
                              disabled={!canWrite}
                              onClick={() => canWrite && setSlot({ date: day, mealType, meal })}
                              className="flex w-full items-start justify-between gap-2 rounded-lg bg-surface px-2.5 py-2 text-left transition hover:ring-1 hover:ring-brand/30 disabled:hover:ring-0"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                  {meal.recipe_title ?? meal.custom_title}
                                </p>
                                {meal.servings ? (
                                  <p className="text-xs text-muted">
                                    {t("recipes.servingsCount", { count: meal.servings })}
                                  </p>
                                ) : null}
                              </div>
                              {costs[meal.id] ? <Badge tone="brand">{costs[meal.id]}</Badge> : null}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {canWrite && slot ? (
        <MealFormSheet
          key={slot.meal?.id ?? `${slot.date}-${slot.mealType}`}
          open
          onClose={() => setSlot(null)}
          householdId={householdId}
          planDate={slot.date}
          mealType={slot.mealType}
          recipes={recipes}
          meal={slot.meal}
        />
      ) : null}
    </>
  );
}
