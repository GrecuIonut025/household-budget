"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/form-state";
import { describeDbError, getActionTranslator, readMoney } from "@/lib/actions";
import { requireAppContext } from "@/lib/data/context";
import { getProducts } from "@/lib/data/products";
import { getRetailersWithMonitorIds, listPriceDetails } from "@/lib/data/prices";
import { canWrite } from "@/lib/data/types";
import { lidlAdapter, monitorAdapter, productDraftFromLidlOffer } from "@/lib/prices/adapters";
import { matchOffer, manualMatch } from "@/lib/prices/matching";
import { parseSize } from "@/lib/prices/normalize";
import { AUTO_LINK_THRESHOLD, REVIEW_THRESHOLD, type AdapterOffer, type MatchCandidate } from "@/lib/prices/types";
import { computeUnitPrice, computeUnitPriceFromRaw } from "@/lib/prices/unit-price";
import { createClient } from "@/lib/supabase/server";

export interface PriceActionState extends ActionState {
  imported?: number;
  created?: number;
  warnings?: string[];
}

const str = (formData: FormData, name: string): string => {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
};

async function requireWriter(householdId: string) {
  const ctx = await requireAppContext();
  const t = await getActionTranslator();
  if (ctx.active.household.id !== householdId || !canWrite(ctx.active.role)) {
    return { ctx, t, allowed: false as const };
  }
  return { ctx, t, allowed: true as const };
}

function toCandidates(
  products: Awaited<ReturnType<typeof getProducts>>,
  retailers: { id: string; slug: string }[],
): MatchCandidate[] {
  const slugById = new Map(retailers.map((r) => [r.id, r.slug]));
  return products.map((p) => ({
    productId: p.id,
    name: p.name,
    brand: p.brand,
    barcodes: p.barcodes,
    packageSize: p.package_size,
    packageUnit: p.package_unit,
    category: p.category,
    preferredRetailerSlug: p.preferred_retailer_id ? (slugById.get(p.preferred_retailer_id) ?? null) : null,
  }));
}

async function upsertOffer(opts: {
  householdId: string;
  userId: string;
  productId: string;
  retailerId: string;
  offer: AdapterOffer;
  method: "barcode" | "name" | "manual" | "adapter_ref";
  confidence: number;
  verified: boolean;
}) {
  const unit =
    computeUnitPrice(opts.offer.price, parseSize(opts.offer.nameRaw) ?? parseSize(opts.offer.unitRaw)) ??
    null;
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("product_prices")
    .select("id, external_ref")
    .eq("household_id", opts.householdId)
    .eq("product_id", opts.productId)
    .eq("retailer_id", opts.retailerId)
    .is("store_id", null)
    .maybeSingle();

  const payload = {
    household_id: opts.householdId,
    product_id: opts.productId,
    retailer_id: opts.retailerId,
    store_id: null,
    price: opts.offer.price,
    currency: opts.offer.currency,
    unit_price: unit?.unitPrice ?? null,
    unit_label: unit?.unitLabel ?? null,
    is_promo: opts.offer.isPromo,
    loyalty_required: opts.offer.loyaltyRequired,
    source: opts.offer.adapter === "manual" ? ("manual" as const) : ("adapter" as const),
    match_method: opts.method,
    match_confidence: opts.confidence,
    is_verified: opts.verified,
    external_ref: opts.offer.externalRef,
    source_url: opts.offer.sourceUrl,
    observed_at: opts.offer.observedAt,
    created_by: opts.userId,
  };

  if (existing?.id) {
    const { error } = await supabase.from("product_prices").update(payload).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("product_prices").insert(payload);
    if (error) throw error;
  }

  await supabase.rpc("evaluate_price_alerts", {
    p_household_id: opts.householdId,
    p_product_id: opts.productId,
    p_retailer_id: opts.retailerId,
    p_price: opts.offer.price,
  });
}

