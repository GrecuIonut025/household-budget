import { barcodeVariants, isValidGtin, normalizeBarcode } from "@/lib/products/gtin";
import { jaccardTokens, normaliseProductText, sizeCompatible, trigramSimilarity } from "./normalize";
import {
  ADAPTER_REF_CONFIDENCE,
  AUTO_LINK_THRESHOLD,
  GTIN_CONFIDENCE,
  REVIEW_THRESHOLD,
  type AdapterOffer,
  type MatchCandidate,
  type MatchDecision,
  type MatchScoreParts,
} from "./types";

function emptyParts(): MatchScoreParts {
  return { nameSim: 0, brandMatch: 0, sizeMatch: 0, categoryMatch: 0 };
}

function scoreParts(offer: AdapterOffer, candidate: MatchCandidate): MatchScoreParts {
  const offerN = normaliseProductText(offer.nameRaw, offer.brandRaw);
  const candN = normaliseProductText(candidate.name, candidate.brand);
  const nameSim = Math.max(jaccardTokens(offerN.tokens, candN.tokens), trigramSimilarity(offerN.nameNorm, candN.nameNorm));
  const brandMatch =
    offerN.brandNorm && candN.brandNorm
      ? offerN.brandNorm === candN.brandNorm
        ? 1
        : offerN.brandNorm.includes(candN.brandNorm) || candN.brandNorm.includes(offerN.brandNorm)
          ? 0.7
          : 0
      : 0.4;
  const sizeMatch = sizeCompatible(offerN.size, candidate.packageSize, candidate.packageUnit);
  const categoryMatch =
    offer.categoryRaw && candidate.category
      ? normaliseProductText(offer.categoryRaw).nameNorm.includes(normaliseProductText(candidate.category).nameNorm) ||
        normaliseProductText(candidate.category).nameNorm.includes(normaliseProductText(offer.categoryRaw).nameNorm)
        ? 1
        : 0.2
      : 0.5;
  return { nameSim, brandMatch, sizeMatch, categoryMatch };
}

function combine(parts: MatchScoreParts, sizeHardFail: boolean): number {
  if (sizeHardFail) return Math.min(0.5, 0.45 * parts.nameSim + 0.25 * parts.brandMatch);
  return Math.min(
    1,
    0.45 * parts.nameSim + 0.25 * parts.brandMatch + 0.25 * parts.sizeMatch + 0.05 * parts.categoryMatch,
  );
}

function privateLabelClash(offer: AdapterOffer, candidate: MatchCandidate): boolean {
  const offerN = normaliseProductText(offer.nameRaw, offer.brandRaw);
  const candN = normaliseProductText(candidate.name, candidate.brand);
  if (!offerN.isPrivateLabel && !candN.isPrivateLabel) return false;
  if (offerN.privateLabelFamily && candN.privateLabelFamily && offerN.privateLabelFamily !== candN.privateLabelFamily) {
    return true;
  }
  // Private-label offer claiming identity with a different retailer's product is never auto-linked across chains.
  if (offerN.isPrivateLabel && candidate.preferredRetailerSlug && offer.retailerSlug !== candidate.preferredRetailerSlug) {
    return offerN.privateLabelFamily !== null && offerN.privateLabelFamily !== offer.retailerSlug.replace("-", "");
  }
  return false;
}

/**
 * Picks the best household product for an adapter offer.
 * Order: EAN → prior adapter_ref (caller) → brand+size+name → fuzzy. Never invents a product or a price.
 */
export function matchOffer(
  offer: AdapterOffer,
  candidates: readonly MatchCandidate[],
  opts: { priorProductId?: string | null } = {},
): MatchDecision {
  if (opts.priorProductId) {
    const prior = candidates.find((c) => c.productId === opts.priorProductId);
    if (prior) {
      return {
        productId: prior.productId,
        method: "adapter_ref",
        confidence: ADAPTER_REF_CONFIDENCE,
        needsReview: false,
        reason: "reuse prior adapter link",
        parts: null,
      };
    }
  }

  if (offer.gtin) {
    const code = normalizeBarcode(offer.gtin);
    if (isValidGtin(code) && !/^2\d{7,}$/.test(code)) {
      const variants = new Set(barcodeVariants(code));
      const hit = candidates.find((c) => c.barcodes.some((b) => variants.has(b)));
      if (hit) {
        return {
          productId: hit.productId,
          method: "barcode",
          confidence: GTIN_CONFIDENCE,
          needsReview: false,
          reason: "EAN exact match",
          parts: null,
        };
      }
    }
  }

  let best: { candidate: MatchCandidate; confidence: number; parts: MatchScoreParts } | null = null;
  for (const candidate of candidates) {
    if (privateLabelClash(offer, candidate)) continue;
    const parts = scoreParts(offer, candidate);
    const offerN = normaliseProductText(offer.nameRaw, offer.brandRaw);
    const sizeHardFail = parts.sizeMatch === 0 && offerN.size !== null && candidate.packageSize !== null;
    const confidence = combine(parts, sizeHardFail);
    if (!best || confidence > best.confidence) best = { candidate, confidence, parts };
  }

  if (!best || best.confidence < REVIEW_THRESHOLD) {
    return {
      productId: null,
      method: "name",
      confidence: best?.confidence ?? 0,
      needsReview: true,
      reason: "no confident match",
      parts: best?.parts ?? emptyParts(),
    };
  }

  const needsReview = best.confidence < AUTO_LINK_THRESHOLD;
  return {
    productId: best.candidate.productId,
    method: "name",
    confidence: Number(best.confidence.toFixed(3)),
    needsReview,
    reason: needsReview ? "uncertain name match" : "brand/size/name match",
    parts: best.parts,
  };
}

/** Manual entry is always verified at confidence 1. */
export function manualMatch(productId: string): MatchDecision {
  return {
    productId,
    method: "manual",
    confidence: 1,
    needsReview: false,
    reason: "user entered",
    parts: null,
  };
}
