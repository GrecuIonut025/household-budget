"use client";

import clsx from "clsx";
import { ImagePlus, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useRef, useState } from "react";
import { saveRecipe } from "@/app/actions/recipes";
import { Alert, Button, Card, CardTitle, Field, buttonClass, inputClass } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n";
import { newUuid } from "@/lib/id";
import { priceBasisFromProduct } from "@/lib/recipes/pricing";
import { RECIPE_CATEGORIES, parseQuantityInput, type RecipePayload } from "@/lib/recipes/schema";
import type { ProductOption, RecipeWithIngredients } from "@/lib/recipes/types";
import { createClient } from "@/lib/supabase/browser";
import { UNITS, type Unit } from "@/lib/units";
import { ProductPicker } from "./product-picker";

const MEDIA_BUCKET = "household-media";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };

interface SubRow {
  key: string;
  productId: string | null;
  name: string;
  quantity: string;
  unit: Unit | "";
  note: string;
}

interface IngredientRow {
  key: string;
  productId: string | null;
  name: string;
  quantity: string;
  unit: Unit | "";
  isOptional: boolean;
  isAtHome: boolean;
  note: string;
  substitutions: SubRow[];
}

const newKey = () => newUuid();
const emptyIngredient = (): IngredientRow => ({
  key: newKey(),
  productId: null,
  name: "",
  quantity: "",
  unit: "",
  isOptional: false,
  isAtHome: false,
  note: "",
  substitutions: [],
});

function formatNumber(n: number | null, locale: string): string {
  if (n === null) return "";
  const s = String(n);
  return locale === "ro" ? s.replace(".", ",") : s;
}

function toRows(recipe: RecipeWithIngredients | null, locale: string): IngredientRow[] {
  if (!recipe) return [emptyIngredient()];
  return recipe.ingredients.map((i) => ({
    key: newKey(),
    productId: i.product_id,
    name: i.name,
    quantity: formatNumber(i.quantity, locale),
    unit: i.unit ?? "",
    isOptional: i.is_optional,
    isAtHome: i.is_at_home,
    note: i.note ?? "",
    substitutions: i.substitutions.map((s) => ({
      key: newKey(),
      productId: s.product_id,
      name: s.name,
      quantity: formatNumber(s.quantity, locale),
      unit: s.unit ?? "",
      note: s.note ?? "",
    })),
  }));
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--brand)]" />
      {label}
    </label>
  );
}

export interface RecipeEditorProps {
  householdId: string;
  recipeId: string;
  recipe: RecipeWithIngredients | null;
  imageUrl: string | null;
  products: ProductOption[];
}

