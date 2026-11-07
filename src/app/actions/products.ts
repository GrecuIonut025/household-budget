"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/form-state";
import { describeDbError, getActionTranslator, readMoney } from "@/lib/actions";
import { requireAppContext } from "@/lib/data/context";
import { findProductByBarcode, getProducts, getPurchasesSince } from "@/lib/data/products";
import { canWrite } from "@/lib/data/types";
import { isValidISODate } from "@/lib/dates";
import { todayFor } from "@/lib/format";
import { PRODUCT_MEDIA_BUCKET } from "@/lib/products/constants";
import { isValidGtin, normalizeBarcode, parseBarcodeList } from "@/lib/products/gtin";
import { lookupOpenFoodFacts as proxyOpenFoodFacts } from "@/lib/products/off-server";
import type { OffLookup } from "@/lib/products/open-food-facts";
import { pickRecurringItems, RECURRING_WINDOW_DAYS } from "@/lib/products/recurring-list";
import { PACKAGE_UNITS, PRODUCT_UNITS } from "@/lib/products/types";
import { getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export interface ProductActionState extends ActionState {
  productId?: string;
}

const str = (formData: FormData, name: string): string => {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
};

/** Optional positive decimal (accepts a comma); undefined when empty, null when invalid. */
function readDecimal(raw: string, maxDecimals = 3): number | null | undefined {
  const cleaned = raw.trim().replace(",", ".");
  if (!cleaned) return undefined;
  if (!new RegExp(`^\\d+(\\.\\d{1,${maxDecimals}})?$`).test(cleaned)) return null;
  const n = Number(cleaned);
  return n > 0 ? n : null;
}

const productSchema = z.object({
  householdId: z.uuid(),
  id: z.uuid().optional(),
  newId: z.uuid().optional(),
  name: z.string().trim().min(1).max(200),
  brand: z.string().trim().max(120),
  category: z.string().trim().max(60),
  unit: z.enum(PRODUCT_UNITS),
  packageUnit: z.enum(PACKAGE_UNITS).nullable(),
  preferredRetailerId: z.uuid().nullable(),
  notes: z.string().trim().max(1000),
  imagePath: z.string().max(300),
  dataSource: z.enum(["manual", "open_food_facts"]),
});

async function requireWriter(householdId: string) {
  const ctx = await requireAppContext();
  const t = await getActionTranslator();
  if (ctx.active.household.id !== householdId || !canWrite(ctx.active.role)) return { ctx, t, allowed: false as const };
  return { ctx, t, allowed: true as const };
}

export async function saveProduct(_: ProductActionState, formData: FormData): Promise<ProductActionState> {
  const { ctx, t, allowed } = await requireWriter(str(formData, "householdId"));
  if (!allowed) return { error: t("common.noPermission") };

  const packageSize = readDecimal(str(formData, "packageSize"));
  if (packageSize === null) return { error: t("products.invalidPackageSize") };

  const parsed = productSchema.safeParse({
    householdId: str(formData, "householdId"),
    id: str(formData, "id") || undefined,
    newId: str(formData, "newId") || undefined,
    name: str(formData, "name"),
    brand: str(formData, "brand"),
    category: str(formData, "category"),
    unit: str(formData, "unit") || "pcs",
    packageUnit: str(formData, "packageUnit") || null,
    preferredRetailerId: str(formData, "preferredRetailerId") || null,
    notes: str(formData, "notes"),
    imagePath: str(formData, "imagePath"),
    dataSource: str(formData, "dataSource") || "manual",
  });
  if (!parsed.success) return { error: t("products.invalidName") };
  const v = parsed.data;
  if (packageSize !== undefined && !v.packageUnit) return { error: t("products.invalidPackageSize") };
  if (v.imagePath && !v.imagePath.startsWith(`${v.householdId}/products/`)) return { error: t("common.errorGeneric") };

  const barcodes = parseBarcodeList(str(formData, "barcodes"));
  if (barcodes.invalid.length) return { error: t("products.invalidBarcodes", { codes: barcodes.invalid.join(", ") }) };

  const supabase = await createClient();

  if (barcodes.valid.length) {
    const { data: taken, error } = await supabase
      .from("product_barcodes")
      .select("barcode, product_id")
      .eq("household_id", v.householdId)
      .in("barcode", barcodes.valid);
    if (error) return { error: describeDbError(error, t) };
    const clash = (taken ?? []).find((row) => row.product_id !== v.id);
    if (clash) return { error: t("products.barcodeTaken", { code: clash.barcode as string }) };
  }

  const row = {
    household_id: v.householdId,
    name: v.name,
    brand: v.brand || null,
    category: v.category || null,
    unit: v.unit,
    package_size: packageSize ?? null,
    package_unit: packageSize === undefined ? null : v.packageUnit,
    preferred_retailer_id: v.preferredRetailerId,
    notes: v.notes || null,
    image_path: v.imagePath || null,
    is_favorite: formData.get("isFavorite") === "on",
    is_frequent: formData.get("isFrequent") === "on",
    data_source: v.dataSource,
  };
  const dbErrors = { "23505": t("products.duplicateName"), "23514": t("common.errorGeneric") };

  let productId = v.id;
  let previousImage: string | null = null;
  if (v.id) {
    const { data: before } = await supabase.from("products").select("image_path").eq("id", v.id).maybeSingle();
    previousImage = (before?.image_path as string | null | undefined) ?? null;
    const { data, error } = await supabase.from("products").update(row).eq("id", v.id).select("id");
    if (error) return { error: describeDbError(error, t, dbErrors) };
    if (!data?.length) return { error: t("common.noPermission") };
  } else {
    const { data, error } = await supabase
      .from("products")
      .insert({ ...row, ...(v.newId ? { id: v.newId } : {}), created_by: ctx.user.id })
      .select("id")
      .single();
    if (error) return { error: describeDbError(error, t, dbErrors) };
    productId = data.id as string;
  }
  if (!productId) return { error: t("common.errorGeneric") };

  const { data: existing, error: existingError } = await supabase
    .from("product_barcodes")
    .select("id, barcode")
    .eq("product_id", productId);
  if (existingError) return { error: describeDbError(existingError, t) };
  const keep = new Set(barcodes.valid);
  const removeIds = (existing ?? []).filter((b) => !keep.has(b.barcode as string)).map((b) => b.id as string);
  const have = new Set((existing ?? []).map((b) => b.barcode as string));
  const add = barcodes.valid.filter((b) => !have.has(b));
  if (removeIds.length) await supabase.from("product_barcodes").delete().in("id", removeIds);
  if (add.length) {
    const { error } = await supabase
      .from("product_barcodes")
      .insert(add.map((barcode) => ({ household_id: v.householdId, product_id: productId, barcode })));
    if (error) {
      if (!v.id) await supabase.from("products").delete().eq("id", productId);
      return { error: describeDbError(error, t, { "23505": t("products.barcodeTaken", { code: add.join(", ") }) }) };
    }
  }

  if (previousImage && previousImage !== v.imagePath) {
    await supabase.storage.from(PRODUCT_MEDIA_BUCKET).remove([previousImage]);
  }

  revalidatePath("/products", "layout");
  return { ok: true, message: t("products.saved"), productId };
}

export async function setProductFlag(formData: FormData): Promise<void> {
  const parsed = z
    .object({
      id: z.uuid(),
      field: z.enum(["is_favorite", "is_frequent", "is_archived"]),
      value: z.enum(["true", "false"]),
    })
    .safeParse({ id: str(formData, "id"), field: str(formData, "field"), value: str(formData, "value") });
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase
    .from("products")
    .update({ [parsed.data.field]: parsed.data.value === "true" })
    .eq("id", parsed.data.id);
  revalidatePath("/products", "layout");
}

/** Only products without purchases can be deleted; the rest are archived so history stays intact. */
export async function deleteProduct(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(str(formData, "id"));
  if (!id.success) return;
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("purchase_count, image_path").eq("id", id.data).maybeSingle();
  if (!data || Number(data.purchase_count) > 0) return;
  const { data: deleted } = await supabase.from("products").delete().eq("id", id.data).select("id");
  if (deleted?.length && data.image_path) {
    await supabase.storage.from(PRODUCT_MEDIA_BUCKET).remove([data.image_path as string]);
  }
  revalidatePath("/products", "layout");
  redirect("/products");
}

const purchaseSchema = z.object({
  productId: z.uuid(),
  retailerId: z.uuid().nullable(),
  purchasedBy: z.uuid().nullable(),
  scope: z.enum(["shared", "individual"]),
});

export async function recordPurchase(_: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getActionTranslator();
  const quantity = readDecimal(str(formData, "quantity"));
  if (!quantity) return { error: t("products.invalidQuantity") };
  const unitPrice = readMoney(formData.get("unitPrice"));
  if (!unitPrice || unitPrice <= 0) return { error: t("tx.invalidAmount") };
  const purchasedOn = str(formData, "purchasedOn");
  if (!isValidISODate(purchasedOn)) return { error: t("tx.invalidDate") };
  const parsed = purchaseSchema.safeParse({
    productId: str(formData, "productId"),
    retailerId: str(formData, "retailerId") || null,
    purchasedBy: str(formData, "purchasedBy") || null,
    scope: str(formData, "scope") || "shared",
  });
  if (!parsed.success) return { error: t("common.errorGeneric") };
  const v = parsed.data;
  if (v.scope === "individual" && !v.purchasedBy) return { error: t("common.errorGeneric") };

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_product_purchase", {
    p_product_id: v.productId,
    p_quantity: quantity,
    p_unit_price: unitPrice,
    p_purchased_on: purchasedOn,
    p_retailer_id: v.retailerId,
    p_purchased_by: v.purchasedBy,
    p_is_promo: formData.get("isPromo") === "on",
    p_scope: v.scope,
  });
  if (error) return { error: describeDbError(error, t, { "23514": t("products.invalidQuantity"), P0002: t("common.errorGeneric") }) };
  revalidatePath("/", "layout");
  return { ok: true, message: t("products.purchaseSaved") };
}

