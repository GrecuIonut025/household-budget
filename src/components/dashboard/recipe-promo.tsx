import Link from "next/link";
import { ArrowRight, ChefHat, Clock, Heart, Users } from "lucide-react";

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
      <section className="relative flex min-h-[18rem] overflow-hidden rounded-[var(--radius-lg)] bg-chart-surface shadow-[var(--shadow-card)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/recipe-promo.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-chart-surface via-chart-surface/85 to-transparent" />
        <div className="relative flex min-h-[18rem] flex-col justify-center gap-3 p-5 sm:max-w-[62%] sm:p-6">
          <h2 className="text-lg font-semibold leading-snug text-sidebar-fg">{title}</h2>
          <p className="text-sm leading-relaxed text-sidebar-muted">{body}</p>
          <Link
            href="/recipes"
            className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-fg transition hover:bg-white/90"
          >
            {cta} <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-h-[18rem] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-[var(--shadow-card)]">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-surface-2">
        {recipe.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={recipe.imageUrl} alt="" className="size-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/images/recipe-promo.jpg" alt="" className="size-full object-cover opacity-80" />
        )}
        <span className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur">
          <Heart size={14} aria-hidden />
        </span>
        {!recipe.imageUrl ? (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-1 text-[11px] text-white">
            <ChefHat size={12} aria-hidden />
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
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
          className="brand-gradient mt-auto inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3.5 py-2.5 text-sm font-semibold text-brand-fg transition hover:opacity-95"
        >
          {cta} <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
    </section>
  );
}