async function ingestOffers(
  householdId: string,
  userId: string,
  offers: AdapterOffer[],
  products: Awaited<ReturnType<typeof getProducts>>,
  retailers: { id: string; slug: string }[],
) {
  const candidates = toCandidates(products, retailers);
  const retailerBySlug = new Map(retailers.map((r) => [r.slug, r.id]));
  const existing = await listPriceDetails(householdId);
  const priorByRef = new Map(
    existing.filter((e) => e.external_ref).map((e) => [e.external_ref as string, e.product_id]),
  );

  let imported = 0;
  const warnings: string[] = [];
  for (const offer of offers) {
    if (!(offer.price > 0)) continue; // never invent / never store sentinel
    const retailerId = retailerBySlug.get(offer.retailerSlug);
    if (!retailerId) {
      warnings.push(`Unknown retailer slug ${offer.retailerSlug}`);
      continue;
    }
    const decision = matchOffer(offer, candidates, { priorProductId: priorByRef.get(offer.externalRef) ?? null });
    if (!decision.productId) {
      warnings.push(`No match for “${offer.nameRaw}” (${offer.retailerSlug}).`);
      continue;
    }
    if (decision.needsReview) {
      warnings.push(`Uncertain match for “${offer.nameRaw}” → review suggested.`);
    }
    await upsertOffer({
      householdId,
      userId,
      productId: decision.productId,
      retailerId,
      offer,
      method: decision.method,
      confidence: decision.confidence,
      verified: !decision.needsReview,
    });
    imported += 1;
  }
  return { imported, warnings };
}

/** Pull Monitorul Prețurilor quotes for the household catalogue (favorites first). */
export async function refreshMonitorPrices(_: PriceActionState, formData: FormData): Promise<PriceActionState> {
  const householdId = str(formData, "householdId");
  const { ctx, t, allowed } = await requireWriter(householdId);
  if (!allowed) return { error: t("common.noPermission") };

  const [products, retailers] = await Promise.all([getProducts(householdId, { filter: "any" }), getRetailersWithMonitorIds()]);
  const tracked = products.filter((p) => !p.is_archived).sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite));
  const names = tracked.slice(0, 25).map((p) => p.name);
  if (names.length === 0) return { error: t("prices.noProducts") };

  const networkIds = retailers.map((r) => r.monitor_network_id).filter((x): x is string => !!x);
  const result = await monitorAdapter.fetchOffers({ queryNames: names, networkIds });
  if (!result.ok && result.offers.length === 0) {
    return { error: t("prices.adapterFailed", { source: monitorAdapter.label }), warnings: result.warnings };
  }

  try {
    const { imported, warnings } = await ingestOffers(householdId, ctx.user.id, result.offers, tracked, retailers);
    revalidatePath("/price-comparison");
    revalidatePath("/products");
    return {
      ok: true,
      message: t("prices.imported", { count: imported }),
      imported,
      warnings: [...result.warnings, ...warnings].slice(0, 12),
    };
  } catch (err) {
    return { error: describeDbError(err as { message: string; code?: string }, t) };
  }
}

type LidlWorkItem = {
  offer: AdapterOffer;
  productId: string;
  method: "barcode" | "name" | "manual" | "adapter_ref";
  confidence: number;
  verified: boolean;
  created: boolean;
};

/**
 * Pull Lidl's official daily XLSB.
 * High-confidence matches update prices on existing catalogue rows; unmatched rows
 * (including an empty catalogue) are imported as products (`data_source = lidl_xlsb`)
 * with preferred retailer Lidl, then priced from the file. Prices are never invented.
 */
