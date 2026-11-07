import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { GenerateListButton } from "@/components/meals/generate-list-form";
import { MealPlannerBoard } from "@/components/meals/meal-planner-board";
import { Alert, Card, CardTitle, PageHeader, ProgressBar, Stat, buttonClass } from "@/components/ui";
import { requireAppContext } from "@/lib/data/context";
import { getActiveReservations, getCategories, getCurrentBudget, getTransactionsBetween, toEngineReservations, toEngineTransactions } from "@/lib/data/budget";
import { getMealPlansWithIngredients, toCostIngredients } from "@/lib/data/meal-plans";
import { createSupabasePricingLookup, getRecipesWithIngredients, getPantryStock } from "@/lib/data/recipes";
import { getRetailers } from "@/lib/data/shopping-lists";
import { canWrite } from "@/lib/data/types";
import { computeBudgetSummary } from "@/lib/budget-engine";
import { formatDate, todayFor } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import { formatMoney, toMinor } from "@/lib/money";
import { lookupPricing } from "@/lib/recipes/pricing";
import { estimateWeekMealBudget } from "@/lib/shopping/meal-cost";
import { isValidWeekStart, mondayOf, shiftWeek, weekContaining } from "@/lib/shopping/week";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("nav.mealPlanner") };
}

type Search = { week?: string };

export default async function MealPlannerPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const ctx = await requireAppContext();
  const { t, locale } = await getTranslator();
  const { household, role } = ctx.active;
  const writer = canWrite(role);
  const today = todayFor(household.timezone);

  const weekStart = isValidWeekStart(params.week) ? params.week : mondayOf(today);
  const week = weekContaining(weekStart);
  const prev = shiftWeek(week.start, -1);
  const next = shiftWeek(week.start, 1);

  const [meals, recipes, budget, categories, retailers] = await Promise.all([
    getMealPlansWithIngredients(household.id, week.start, week.end),
    getRecipesWithIngredients(household.id),
    getCurrentBudget(household.id, today),
    getCategories(household.id),
    getRetailers(),
  ]);

  let groceryRemainingMinor: number | null = null;
  if (budget) {
    const [txs, reservations] = await Promise.all([
      getTransactionsBetween(household.id, budget.start_date, budget.end_date),
      getActiveReservations(budget.id),
    ]);
    const summary = computeBudgetSummary({
      budget: {
        startDate: budget.start_date,
        endDate: budget.end_date,
        spendingLimit: budget.spending_limit === null ? null : toMinor(budget.spending_limit),
        groceryLimit: budget.grocery_limit === null ? null : toMinor(budget.grocery_limit),
      },
      transactions: toEngineTransactions(txs, categories),
      reservations: toEngineReservations(reservations),
      today,
    });
    groceryRemainingMinor = summary.groceryRemaining;
  }

  const productIds = meals.flatMap((m) => m.ingredients.flatMap((i) => (i.product_id ? [i.product_id] : [])));
  const lookup = await createSupabasePricingLookup({ householdId: household.id, currency: household.currency, today });
  const [pricing, pantry] = await Promise.all([lookupPricing(lookup, productIds), getPantryStock(household.id, productIds)]);

  const weekBudget = estimateWeekMealBudget({
    meals: meals.map((m) => ({
      id: m.id,
      planDate: m.plan_date,
      mealType: m.meal_type,
      recipeId: m.recipe_id,
      recipeTitle: m.recipe_title,
      customTitle: m.custom_title,
      baseServings: m.recipe_servings,
      targetServings: m.servings ?? m.recipe_servings ?? 2,
      ingredients: toCostIngredients(m.ingredients),
    })),
    pricing,
    pantry,
    groceryRemainingMinor,
  });

  const costs: Record<string, string | null> = {};
  for (const meal of weekBudget.meals) {
    costs[meal.id] = meal.toBuyMinor === null ? null : formatMoney(meal.toBuyMinor, household.currency, locale);
  }

  const money = (minor: number | null) => (minor === null ? "—" : formatMoney(minor, household.currency, locale));

  return (
    <>
      <PageHeader
        title={t("nav.mealPlanner")}
        subtitle={t("meals.subtitle")}
        action={
          writer ? (
            <GenerateListButton
              householdId={household.id}
              weekStart={week.start}
              defaultName={t("meals.weekOf", { date: formatDate(week.start, locale, { day: "numeric", month: "short" }) })}
              retailers={retailers}
            />
          ) : undefined
        }
      />

      <div className="mb-5 flex items-center justify-between gap-2">
        <Link href={`/meal-planner?week=${prev}`} className={buttonClass("secondary", "px-3")} aria-label={t("meals.prevWeek")}>
          <ChevronLeft size={18} aria-hidden />
        </Link>
        <div className="min-w-0 text-center">
          <p className="truncate text-sm font-semibold">
            {formatDate(week.start, locale, { day: "numeric", month: "short" })} –{" "}
            {formatDate(week.end, locale, { day: "numeric", month: "short", year: "numeric" })}
          </p>
          {week.start !== mondayOf(today) ? (
            <Link href="/meal-planner" className="text-xs font-medium text-brand">
              {t("meals.thisWeek")}
            </Link>
          ) : null}
        </div>
        <Link href={`/meal-planner?week=${next}`} className={buttonClass("secondary", "px-3")} aria-label={t("meals.nextWeek")}>
          <ChevronRight size={18} aria-hidden />
        </Link>
      </div>

      <Card className="mb-5">
        <CardTitle>{t("meals.budget.title")}</CardTitle>
        {weekBudget.estimatedToBuyMinor === null && meals.length === 0 ? (
          <p className="text-sm text-muted">{t("meals.budget.empty")}</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Stat label={t("meals.budget.toBuy")} value={money(weekBudget.estimatedToBuyMinor)} />
              <Stat
                label={t("meals.budget.groceryRemaining")}
                value={groceryRemainingMinor === null ? t("meals.budget.noLimit") : money(groceryRemainingMinor)}
                tone={weekBudget.exceedsGroceryBudget ? "danger" : "default"}
              />
            </div>
            {groceryRemainingMinor !== null && weekBudget.estimatedToBuyMinor !== null ? (
              <ProgressBar value={weekBudget.estimatedToBuyMinor} max={Math.max(groceryRemainingMinor, 1)} />
            ) : null}
            {weekBudget.exceedsGroceryBudget ? (
              <Alert>{t("meals.budget.over", { amount: money(weekBudget.overByMinor) })}</Alert>
            ) : weekBudget.estimatedToBuyMinor !== null && groceryRemainingMinor !== null ? (
              <Alert tone="ok">{t("meals.budget.ok")}</Alert>
            ) : null}
            {weekBudget.unknownMealCount > 0 ? (
              <p className="text-xs text-muted">{t("meals.budget.unknown", { count: weekBudget.unknownMealCount })}</p>
            ) : null}
          </div>
        )}
      </Card>

      <MealPlannerBoard
        householdId={household.id}
        days={week.days}
        meals={meals}
        recipes={recipes.map((r) => ({ id: r.id, title: r.title, servings: r.servings }))}
        canWrite={writer}
        costs={costs}
      />
      {!writer ? <p className="mt-4 text-center text-xs text-muted">{t("common.viewOnly")}</p> : null}
    </>
  );
}
