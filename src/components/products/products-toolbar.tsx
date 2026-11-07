"use client";

import { Plus, ScanBarcode } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { lookupBarcode } from "@/app/actions/products";
import { useI18n } from "@/lib/i18n/provider";
import type { RetailerRow } from "@/lib/products/types";
import { buttonClass } from "../ui";
import { ScannerSheet } from "./barcode-scanner";
import { ProductSheet } from "./product-form";

/** Add / scan entry points for the catalogue. A scan opens the product if the household has it, else the add form. */
export function ProductsToolbar({
  householdId,
  retailers,
  canWrite,
}: {
  householdId: string;
  retailers: RetailerRow[];
  canWrite: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [adding, setAdding] = useState(false);
  const [barcode, setBarcode] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleCode(code: string) {
    setError(null);
    startTransition(async () => {
      const result = await lookupBarcode(code);
      if (result.status === "found") {
        setScanning(false);
        router.push(`/products/${result.productId}`);
      } else if (result.status === "missing" && canWrite) {
        setScanning(false);
        setBarcode(result.barcode);
        setAdding(true);
      } else {
        setError(result.status === "missing" ? t("products.scanNotInCatalogue") : t("products.scanInvalid"));
      }
    });
  }

  return (
    <>
      <div className="flex gap-2">
        <button type="button" className={buttonClass("secondary")} onClick={() => setScanning(true)}>
          <ScanBarcode size={18} aria-hidden />
          <span className="hidden sm:inline">{t("products.scan")}</span>
          <span className="sr-only sm:hidden">{t("products.scan")}</span>
        </button>
        {canWrite ? (
          <button
            type="button"
            className={buttonClass()}
            onClick={() => {
              setBarcode(undefined);
              setAdding(true);
            }}
          >
            <Plus size={18} aria-hidden />
            <span className="hidden sm:inline">{t("products.add")}</span>
            <span className="sr-only sm:hidden">{t("products.add")}</span>
          </button>
        ) : null}
      </div>
      <ScannerSheet open={scanning} onClose={() => setScanning(false)} onCode={handleCode} busy={pending} error={error} />
      <ProductSheet
        open={adding}
        onClose={() => setAdding(false)}
        householdId={householdId}
        retailers={retailers}
        initialBarcode={barcode}
        onSaved={(id) => {
          if (id) router.push(`/products/${id}`);
        }}
      />
    </>
  );
}
