"use client";

import { Pencil, ShoppingBasket } from "lucide-react";
import { useState } from "react";
import type { MemberRow } from "@/lib/data/types";
import { useI18n } from "@/lib/i18n/provider";
import type { ProductWithBarcodes, RetailerRow } from "@/lib/products/types";
import { buttonClass } from "../ui";
import { ProductSheet } from "./product-form";
import { PurchaseSheet } from "./purchase-form";

export function ProductActions({
  householdId,
  product,
  imageUrl,
  retailers,
  members,
  currentUserId,
  currency,
  today,
}: {
  householdId: string;
  product: ProductWithBarcodes;
  imageUrl: string | null;
  retailers: RetailerRow[];
  members: MemberRow[];
  currentUserId: string;
  currency: string;
  today: string;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [buying, setBuying] = useState(false);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass()} onClick={() => setBuying(true)}>
          <ShoppingBasket size={18} aria-hidden />
          {t("products.recordPurchase")}
        </button>
        <button type="button" className={buttonClass("secondary")} onClick={() => setEditing(true)}>
          <Pencil size={18} aria-hidden />
          {t("common.edit")}
        </button>
      </div>
      <PurchaseSheet
        open={buying}
        onClose={() => setBuying(false)}
        product={product}
        retailers={retailers}
        members={members}
        currentUserId={currentUserId}
        currency={currency}
        today={today}
      />
      <ProductSheet
        open={editing}
        onClose={() => setEditing(false)}
        householdId={householdId}
        retailers={retailers}
        product={product}
        imageUrl={imageUrl}
      />
    </>
  );
}
