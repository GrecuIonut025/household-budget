"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, ImagePlus, LoaderCircle, Plus, Sparkles } from "lucide-react";
import { publishRecipeToCommunity } from "@/app/actions/community";
import { StorageImage } from "@/components/media/storage-image";
import { Sheet } from "@/components/sheet";
import { buttonClass } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";

export type ComposeRecipe = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
};

export function ComposeTrigger({
  householdId,
  recipes,
  variant = "icon",
}: {
  householdId: string;
  recipes: ComposeRecipe[];
  variant?: "icon" | "cta";
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("community.compose.title")}
        className={
          variant === "cta"
            ? buttonClass("primary", "gap-2")
            : "inline-flex size-10 items-center justify-center rounded-xl border border-border bg-surface text-fg transition hover:bg-surface-2 active:scale-95"
        }
      >
        <Plus size={variant === "cta" ? 16 : 20} aria-hidden strokeWidth={2.25} />
        {variant === "cta" ? t("community.compose.title") : null}
      </button>
      <ComposeSheet
        open={open}
        onClose={() => setOpen(false)}
        householdId={householdId}
        recipes={recipes}
      />
    </>
  );
}

export function ComposeSheet({
  open,
  onClose,
  householdId,
  recipes,
}: {
  open: boolean;
  onClose: () => void;
  householdId: string;
  recipes: ComposeRecipe[];
}) {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const selected = recipes.find((r) => r.id === selectedId) ?? null;

  function close() {
    setSelectedId(null);
    onClose();
  }

  return (
    <Sheet open={open} onClose={close} title={t("community.compose.title")}>
      {recipes.length === 0 ? (
        <div className="space-y-4 py-4 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand">
            <ImagePlus size={24} aria-hidden />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-fg">{t("community.compose.emptyTitle")}</p>
            <p className="text-sm text-muted">{t("community.compose.emptyBody")}</p>
          </div>
          <Link href="/recipes/new" className={buttonClass("primary")} onClick={close}>
            {t("community.recipesEmptyCta")}
          </Link>
        </div>
      ) : selected ? (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="text-xs font-medium text-brand hover:text-brand-strong"
          >
            {t("community.compose.back")}
          </button>
          <div className="overflow-hidden rounded-2xl border border-border bg-surface-2">
            <div className="relative aspect-square w-full bg-surface-2">
              {selected.imageUrl ? (
                <StorageImage src={selected.imageUrl} sizes="(max-width: 640px) 100vw, 512px" />
              ) : (
                <div className="grid size-full place-items-center text-brand/40">
                  <Sparkles size={40} aria-hidden />
                </div>
              )}
            </div>
            <div className="space-y-1 border-t border-border-soft p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                {t("community.compose.caption")}
              </p>
              <p className="text-sm font-semibold text-fg">{selected.title}</p>
              {selected.description ? (
                <p className="line-clamp-3 text-sm text-muted">{selected.description}</p>
              ) : null}
            </div>
          </div>
          <form
            action={(fd) => {
              startTransition(async () => {
                await publishRecipeToCommunity(fd);
                close();
              });
            }}
          >
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="recipeId" value={selected.id} />
            <button
              type="submit"
              disabled={pending}
              className={buttonClass("primary", "w-full justify-center gap-2")}
            >
              {pending ? (
                <LoaderCircle size={16} className="animate-spin" aria-hidden />
              ) : (
                <Check size={16} aria-hidden />
              )}
              {t("community.compose.publish")}
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">{t("community.compose.pick")}</p>
          <ul className="space-y-2">
            {recipes.map((recipe) => (
              <li key={recipe.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(recipe.id)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface-2/50 p-2 text-left transition hover:border-brand/40 hover:bg-surface-2"
                >
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                    {recipe.imageUrl ? (
                      <StorageImage src={recipe.imageUrl} sizes="56px" />
                    ) : (
                      <span className="grid size-full place-items-center text-brand/40">
                        <Sparkles size={18} aria-hidden />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-fg">
                      {recipe.title}
                    </span>
                    {recipe.description ? (
                      <span className="mt-0.5 line-clamp-1 text-xs text-muted">
                        {recipe.description}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  );
}
