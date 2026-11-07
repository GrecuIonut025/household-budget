"use client";

import { useActionState } from "react";
import { refreshLidlPrices, refreshMonitorPrices, type PriceActionState } from "@/app/actions/prices";
import { useI18n } from "@/lib/i18n/provider";
import { SubmitButton } from "../submit-button";
import { Alert } from "../ui";

function RefreshResult({ state }: { state: PriceActionState }) {
  const { t } = useI18n();
  if (!state.error && !state.ok) return null;
  return (
    <div className="space-y-2">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
      {state.warnings && state.warnings.length > 0 ? (
        <div className="rounded-[var(--radius-md)] border border-border bg-surface-2 p-3 text-xs text-muted">
          <p className="mb-1 font-medium text-fg">{t("prices.warnings")}</p>
          <ul className="list-inside list-disc space-y-0.5">
            {state.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function AdapterRefreshButtons({ householdId }: { householdId: string }) {
  const { t } = useI18n();
  const [monitorState, monitorAction] = useActionState(refreshMonitorPrices, {} as PriceActionState);
  const [lidlState, lidlAction] = useActionState(refreshLidlPrices, {} as PriceActionState);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <form action={monitorAction}>
          <input type="hidden" name="householdId" value={householdId} />
          <SubmitButton variant="secondary">{t("prices.refreshMonitor")}</SubmitButton>
        </form>
        <form action={lidlAction}>
          <input type="hidden" name="householdId" value={householdId} />
          <SubmitButton variant="secondary">{t("prices.refreshLidl")}</SubmitButton>
        </form>
      </div>
      <RefreshResult state={monitorState} />
      <RefreshResult state={lidlState} />
      <p className="text-xs text-muted">{t("prices.adaptersHint")}</p>
      <p className="text-xs text-muted">{t("prices.offNote")}</p>
    </div>
  );
}