export interface RecurringListState extends ActionState {
  listId?: string;
  itemCount?: number;
}

export async function createRecurringList(_: RecurringListState, formData: FormData): Promise<RecurringListState> {
  const { ctx, t, allowed } = await requireWriter(str(formData, "householdId"));
  if (!allowed) return { error: t("common.noPermission") };
  const { household } = ctx.active;
  const today = todayFor(household.timezone);

  const [products, purchases] = await Promise.all([
    getProducts(household.id, { filter: "any" }),
    getPurchasesSince(household.id, today, RECURRING_WINDOW_DAYS),
  ]);
  const items = pickRecurringItems(products, purchases, today);
  if (items.length === 0) return { error: t("products.recurringNone") };

  const name = t("products.recurringListName", { date: today });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_shopping_list_from_products", {
    p_household_id: household.id,
    p_name: name,
    p_items: items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
  });
  if (error) return { error: describeDbError(error, t) };
  revalidatePath("/", "layout");
  return { ok: true, message: t("products.recurringCreated", { count: items.length }), listId: data as string, itemCount: items.length };
}

export type BarcodeLookupResult =
  | { status: "found"; productId: string }
  | { status: "missing"; barcode: string }
  | { status: "invalid" };

/** Household-first lookup used right after a scan. Never calls an external service. */
export async function lookupBarcode(raw: string): Promise<BarcodeLookupResult> {
  const barcode = normalizeBarcode(raw);
  if (!isValidGtin(barcode)) return { status: "invalid" };
  const ctx = await requireAppContext();
  const productId = await findProductByBarcode(ctx.active.household.id, barcode);
  return productId ? { status: "found", productId } : { status: "missing", barcode };
}

/** Explicit, user-initiated prefill from Open Food Facts (server-side proxy with cache and rate limits). */
export async function lookupOpenFoodFacts(raw: string): Promise<OffLookup> {
  const barcode = normalizeBarcode(raw);
  if (!isValidGtin(barcode)) return { status: "invalid" };
  const ctx = await requireAppContext();
  if (!canWrite(ctx.active.role)) return { status: "unavailable" };
  return proxyOpenFoodFacts(ctx.user.id, barcode, await getLocale());
}
