import type { ComparisonQuote, PriceAlertRow } from "./types";

export interface AlertTrigger {
  alertId: string;
  productId: string;
  price: number;
  retailerId: string;
}

/** Pure evaluation: which active alerts fire for the given quotes. */
export function evaluateAlerts(alerts: readonly PriceAlertRow[], quotes: readonly ComparisonQuote[]): AlertTrigger[] {
  const triggers: AlertTrigger[] = [];
  for (const alert of alerts) {
    if (!alert.isActive) continue;
    for (const q of quotes) {
      if (q.productId !== alert.productId) continue;
      if (alert.retailerId && alert.retailerId !== q.retailerId) continue;
      if (!(q.price > 0)) continue;
      const hit =
        (alert.direction === "below" && q.price <= alert.targetPrice) ||
        (alert.direction === "above" && q.price >= alert.targetPrice);
      if (!hit) continue;
      if (
        alert.lastTriggeredAt &&
        alert.lastTriggeredPrice === q.price &&
        Date.now() - Date.parse(alert.lastTriggeredAt) < 24 * 60 * 60 * 1000
      ) {
        continue;
      }
      triggers.push({ alertId: alert.id, productId: alert.productId, price: q.price, retailerId: q.retailerId });
    }
  }
  return triggers;
}
