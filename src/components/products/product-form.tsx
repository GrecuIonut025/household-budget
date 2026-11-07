"use client";

import { ImagePlus, Loader2, Package, Search, Trash2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { lookupOpenFoodFacts, saveProduct } from "@/app/actions/products";
import { useI18n } from "@/lib/i18n/provider";
import { parseBarcodeList } from "@/lib/products/gtin";
import { OFF_ATTRIBUTION, type OffProduct } from "@/lib/products/open-food-facts";
import {
  PACKAGE_UNITS,
  PRODUCT_CATEGORIES,
  PRODUCT_UNITS,
  type PackageUnit,
  type ProductDataSource,
  type ProductUnit,
  type ProductWithBarcodes,
  type RetailerRow,
} from "@/lib/products/types";
import { Sheet } from "../sheet";
import { SubmitButton } from "../submit-button";
import { Alert, Field, buttonClass, inputClass } from "../ui";
import { removeProductImage, uploadProductImage } from "./image-upload";

export interface ProductFormProps {
  householdId: string;
  retailers: RetailerRow[];
  product?: ProductWithBarcodes | null;
  imageUrl?: string | null;
  /** barcode captured by the scanner for a product that is not in the catalogue yet */
  initialBarcode?: string;
  onDone: (productId?: string) => void;
}

function ProductFormBody({ householdId, retailers, product, imageUrl, initialBarcode, onDone }: ProductFormProps) {
  const { t } = useI18n();
  const [state, action] = useActionState(saveProduct, {});
  const [newId] = useState(() => crypto.randomUUID());
  const productId = product?.id ?? newId;

  const [name, setName] = useState(product?.name ?? "");
  const [brand, setBrand] = useState(product?.brand ?? "");
  const [unit, setUnit] = useState<ProductUnit>(product?.unit ?? "pcs");
  const [packageSize, setPackageSize] = useState(product?.package_size ? String(product.package_size) : "");
  const [packageUnit, setPackageUnit] = useState<PackageUnit | "">(product?.package_unit ?? "");
  const [barcodes, setBarcodes] = useState(product ? product.barcodes.join("\n") : (initialBarcode ?? ""));
  const [dataSource, setDataSource] = useState<ProductDataSource>(product?.data_source ?? "manual");

  const [imagePath, setImagePath] = useState(product?.image_path ?? "");
  const [preview, setPreview] = useState<string | null>(imageUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const uploadedHere = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [offState, setOffState] = useState<"idle" | "loading" | "found" | "not_found" | "rate_limited" | "unavailable">("idle");
  const [offProduct, setOffProduct] = useState<OffProduct | null>(null);
  const [, startTransition] = useTransition();

  const finished = useRef(false);
  useEffect(() => {
    if (state.ok && !finished.current) {
      finished.current = true;
      onDone(state.productId);
    }
  }, [state.ok, state.productId, onDone]);

  const firstBarcode = parseBarcodeList(barcodes).valid[0];

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setImageError(false);
    try {
      const path = await uploadProductImage(householdId, productId, file);
      if (uploadedHere.current) await removeProductImage(uploadedHere.current).catch(() => undefined);
      uploadedHere.current = path;
      setImagePath(path);
      setPreview(URL.createObjectURL(file));
    } catch {
      setImageError(true);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function lookup() {
    if (!firstBarcode) return;
    setOffState("loading");
    startTransition(async () => {
      const result = await lookupOpenFoodFacts(firstBarcode);
      if (result.status === "found") {
        setOffProduct(result.product);
        setName(result.product.name);
        setBrand(result.product.brand ?? "");
        if (result.product.packageSize && result.product.packageUnit) {
          setPackageSize(String(result.product.packageSize));
          setPackageUnit(result.product.packageUnit);
        }
        setDataSource("open_food_facts");
        setOffState("found");
      } else if (result.status === "not_found") setOffState("not_found");
      else if (result.status === "rate_limited") setOffState("rate_limited");
      else setOffState("unavailable");
    });
  }

  const categoryValue = product?.category ?? "";
  const knownCategory = (PRODUCT_CATEGORIES as readonly string[]).includes(categoryValue);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="householdId" value={householdId} />
      {product ? <input type="hidden" name="id" value={product.id} /> : <input type="hidden" name="newId" value={newId} />}
      <input type="hidden" name="imagePath" value={imagePath} />
      <input type="hidden" name="dataSource" value={dataSource} />

      <div className="flex items-center gap-4">
        <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface-2 text-muted">
          {uploading ? (
            <Loader2 size={24} className="animate-spin" aria-label={t("products.imageUploading")} />
          ) : preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="size-full object-cover" />
          ) : (
            <Package size={28} aria-hidden />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            capture="environment"
            className="sr-only"
            id="product-image"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <label htmlFor="product-image" className={buttonClass("secondary", "cursor-pointer")}>
            <ImagePlus size={18} aria-hidden />
            {preview ? t("products.imageChange") : t("products.imageAdd")}
          </label>
          {preview ? (
            <button
              type="button"
              className={buttonClass("ghost", "min-h-9")}
              onClick={() => {
                setPreview(null);
                setImagePath("");
              }}
            >
              <Trash2 size={16} aria-hidden />
              {t("products.imageRemove")}
            </button>
          ) : null}
        </div>
      </div>
      {imageError ? <Alert>{t("products.imageError")}</Alert> : null}

      <Field label={t("products.barcodes")} htmlFor="barcodes" hint={t("products.barcodesHint")}>
        <textarea
          id="barcodes"
          name="barcodes"
          rows={2}
          inputMode="numeric"
          value={barcodes}
          onChange={(e) => setBarcodes(e.target.value)}
          className={`${inputClass} font-mono`}
        />
      </Field>

      {!product && firstBarcode ? (
        <div className="space-y-2 rounded-[var(--radius-md)] border border-border bg-surface-2 p-3">
          <button type="button" onClick={lookup} disabled={offState === "loading"} className={buttonClass("secondary", "w-full")}>
            {offState === "loading" ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Search size={18} aria-hidden />}
            {t("products.offLookup")}
          </button>
          <p className="text-xs text-muted">{t("products.offHint")}</p>
          {offState === "found" && offProduct ? (
            <p role="status" className="text-sm">
              {t("products.offPrefilled")}{" "}
              <a href={offProduct.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-strong underline">
                {t("products.offViewSource")}
              </a>
            </p>
          ) : null}
          {offState === "not_found" ? <p role="status" className="text-sm">{t("products.offNotFound")}</p> : null}
          {offState === "rate_limited" ? <p role="status" className="text-sm">{t("products.offRateLimited")}</p> : null}
          {offState === "unavailable" ? <p role="status" className="text-sm">{t("products.offUnavailable")}</p> : null}
        </div>
      ) : null}
      {dataSource === "open_food_facts" ? (
        <p className="text-xs text-muted">
          {t("products.offAttribution")}{" "}
          <a href={OFF_ATTRIBUTION.url} target="_blank" rel="noopener noreferrer" className="underline">
            {OFF_ATTRIBUTION.name}
          </a>{" "}
          (
          <a href={OFF_ATTRIBUTION.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline">
            {OFF_ATTRIBUTION.licenseName}
          </a>
          )
        </p>
      ) : null}

      <Field label={t("products.name")} htmlFor="name">
        <input id="name" name="name" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Field>
      <Field label={`${t("products.brand")} (${t("common.optional")})`} htmlFor="brand">
        <input id="brand" name="brand" maxLength={120} value={brand} onChange={(e) => setBrand(e.target.value)} className={inputClass} />
      </Field>
      <Field label={t("products.category")} htmlFor="category">
        <select id="category" name="category" defaultValue={categoryValue} className={inputClass}>
          <option value="">{t("products.noCategory")}</option>
          {PRODUCT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`products.cat.${c}`)}
            </option>
          ))}
          {categoryValue && !knownCategory ? <option value={categoryValue}>{categoryValue}</option> : null}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("products.unit")} htmlFor="unit" hint={t("products.unitHint")}>
          <select id="unit" name="unit" value={unit} onChange={(e) => setUnit(e.target.value as ProductUnit)} className={inputClass}>
            {PRODUCT_UNITS.map((u) => (
              <option key={u} value={u}>
                {t(`products.unit.${u}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("products.packageSize")} htmlFor="packageSize" hint={t("products.packageSizeHint")}>
          <div className="flex gap-2">
            <input
              id="packageSize"
              name="packageSize"
              inputMode="decimal"
              autoComplete="off"
              placeholder="500"
              value={packageSize}
              onChange={(e) => setPackageSize(e.target.value)}
              className={`${inputClass} min-w-0`}
            />
            <select
              name="packageUnit"
              aria-label={t("products.packageUnit")}
              value={packageUnit}
              onChange={(e) => setPackageUnit(e.target.value as PackageUnit | "")}
              className={`${inputClass} w-24 shrink-0`}
            >
              <option value="">—</option>
              {PACKAGE_UNITS.map((u) => (
                <option key={u} value={u}>
                  {t(`products.unit.${u}`)}
                </option>
              ))}
            </select>
          </div>
        </Field>
      </div>

      <Field label={t("products.preferredRetailer")} htmlFor="preferredRetailerId">
        <select id="preferredRetailerId" name="preferredRetailerId" defaultValue={product?.preferred_retailer_id ?? ""} className={inputClass}>
          <option value="">{t("products.noRetailer")}</option>
          {retailers.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex min-h-11 items-center gap-3 rounded-[var(--radius-md)] border border-border px-3 text-sm">
          <input type="checkbox" name="isFavorite" defaultChecked={product?.is_favorite} className="size-5 accent-brand" />
          {t("products.favorite")}
        </label>
        <label className="flex min-h-11 items-center gap-3 rounded-[var(--radius-md)] border border-border px-3 text-sm">
          <input type="checkbox" name="isFrequent" defaultChecked={product?.is_frequent} className="size-5 accent-brand" />
          {t("products.frequent")}
        </label>
      </div>

      <Field label={`${t("products.notes")} (${t("common.optional")})`} htmlFor="notes">
        <textarea id="notes" name="notes" rows={2} maxLength={1000} defaultValue={product?.notes ?? ""} className={inputClass} />
      </Field>

      {state.error ? <Alert>{state.error}</Alert> : null}
      <SubmitButton className="w-full" disabled={uploading}>
        {t("common.save")}
      </SubmitButton>
    </form>
  );
}

export function ProductSheet({
  open,
  onClose,
  onSaved,
  ...props
}: Omit<ProductFormProps, "onDone"> & { open: boolean; onClose: () => void; onSaved?: (productId?: string) => void }) {
  const { t } = useI18n();
  return (
    <Sheet open={open} onClose={onClose} title={props.product ? t("products.edit") : t("products.add")}>
      <ProductFormBody
        {...props}
        onDone={(id) => {
          onSaved?.(id);
          onClose();
        }}
      />
    </Sheet>
  );
}