export async function refreshLidlPrices(_: PriceActionState, formData: FormData): Promise<PriceActionState> {
  const householdId = str(formData, "householdId");
  const { ctx, t, allowed } = await requireWriter(householdId);
  if (!allowed) return { error: t("common.noPermission") };

  const result = await lidlAdapter.fetchOffers({});
  if (!result.ok || result.offers.length === 0) {
    const detail = result.ok ? undefined : result.error;
    return {
      error: detail
        ? t("prices.adapterFailedDetail", { source: lidlAdapter.label, detail })
        : t("prices.adapterFailed", { source: lidlAdapter.label }),
      warnings: result.warnings,
    };
  }

  const [products, retailers] = await Promise.all([
    getProducts(householdId, { filter: "any", limit: 10_000 }),
    getRetailersWithMonitorIds(),
  ]);
  const lidlRetailer = retailers.find((r) => r.slug === "lidl");
  if (!lidlRetailer) return { error: t("prices.adapterFailed", { source: lidlAdapter.label }) };

  const tracked = products.filter((p) => !p.is_archived);
  const candidates = toCandidates(tracked, retailers);
  const existingPrices = await listPriceDetails(householdId);
  const priorByRef = new Map(
    existingPrices.filter((e) => e.external_ref).map((e) => [e.external_ref as string, e.product_id]),
  );
  const productByName = new Map(tracked.map((p) => [p.name.toLowerCase(), p.id]));

  const warnings: string[] = [...result.warnings];
  const linked: LidlWorkItem[] = [];
  /** Drafts pending insert, keyed by lower(name) so one catalogue row covers duplicate file lines. */
  const pendingByName = new Map<
    string,
    { draft: NonNullable<ReturnType<typeof productDraftFromLidlOffer>>; offers: AdapterOffer[] }
  >();

  for (const offer of result.offers) {
    if (!(offer.price > 0)) continue;

    const decision = matchOffer(offer, candidates, {
      priorProductId: priorByRef.get(offer.externalRef) ?? null,
    });

    if (decision.productId && decision.confidence >= REVIEW_THRESHOLD) {
      if (decision.needsReview) {
        warnings.push(`Uncertain match for “${offer.nameRaw}” → review suggested.`);
      }
      linked.push({
        offer,
        productId: decision.productId,
        method: decision.method,
        confidence: decision.confidence,
        verified: !decision.needsReview,
        created: false,
      });
      continue;
    }

    const draft = productDraftFromLidlOffer(offer);
    if (!draft) continue;
    const key = draft.name.toLowerCase();
    const existingId = productByName.get(key);
    if (existingId) {
      linked.push({
        offer,
        productId: existingId,
        method: "name",
        confidence: AUTO_LINK_THRESHOLD,
        verified: true,
        created: false,
      });
      continue;
    }
    const pending = pendingByName.get(key);
    if (pending) pending.offers.push(offer);
    else pendingByName.set(key, { draft, offers: [offer] });
  }

  const supabase = await createClient();
  let created = 0;

  try {
    const pendingEntries = [...pendingByName.values()];
    for (let i = 0; i < pendingEntries.length; i += 100) {
      const chunk = pendingEntries.slice(i, i + 100);
      const rows = chunk.map(({ draft }) => ({
        household_id: householdId,
        name: draft.name,
        brand: draft.brand,
        category: draft.category,
        unit: draft.unit,
        package_size: draft.packageSize,
        package_unit: draft.packageUnit,
        preferred_retailer_id: lidlRetailer.id,
        data_source: draft.dataSource,
        created_by: ctx.user.id,
      }));
      const { data, error } = await supabase.from("products").insert(rows).select("id, name");
      if (error) {
        // Fall back to one-by-one so a single conflict does not abort the whole refresh.
        for (const { draft, offers } of chunk) {
          const { data: one, error: oneErr } = await supabase
            .from("products")
            .insert({
              household_id: householdId,
              name: draft.name,
              brand: draft.brand,
              category: draft.category,
              unit: draft.unit,
              package_size: draft.packageSize,
              package_unit: draft.packageUnit,
              preferred_retailer_id: lidlRetailer.id,
              data_source: draft.dataSource,
              created_by: ctx.user.id,
            })
            .select("id")
            .single();
          let productId = typeof one?.id === "string" ? one.id : null;
          let didCreate = false;
          if (oneErr || !productId) {
            const { data: again } = await supabase
              .from("products")
              .select("id")
              .eq("household_id", householdId)
              .ilike("name", draft.name.replace(/[%_]/g, "\\$&"))
              .is("brand", null)
              .maybeSingle();
            productId = typeof again?.id === "string" ? again.id : null;
            if (!productId) {
              warnings.push(`Could not create “${draft.name}”: ${oneErr?.message ?? "missing id"}`);
              continue;
            }
          } else {
            didCreate = true;
            created += 1;
          }
          productByName.set(draft.name.toLowerCase(), productId);
          for (const offer of offers) {
            linked.push({
              offer,
              productId,
              method: "adapter_ref",
              confidence: 1,
              verified: true,
              created: didCreate,
            });
          }
        }
        continue;
      }

      for (const row of data ?? []) {
        const name = row.name as string;
        const productId = row.id as string;
        productByName.set(name.toLowerCase(), productId);
        const pending = pendingByName.get(name.toLowerCase());
        if (!pending) continue;
        created += 1;
        for (const offer of pending.offers) {
          linked.push({
            offer,
            productId,
            method: "adapter_ref",
            confidence: 1,
            verified: true,
            created: true,
          });
        }
      }
    }

    // Prefer the latest observation when the file repeats the same external ref.
    const byRef = new Map<string, LidlWorkItem>();
    for (const item of linked) byRef.set(item.offer.externalRef, item);
    const work = [...byRef.values()];

    let imported = 0;
    // Existing catalogue matches: one-by-one so alerts still evaluate.
    for (const item of work.filter((w) => !w.created)) {
      await upsertOffer({
        householdId,
        userId: ctx.user.id,
        productId: item.productId,
        retailerId: lidlRetailer.id,
        offer: item.offer,
        method: item.method,
        confidence: item.confidence,
        verified: item.verified,
      });
      imported += 1;
    }

    // Fresh Lidl imports have no alerts yet — batch insert prices.
    const fresh = work.filter((w) => w.created);
    for (let i = 0; i < fresh.length; i += 100) {
      const chunk = fresh.slice(i, i + 100);
      const payloads = chunk.map((item) => {
        const unit =
          computeUnitPrice(item.offer.price, parseSize(item.offer.nameRaw) ?? parseSize(item.offer.unitRaw)) ?? null;
        return {
          household_id: householdId,
          product_id: item.productId,
          retailer_id: lidlRetailer.id,
          store_id: null,
          price: item.offer.price,
          currency: item.offer.currency,
          unit_price: unit?.unitPrice ?? null,
          unit_label: unit?.unitLabel ?? null,
          is_promo: item.offer.isPromo,
          loyalty_required: item.offer.loyaltyRequired,
          source: "adapter" as const,
          match_method: item.method,
          match_confidence: item.confidence,
          is_verified: item.verified,
          external_ref: item.offer.externalRef,
          source_url: item.offer.sourceUrl,
          observed_at: item.offer.observedAt,
          created_by: ctx.user.id,
        };
      });
      const { error: priceError } = await supabase.from("product_prices").insert(payloads);
      if (priceError) throw priceError;
      imported += chunk.length;
    }

    revalidatePath("/price-comparison");
    revalidatePath("/products");
    return {
      ok: true,
      message: t("prices.lidlImported", { prices: imported, products: created }),
      imported,
      created,
      warnings: warnings.slice(0, 12),
    };
  } catch (err) {
    return { error: describeDbError(err as { message: string; code?: string }, t) };
  }
}

