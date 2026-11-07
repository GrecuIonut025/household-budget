# My Products

Personal, per-household product catalogue (`/products`), product detail (`/products/[id]`) and automatic rankings
(`/products/rankings`).

## Data

- `products` gained `is_favorite`, `is_frequent`, `preferred_retailer_id`, `data_source` (`manual | open_food_facts`)
  in `20261108140200_products_preferences.sql`. Statistics columns are still written only by the purchase-history
  triggers.
- `record_product_purchase()` (security invoker) creates the grocery expense transaction (attributed to the buyer) and
  the `product_purchase_history` row in one transaction; the existing triggers update the statistics.
- `create_shopping_list_from_products()` (security invoker) creates a `draft` shopping list. The `draft` value was
  added to `shopping_list_status` in `20261108140100_products_shopping_list_draft_status.sql`; names and estimated
  prices come from the products, never from the client.
- Product images use the existing private `household-media` bucket and its household-scoped policies. Path:
  `<household_id>/products/<product_id>/<uuid>.jpg`. No new policies were needed.

## Barcodes

`src/lib/products/gtin.ts` mirrors `is_valid_gtin()` (EAN-8, UPC-12, EAN-13, GTIN-14 with check digit). Lookups also
match the UPC-A/EAN-13 leading-zero spelling. Scanning uses the native `BarcodeDetector` when present and falls back to
`@zxing/browser` (loaded lazily). Camera access needs HTTPS; manual entry is always available.

## Open Food Facts

Only on an explicit button press, for one barcode, through the server action `lookupOpenFoodFacts`
(`src/lib/products/off-server.ts`): GTIN validated, per-member (15/min) and global (60/min) throttling, 24 h cache for
hits and 1 h for misses (in process memory, best effort per server instance), 4 s timeout, descriptive `User-Agent`
(override with `OPEN_FOOD_FACTS_USER_AGENT`). Only name, first brand and a simple single-pack size are used, to prefill
a form the user confirms; nothing is invented and images are not copied. The ODbL attribution is shown wherever OFF
data was used (`data_source = 'open_food_facts'`).

## Rankings

Pure functions in `src/lib/products/rankings.ts`: most purchased, most expensive recurring (>= 2 purchases, average
price per unit), highest price increases (latest unit price vs. quantity-weighted average of earlier purchases),
greatest potential savings (last paid price vs. cheapest fresh `product_prices` quote in the household currency,
scaled by quantity bought in the last 90 days; quotes older than 60 days are ignored; empty state when there are no
prices), most purchased per member.