export function RecipeEditor({ householdId, recipeId, recipe, imageUrl, products }: RecipeEditorProps) {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState(saveRecipe, {});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState(recipe?.title ?? "");
  const [description, setDescription] = useState(recipe?.description ?? "");
  const [servings, setServings] = useState(formatNumber(recipe?.servings ?? 2, locale));
  const [prep, setPrep] = useState(formatNumber(recipe?.prep_minutes ?? null, locale));
  const [cook, setCook] = useState(formatNumber(recipe?.cook_minutes ?? null, locale));
  const [category, setCategory] = useState<string>(recipe?.category ?? "");
  const [tags, setTags] = useState((recipe?.tags ?? []).join(", "));
  const [instructions, setInstructions] = useState(recipe?.instructions ?? "");
  const [sourceUrl, setSourceUrl] = useState(recipe?.source_url ?? "");
  const [rows, setRows] = useState<IngredientRow[]>(() => toRows(recipe, locale));

  const [imagePath, setImagePath] = useState<string | null>(recipe?.image_path ?? null);
  const [preview, setPreview] = useState<string | null>(imageUrl);
  const fileRef = useRef<File | null>(null);
  const uploadedRef = useRef<{ file: File; path: string } | null>(null);

  const updateRow = (key: string, patch: Partial<IngredientRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const updateSub = (rowKey: string, subKey: string, patch: Partial<SubRow>) =>
    setRows((rs) =>
      rs.map((r) => (r.key === rowKey ? { ...r, substitutions: r.substitutions.map((s) => (s.key === subKey ? { ...s, ...patch } : s)) } : r)),
    );

  function onPickPhoto(file: File | undefined) {
    if (!file) return;
    if (!PHOTO_TYPES[file.type] || file.size > MAX_PHOTO_BYTES) {
      setError(t("recipes.editor.photoInvalid"));
      return;
    }
    setError(null);
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    fileRef.current = file;
    setPreview(URL.createObjectURL(file));
  }

  function removePhoto() {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    fileRef.current = null;
    uploadedRef.current = null;
    setPreview(null);
    setImagePath(null);
  }

  function pickProduct(row: IngredientRow, product: ProductOption | null) {
    if (!product) return updateRow(row.key, { productId: null });
    const basis = priceBasisFromProduct(product);
    updateRow(row.key, {
      productId: product.id,
      name: row.name.trim() ? row.name : product.name,
      unit: row.unit || basis?.unit || "",
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const servingsValue = parseQuantityInput(servings);
    if (!title.trim() || servingsValue === null) return setError(t("recipes.editor.invalidBasics"));
    const minutes = (raw: string) => (raw.trim() === "" ? null : Number(raw.trim().replace(",", ".")));
    const prepValue = minutes(prep);
    const cookValue = minutes(cook);
    if ([prepValue, cookValue].some((m) => m !== null && (!Number.isInteger(m) || m < 0))) return setError(t("recipes.editor.invalidMinutes"));

    const ingredients: RecipePayload["ingredients"] = [];
    for (const row of rows) {
      if (!row.name.trim() && !row.quantity.trim() && !row.productId) continue;
      if (!row.name.trim()) return setError(t("recipes.editor.invalidIngredient"));
      const quantity = row.quantity.trim() ? parseQuantityInput(row.quantity) : null;
      if (row.quantity.trim() && quantity === null) return setError(t("recipes.editor.invalidQuantity", { name: row.name }));
      if (quantity !== null && !row.unit) return setError(t("recipes.editor.unitRequired", { name: row.name }));
      const substitutions: RecipePayload["ingredients"][number]["substitutions"] = [];
      for (const sub of row.substitutions) {
        if (!sub.name.trim()) continue;
        const subQuantity = sub.quantity.trim() ? parseQuantityInput(sub.quantity) : null;
        if (sub.quantity.trim() && subQuantity === null) return setError(t("recipes.editor.invalidQuantity", { name: sub.name }));
        if (subQuantity !== null && !sub.unit) return setError(t("recipes.editor.unitRequired", { name: sub.name }));
        substitutions.push({
          productId: sub.productId,
          name: sub.name.trim(),
          quantity: subQuantity,
          unit: subQuantity === null ? null : (sub.unit as Unit),
          note: sub.note.trim(),
        });
      }
      ingredients.push({
        productId: row.productId,
        name: row.name.trim(),
        quantity,
        unit: quantity === null ? null : (row.unit as Unit),
        isOptional: row.isOptional,
        isAtHome: row.isAtHome,
        note: row.note.trim(),
        substitutions,
      });
    }

    setBusy(true);
    let path = imagePath;
    const file = fileRef.current;
    if (file) {
      if (uploadedRef.current?.file === file) {
        path = uploadedRef.current.path;
      } else {
        const objectPath = `${householdId}/recipes/${recipeId}/${newUuid()}.${PHOTO_TYPES[file.type]}`;
        const { error: uploadError } = await createClient().storage.from(MEDIA_BUCKET).upload(objectPath, file, { contentType: file.type, upsert: false });
        if (uploadError) {
          setBusy(false);
          return setError(t("recipes.editor.photoFailed"));
        }
        uploadedRef.current = { file, path: objectPath };
        path = objectPath;
      }
    }

    const payload: RecipePayload = {
      id: recipeId,
      householdId,
      title: title.trim(),
      description: description.trim(),
      servings: servingsValue,
      prepMinutes: prepValue,
      cookMinutes: cookValue,
      category: (RECIPE_CATEGORIES as readonly string[]).includes(category) ? (category as RecipePayload["category"]) : null,
      tags: [...new Set(tags.split(",").map((s) => s.trim()).filter(Boolean))],
      instructions: instructions.trim(),
      sourceUrl: sourceUrl.trim(),
      imagePath: path,
      ingredients,
    };
    const formData = new FormData();
    formData.set("payload", JSON.stringify(payload));
    startTransition(() => {
      action(formData);
      setBusy(false);
    });
  }

  const unitLabel = (u: Unit) => t(`recipes.unit.${u}` as MessageKey);
  const shownError = error ?? state.error ?? null;

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Card className="space-y-4">
        <Field label={t("recipes.editor.photo")}>
          <div className="flex items-center gap-3">
            <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-lg)] bg-surface-2 text-muted">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="size-full object-cover" />
              ) : (
                <ImagePlus size={28} aria-hidden />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label className={clsx(buttonClass("secondary"), "cursor-pointer")}>
                <ImagePlus size={16} aria-hidden />
                {preview ? t("recipes.editor.changePhoto") : t("recipes.editor.addPhoto")}
                <input type="file" accept={Object.keys(PHOTO_TYPES).join(",")} className="sr-only" onChange={(e) => onPickPhoto(e.target.files?.[0])} />
              </label>
              {preview ? (
                <button type="button" onClick={removePhoto} className={buttonClass("ghost")}>
                  {t("recipes.editor.removePhoto")}
                </button>
              ) : null}
            </div>
          </div>
        </Field>

        <Field label={t("recipes.editor.title")} htmlFor="title">
          <input id="title" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label={t("recipes.servings")} htmlFor="servings">
            <input id="servings" required inputMode="decimal" value={servings} onChange={(e) => setServings(e.target.value)} className={clsx(inputClass, "tabular")} />
          </Field>
          <Field label={t("recipes.prepMinutes")} htmlFor="prep">
            <input id="prep" inputMode="numeric" value={prep} onChange={(e) => setPrep(e.target.value)} className={clsx(inputClass, "tabular")} />
          </Field>
          <Field label={t("recipes.cookMinutes")} htmlFor="cook">
            <input id="cook" inputMode="numeric" value={cook} onChange={(e) => setCook(e.target.value)} className={clsx(inputClass, "tabular")} />
          </Field>
        </div>

        <Field label={t("recipes.category")} htmlFor="category">
          <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
            <option value="">{t("recipes.category.none")}</option>
            {RECIPE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`recipes.category.${c}` as MessageKey)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t("recipes.editor.tags")} hint={t("recipes.editor.tagsHint")} htmlFor="tags">
          <input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} className={inputClass} />
        </Field>

        <Field label={`${t("recipes.editor.description")} (${t("common.optional")})`} htmlFor="description">
          <textarea id="description" rows={2} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </Field>
      </Card>

      <Card>
        <CardTitle>{t("recipes.ingredients")}</CardTitle>
        <p className="mb-3 text-xs text-muted">{t("recipes.editor.ingredientsHint")}</p>
        <ul className="space-y-4">
          {rows.map((row, index) => (
            <li key={row.key} className="space-y-2 rounded-[var(--radius-lg)] border border-border p-3">
              <div className="flex items-start gap-2">
                <div className="grid min-w-0 flex-1 gap-2">
                  <input
                    aria-label={`${t("recipes.editor.ingredientName")} ${index + 1}`}
                    placeholder={t("recipes.editor.ingredientName")}
                    value={row.name}
                    onChange={(e) => updateRow(row.key, { name: e.target.value })}
                    className={inputClass}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      aria-label={t("recipes.editor.quantity")}
                      placeholder={t("recipes.editor.quantity")}
                      inputMode="decimal"
                      value={row.quantity}
                      onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                      className={clsx(inputClass, "tabular")}
                    />
                    <select aria-label={t("recipes.editor.unit")} value={row.unit} onChange={(e) => updateRow(row.key, { unit: e.target.value as Unit | "" })} className={inputClass}>
                      <option value="">{t("recipes.editor.unit")}</option>
                      {UNITS.map((u) => (
                        <option key={u} value={u}>
                          {unitLabel(u)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <ProductPicker products={products} value={row.productId} onChange={(p) => pickProduct(row, p)} label={t("recipes.editor.searchProducts")} />
                </div>
                <button
                  type="button"
                  aria-label={t("recipes.editor.removeIngredient")}
                  onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
                  className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 size={18} aria-hidden />
                </button>
              </div>
              <div className="flex flex-wrap gap-x-4">
                <Toggle checked={row.isOptional} onChange={(v) => updateRow(row.key, { isOptional: v })} label={t("recipes.optional")} />
                <Toggle checked={row.isAtHome} onChange={(v) => updateRow(row.key, { isAtHome: v })} label={t("recipes.editor.alreadyAtHome")} />
              </div>
              <input
                aria-label={t("recipes.editor.note")}
                placeholder={t("recipes.editor.note")}
                maxLength={300}
                value={row.note}
                onChange={(e) => updateRow(row.key, { note: e.target.value })}
                className={inputClass}
              />

              {row.substitutions.length > 0 ? (
                <div className="space-y-2 rounded-[var(--radius-md)] bg-surface-2 p-2">
                  <p className="px-1 text-xs font-medium">{t("recipes.substitutions")}</p>
                  {row.substitutions.map((sub) => (
                    <div key={sub.key} className="space-y-2 rounded-[var(--radius-md)] bg-surface p-2">
                      <div className="flex items-center gap-2">
                        <input
                          aria-label={t("recipes.editor.substituteName")}
                          placeholder={t("recipes.editor.substituteName")}
                          value={sub.name}
                          onChange={(e) => updateSub(row.key, sub.key, { name: e.target.value })}
                          className={inputClass}
                        />
                        <button
                          type="button"
                          aria-label={t("recipes.editor.removeSubstitution")}
                          onClick={() =>
                            setRows((rs) => rs.map((r) => (r.key === row.key ? { ...r, substitutions: r.substitutions.filter((s) => s.key !== sub.key) } : r)))
                          }
                          className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger"
                        >
                          <X size={16} aria-hidden />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          aria-label={t("recipes.editor.quantity")}
                          placeholder={t("recipes.editor.sameQuantity")}
                          inputMode="decimal"
                          value={sub.quantity}
                          onChange={(e) => updateSub(row.key, sub.key, { quantity: e.target.value })}
                          className={clsx(inputClass, "tabular")}
                        />
                        <select aria-label={t("recipes.editor.unit")} value={sub.unit} onChange={(e) => updateSub(row.key, sub.key, { unit: e.target.value as Unit | "" })} className={inputClass}>
                          <option value="">{t("recipes.editor.unit")}</option>
                          {UNITS.map((u) => (
                            <option key={u} value={u}>
                              {unitLabel(u)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <ProductPicker
                        products={products}
                        value={sub.productId}
                        onChange={(p) => updateSub(row.key, sub.key, { productId: p?.id ?? null, name: sub.name.trim() || (p?.name ?? "") })}
                        label={t("recipes.editor.searchProducts")}
                      />
                    </div>
                  ))}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() =>
                  updateRow(row.key, { substitutions: [...row.substitutions, { key: newKey(), productId: null, name: "", quantity: "", unit: "", note: "" }] })
                }
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-brand hover:bg-brand-soft"
              >
                <Plus size={16} aria-hidden />
                {t("recipes.editor.addSubstitution")}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setRows((rs) => [...rs, emptyIngredient()])} className={clsx(buttonClass("secondary"), "mt-4 w-full")}>
          <Plus size={18} aria-hidden />
          {t("recipes.editor.addIngredient")}
        </button>
      </Card>

      <Card className="space-y-4">
        <Field label={t("recipes.instructions")} hint={t("recipes.editor.instructionsHint")} htmlFor="instructions">
          <textarea id="instructions" rows={8} maxLength={20000} value={instructions} onChange={(e) => setInstructions(e.target.value)} className={inputClass} />
        </Field>
        <Field label={`${t("recipes.editor.sourceUrl")} (${t("common.optional")})`} htmlFor="sourceUrl">
          <input id="sourceUrl" type="url" inputMode="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} className={inputClass} />
        </Field>
      </Card>

      {shownError ? <Alert>{shownError}</Alert> : null}
      <div className="sticky bottom-20 z-10 flex gap-3 md:static">
        <Link href={recipe ? `/recipes/${recipe.id}` : "/recipes"} className={clsx(buttonClass("secondary"), "flex-1 bg-surface")}>
          {t("common.cancel")}
        </Link>
        <Button type="submit" className="flex-1" disabled={busy || pending}>
          {busy || pending ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </form>
  );
}