/** Manual shelf / loyalty price entry. */
export async function saveManualPrice(_: PriceActionState, formData: FormData): Promise<PriceActionState> {
  const householdId = str(formData, "householdId");
  const { ctx, t, allowed } = await requireWriter(householdId);
  if (!allowed) return { error: t("common.noPermission") };

  const parsed = z
    .object({
      productId: z.uuid(),
      retailerId: z.uuid(),
      observedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .safeParse({
      productId: str(formData, "productId"),
      retailerId: str(formData, "retailerId"),
      observedOn: str(formData, "observedOn"),
    });
  if (!parsed.success) return { error: t("prices.invalidManual") };

  const price = readMoney(formData.get("price"));
  if (price === undefined || price === null || !(price > 0)) return { error: t("prices.invalidPrice") };

  const loyaltyRequired = str(formData, "loyaltyRequired") === "true" || str(formData, "loyaltyRequired") === "on";
  const isPromo = str(formData, "isPromo") === "true" || str(formData, "isPromo") === "on";

  const products = await getProducts(householdId, { filter: "any" });
  const product = products.find((p) => p.id === parsed.data.productId);
  if (!product) return { error: t("prices.invalidManual") };

  const unit = computeUnitPriceFromRaw(price, product.package_size, product.package_unit, product.name);
  const decision = manualMatch(product.id);
  const offer: AdapterOffer = {
    adapter: "manual",
    retailerSlug: "manual",
    externalRef: `manual:${product.id}:${parsed.data.retailerId}:${parsed.data.observedOn}`,
    nameRaw: product.name,
    brandRaw: product.brand,
    unitRaw: null,
    categoryRaw: product.category,
    price,
    currency: "RON",
    isPromo,
    loyaltyRequired,
    gtin: product.barcodes[0] ?? null,
    observedAt: `${parsed.data.observedOn}T12:00:00.000Z`,
    sourceUrl: null,
    storeExternalId: null,
    storeName: null,
  };

  try {
    // Bypass slug lookup — retailer id is already known.
    const supabase = await createClient();
    const payload = {
      household_id: householdId,
      product_id: product.id,
      retailer_id: parsed.data.retailerId,
      store_id: null,
      price,
      currency: ctx.active.household.currency || "RON",
      unit_price: unit?.unitPrice ?? null,
      unit_label: unit?.unitLabel ?? null,
      is_promo: isPromo,
      loyalty_required: loyaltyRequired,
      source: "manual" as const,
      match_method: decision.method,
      match_confidence: decision.confidence,
      is_verified: true,
      external_ref: offer.externalRef,
      source_url: null,
      observed_at: offer.observedAt,
      created_by: ctx.user.id,
    };
    const { data: existing } = await supabase
      .from("product_prices")
      .select("id")
      .eq("household_id", householdId)
      .eq("product_id", product.id)
      .eq("retailer_id", parsed.data.retailerId)
      .is("store_id", null)
      .maybeSingle();
    const { error } = existing?.id
      ? await supabase.from("product_prices").update(payload).eq("id", existing.id)
      : await supabase.from("product_prices").insert(payload);
    if (error) return { error: describeDbError(error, t) };

    await supabase.rpc("evaluate_price_alerts", {
      p_household_id: householdId,
      p_product_id: product.id,
      p_retailer_id: parsed.data.retailerId,
      p_price: price,
    });

    revalidatePath("/price-comparison");
    revalidatePath(`/products/${product.id}`);
    return { ok: true, message: t("prices.manualSaved") };
  } catch (err) {
    return { error: describeDbError(err as { message: string; code?: string }, t) };
  }
}

export async function savePriceAlert(_: PriceActionState, formData: FormData): Promise<PriceActionState> {
  const householdId = str(formData, "householdId");
  const { ctx, t, allowed } = await requireWriter(householdId);
  if (!allowed) return { error: t("common.noPermission") };

  const productId = str(formData, "productId");
  const retailerId = str(formData, "retailerId") || null;
  const direction = str(formData, "direction") === "above" ? "above" : "below";
  const target = readMoney(formData.get("targetPrice"));
  if (!z.uuid().safeParse(productId).success || target === undefined || target === null || !(target > 0)) {
    return { error: t("prices.invalidAlert") };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("price_alerts").upsert(
    {
      household_id: householdId,
      product_id: productId,
      retailer_id: retailerId,
      user_id: ctx.user.id,
      direction,
      target_price: target,
      is_active: true,
    },
    { onConflict: "user_id,product_id,retailer_id,direction" },
  );
  if (error) return { error: describeDbError(error, t) };
  revalidatePath("/price-comparison");
  return { ok: true, message: t("prices.alertSaved") };
}

export async function togglePriceAlert(formData: FormData): Promise<void> {
  const householdId = str(formData, "householdId");
  const id = str(formData, "id");
  const { ctx, allowed } = await requireWriter(householdId);
  if (!allowed) return;
  const supabase = await createClient();
  const active = str(formData, "isActive") === "true";
  await supabase
    .from("price_alerts")
    .update({ is_active: !active })
    .eq("id", id)
    .eq("household_id", householdId)
    .eq("user_id", ctx.user.id);
  revalidatePath("/price-comparison");
}

export async function deletePriceAlert(formData: FormData): Promise<void> {
  const householdId = str(formData, "householdId");
  const id = str(formData, "id");
  const { ctx, allowed } = await requireWriter(householdId);
  if (!allowed) return;
  const supabase = await createClient();
  await supabase.from("price_alerts").delete().eq("id", id).eq("household_id", householdId).eq("user_id", ctx.user.id);
  revalidatePath("/price-comparison");
}

export async function verifyPriceMatch(formData: FormData): Promise<void> {
  const householdId = str(formData, "householdId");
  const id = str(formData, "id");
  const { allowed } = await requireWriter(householdId);
  if (!allowed) return;
  const supabase = await createClient();
  await supabase
    .from("product_prices")
    .update({ is_verified: true, match_confidence: 1, match_method: "manual" })
    .eq("id", id)
    .eq("household_id", householdId);
  revalidatePath("/price-comparison");
}
