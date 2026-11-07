"use client";

import { useActionState, useEffect, useState } from "react";
import { deleteMealPlan, upsertMealPlan } from "@/app/actions/meal-plans";
import type { MealPlanRow } from "@/lib/data/meal-plans";
import type { MealType } from "@/lib/shopping/types";
import { useI18n } from "@/lib/i18n/provider";
import { ConfirmForm } from "@/components/confirm-form";
import { Sheet } from "@/components/sheet";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field, inputClass } from "@/components/ui";

export interface RecipeOption {
  id: string;
  title: string;
  servings: number;
}

export function MealFormSheet({
  open,
  onClose,
  householdId,
  planDate,
  mealType,
  recipes,
  meal,
}: {
  open: boolean;
  onClose: () => void;
  householdId: string;
  planDate: string;
  mealType: MealType;
  recipes: RecipeOption[];
  meal?: MealPlanRow | null;
}) {
  const { t } = useI18n();
  const [state, action] = useActionState(upsertMealPlan, {});
  const [recipeId, setRecipeId] = useState(meal?.recipe_id ?? "");
  const selected = recipes.find((r) => r.id === recipeId);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <Sheet open={open} onClose={onClose} title={meal ? t("meals.edit") : t("meals.add")}>
      <form
        key={meal?.id ?? `new-${planDate}-${mealType}`}
        action={action}
        className="space-y-4"
      >
        <input type="hidden" name="householdId" value={householdId} />
        {meal ? <input type="hidden" name="id" value={meal.id} /> : null}
        <input type="hidden" name="planDate" value={planDate} />
        <input type="hidden" name="mealType" value={mealType} />

        <Field label={t("meals.recipe")} htmlFor="recipeId">
          <select
            id="recipeId"
            name="recipeId"
            value={recipeId}
            onChange={(e) => setRecipeId(e.target.value)}
            className={inputClass}
          >
            <option value="">{t("meals.pickRecipe")}</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
          {recipes.length === 0 ? <p className="mt-1 text-xs text-muted">{t("meals.noRecipes")}</p> : null}
        </Field>

        <Field label={t("meals.customTitle")} htmlFor="customTitle" hint={t("common.optional")}>
          <input
            id="customTitle"
            name="customTitle"
            defaultValue={meal?.custom_title ?? ""}
            className={inputClass}
            maxLength={200}
          />
        </Field>

        <Field label={t("meals.servings")} htmlFor="servings">
          <input
            id="servings"
            name="servings"
            type="number"
            min={0.5}
            step={0.5}
            max={99}
            defaultValue={meal?.servings ?? selected?.servings ?? 2}
            className={inputClass}
          />
        </Field>

        <Field label={t("meals.note")} htmlFor="note" hint={t("common.optional")}>
          <textarea id="note" name="note" rows={2} defaultValue={meal?.note ?? ""} className={inputClass} maxLength={500} />
        </Field>

        {state.error ? <Alert>{state.error}</Alert> : null}

        <SubmitButton className="w-full">{t("common.save")}</SubmitButton>
      </form>

      {meal ? (
        <ConfirmForm action={deleteMealPlan} message={t("meals.removeConfirm")} className="mt-3">
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="id" value={meal.id} />
          <button type="submit" className="w-full text-sm font-medium text-danger">
            {t("meals.remove")}
          </button>
        </ConfirmForm>
      ) : null}
    </Sheet>
  );
}
