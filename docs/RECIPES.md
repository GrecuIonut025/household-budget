# Recipes and recipe cost

## Data

Migration `20261107191500_recipes_extensions.sql` builds on `recipes` / `recipe_ingredients` / `pantry_items`:

| Change | Purpose |
| --- | --- |
| `recipes.category`, `recipes_image_path_scoped` check | category filter; a photo path must start with the recipe's own `<household_id>/` |
| `recipe_ingredients.is_at_home`, supported-unit check (`g kg ml l pcs`) | "already at home" flag; units the converter understands |
| `recipe_ingredient_substitutions` | optional substitutes (own product link, quantity/unit or "same as ingredient") |
| `product_unit_specs` | per-product `unit_weight_g`, `unit_volume_ml`, `density_g_per_ml` (all optional) |
| `save_recipe(household, recipe, ingredients)` | atomic create/update of a recipe with ingredients and substitutions; `SECURITY INVOKER`, so RLS applies |

Photos go to the private `household-media` bucket under `<household_id>/recipes/<recipe_id>/<uuid>.<ext>`; the
existing storage policies (members read, writers write, folder must be the caller's household) apply. The browser
uploads directly (no server-action body limit); the saved path is validated again by the action and the DB check.

## Unit conversion (`src/lib/units`)

Pure and typed. `g/kg`, `ml/l` and `pcs` convert within their dimension. Crossing dimensions needs product data:
pieces <-> mass needs `unit_weight_g`, pieces <-> volume needs `unit_volume_ml`, mass <-> volume needs
`density_g_per_ml`. Otherwise `convertQuantity` returns a typed error (`missing_unit_weight`, `missing_unit_volume`,
`missing_density`, `unknown_unit`, `invalid_quantity`); nothing is guessed, a density is never assumed or derived.

## Cost calculator (`src/lib/recipes`)

`computeRecipeCost` is pure (integer minor units) and takes a `PricingMap` built from the small `PricingLookup`
interface (`getPricing(productIds) -> ProductPricing[]`). `createSupabasePricingLookup` (in `src/lib/data/recipes.ts`)
is the database implementation; it only reads `products`, `product_prices`, `product_unit_specs` and `retailers`, so it
works with whatever the price adapters have written so far.

- An ingredient is priced proportionally: quantity used / quantity in the priced item x item price. One priced item
  is `package_size package_unit` if the product defines it, otherwise one product `unit` (`pack` without a size is
  not priceable).
- Cheapest retailer quote wins; every retailer is listed with its price. Prices in another currency and expired
  promotions are ignored.
- If no retailer price is usable, `products.last_price` (last purchase) is used and labelled `last_purchase`
  everywhere it is shown.
- No price, no product link, no quantity or an unsafe conversion gives an `unknown` line with a reason. Totals then
  cover known lines only and the UI shows them as a lower bound (`>=`); with nothing priced the total is `null`.
- Savings: per ingredient, dearest retailer minus cheapest. Single-shop baskets are compared for ingredients that
  have retailer prices.
- "At home": ingredient flag, plus pantry stock (`pantry_items` by product, converted to the ingredient unit; partial
  coverage reduces the amount still to buy). The recipe total stays the full value; "still to buy" excludes them.
- Optional ingredients are shown but not counted. Scaling (2/4/6/8 or the recipe's own servings) multiplies
  quantities and recomputes every cost client-side from the same pure function.
