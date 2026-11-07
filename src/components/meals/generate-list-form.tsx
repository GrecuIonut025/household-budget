"use client";

import { useActionState, useState } from "react";
import { createShoppingListFromMealPlan } from "@/app/actions/meal-plans";
import type { RetailerOption } from "@/lib/data/shopping-lists";
import type { StrategyKind } from "@/lib/shopping/types";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n";
import { Sheet } from "@/components/sheet";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field, buttonClass, inputClass } from "@/components/ui";

const STRATEGIES: StrategyKind[] = ["cheapest_combo", "cheapest_single", "preferred", "min_visits"];

export function GenerateListButton({
  householdId,
  weekStart,
  defaultName,
  retailers,
}: {
  householdId: string;
  weekStart: string;
  defaultName: string;
  retailers: RetailerOption[];
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createShoppingListFromMealPlan, {});
  const [strategy, setStrategy] = useState<StrategyKind>("cheapest_combo");

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("primary")}>
        {t("meals.generateList")}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("meals.generateList")}>
        <p className="mb-4 text-sm text-muted">{t("meals.generateListHint")}</p>
        <form action={action} className="space-y-4">
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="weekStart" value={weekStart} />
          <input type="hidden" name="strategy" value={strategy} />

          <Field label={t("shopping.listName")} htmlFor="listName">
            <input id="listName" name="name" required defaultValue={defaultName} className={inputClass} maxLength={120} />
          </Field>

          <Field label={t("shopping.preferredShop")} htmlFor="preferredRetailerId">
            <select id="preferredRetailerId" name="preferredRetailerId" className={inputClass} defaultValue="">
              <option value="">{t("shopping.anyShop")}</option>
              {retailers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t("shopping.strategies")}</legend>
            <div className="space-y-2">
              {STRATEGIES.map((kind) => (
                <label key={kind} className="flex items-center gap-2 rounded-[var(--radius-md)] border border-border px-3 py-2.5 text-sm">
                  <input
                    type="radio"
                    name="strategyChoice"
                    checked={strategy === kind}
                    onChange={() => setStrategy(kind)}
                  />
                  {t(`shopping.strategy.${kind}` as MessageKey)}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="includeOptional" value="1" className="size-4 rounded border-border" />
            {t("shopping.includeOptional")}
          </label>

          {state.error ? <Alert>{state.error}</Alert> : null}
          <SubmitButton className="w-full">{t("meals.generateList")}</SubmitButton>
        </form>
      </Sheet>
    </>
  );
}
