"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { categoryLabel } from "@/lib/i18n/category";
import type { CategoryRow, MemberRow } from "@/lib/data/types";
import { inputClass } from "./ui";

export interface TransactionFilterValues {
  month: string;
  type: string;
  category: string;
  member: string;
  scope: string;
}

export function TransactionFilters({
  values,
  categories,
  members,
}: {
  values: TransactionFilterValues;
  categories: CategoryRow[];
  members: MemberRow[];
}) {
  const { t } = useI18n();
  const router = useRouter();

  function update(name: keyof TransactionFilterValues, value: string) {
    const next = { ...values, [name]: value };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
    router.push(`/transactions?${params.toString()}`);
  }

  const select = "min-h-11 w-full max-w-full py-2 text-sm";
  return (
    <div
      className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 lg:grid-cols-4"
      role="group"
      aria-label={t("tx.title")}
    >
      <select aria-label={t("tx.filterType")} value={values.type} onChange={(e) => update("type", e.target.value)} className={`${inputClass} ${select}`}>
        <option value="">{t("tx.filterType")}: {t("common.all")}</option>
        <option value="expense">{t("common.expense")}</option>
        <option value="income">{t("common.income")}</option>
      </select>
      <select aria-label={t("tx.filterCategory")} value={values.category} onChange={(e) => update("category", e.target.value)} className={`${inputClass} ${select}`}>
        <option value="">{t("tx.filterCategory")}: {t("common.all")}</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {categoryLabel(t, c)}
          </option>
        ))}
      </select>
      <select aria-label={t("tx.filterMember")} value={values.member} onChange={(e) => update("member", e.target.value)} className={`${inputClass} ${select}`}>
        <option value="">{t("tx.filterMember")}: {t("common.all")}</option>
        {members.map((m) => (
          <option key={m.user_id} value={m.user_id}>
            {m.display_name}
          </option>
        ))}
      </select>
      <select aria-label={t("tx.filterScope")} value={values.scope} onChange={(e) => update("scope", e.target.value)} className={`${inputClass} ${select}`}>
        <option value="">{t("tx.filterScope")}: {t("common.all")}</option>
        <option value="shared">{t("common.shared")}</option>
        <option value="individual">{t("common.individual")}</option>
      </select>
    </div>
  );
}
