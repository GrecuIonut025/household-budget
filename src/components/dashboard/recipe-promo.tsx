import Link from "next/link";
import { ArrowRight, ChefHat, Clock, Heart, Users } from "lucide-react";
import { buttonClass } from "@/components/ui";

export function RecipePromo({
  title,
  body,
  cta,
  recipe,
}: {
  title: string;
  body: string;
  cta: string;
  recipe?: {
    id: string;
    title: string;
    imageUrl: string | null;
    minutes: number;
    servings: number;
    difficultyLabel?: string;
  } | null;
}) {
  if (!recipe) {
    return (
      <section className="relative overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-[var(--shadow-card)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/recipe-promo.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f1b] via-[#0f0f1b]/75 to-[#0f0f1b]/25" />
        <div className="relative flex min-h-[14rem] flex-col justify-end gap-3 p-5">
          <h2 className="text-lg font-semibold leading-snug text-white">{title}</h2>
          <p className="text-sm leading-relaxed text-white/70">{body}</p>
          <Link href="/recipes" className={buttonClass("primary", "w-fit")}>
            {cta} <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-[var(--shadow-card)]">
      <div className="mb-0 flex items-center justify-between gap-2 px-4 pt-4">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
      </div>
      <div className="relative mx-4 mt-3 aspect-[16/10] overflow-hidden rounded-[var(--radius-md)] bg-surface-2">
        {recipe.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={recipe.imageUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-brand/50">
            <ChefHat size={40} aria-hidden />
          </div>
        )}
        <span className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur">
          <Heart size={14} aria-hidden />
        </span>
      </div>
      <div className="space-y-3 p-4">
        <h3 className="truncate text-base font-semibold text-fg">{recipe.title}</h3>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          {recipe.minutes > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Clock size={13} aria-hidden />
              {recipe.minutes} min
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Users size={13} aria-hidden />
            {recipe.servings}
          </span>
          {recipe.difficultyLabel ? <span>{recipe.difficultyLabel}</span> : null}
        </div>
        <Link
          href={`/recipes/${recipe.id}`}
          className="brand-gradient inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3.5 py-2.5 text-sm font-semibold text-brand-fg transition hover:opacity-95"
        >
          {cta} <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
    </section>
  );
}
