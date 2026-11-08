# Price comparison & adapters

Supermarket quotes for the household catalogue (`/price-comparison`), manual shelf entry, history charts and
personal price alerts. Prices are **never invented** — only adapter observations and user-entered amounts are stored.

## Adapters (`src/lib/prices/adapters`)

| Adapter | Retailers | Role |
| --- | --- | --- |
| **Monitorul Prețurilor** (`monitor`) | All 7 seeded chains | On-demand pull for catalogue names near a UAT / lat-lon (default Cluj-Napoca). XML `pmonsvc`, no EAN. |
| **Lidl daily XLSB** (`lidl_xlsb`) | Lidl | Official national permanent-range file. High-confidence matches update prices on existing catalogue products; unmatched rows (including an empty catalogue) are imported as products (`data_source = lidl_xlsb`, preferred retailer Lidl) then priced from the file. Prices are never invented. |
| **Open Food Facts** (`open_food_facts`) | none | Barcode **metadata** only (ODbL). Never emits prices; used to enrich matching when a GTIN is known. |
| **Glovo Brașov** (local catalog) | Profi, Carrefour, Kaufland, Mega Image (`brv`) | Separate `glovo_*` tables + Comparare prețuri search UI. See [GLOVO.md](./GLOVO.md). Not a household-catalogue adapter; does not invent prices. |

Matching order (`src/lib/prices/matching.ts`): EAN → prior `external_ref` → brand+size+name → fuzzy. Confidence
&lt; 0.75 is stored with `is_verified = false` and shown as “Check match”. Private labels are not auto-linked across
retailers as the same product.

## Schema additions (`20261108150000_prices_adapter_support.sql`)

- `retailers.monitor_network_id` — pmonsvc network ids for the seven RO chains.
- `product_prices.loyalty_required` — manual loyalty-card quotes (adapters do not supply these).
- `evaluate_price_alerts(household, product, retailer, price)` — marks matching active alerts as triggered.

Existing tables `product_prices`, `product_price_history` (append-only via trigger) and `price_alerts` are reused.

## UI

- Comparison page: refresh adapters, confirm uncertain matches, per-product quote list, history chart, alerts.
- Product detail: current quotes, history chart, manual price entry (incl. promo / loyalty flags).
