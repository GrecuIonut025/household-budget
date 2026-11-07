import Link from "next/link";
import { ArrowRight, ChefHat, Clock, Heart, Users } from "lucide-react";

export function RecipePromo({
  title,
  body,
  cta,
  communityLabel,
  recipe,
}: {
  title: string;
  body: string;
  cta: string;
  communityLabel?: string;
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
      <section className="dashboard-card flex flex-col justify-between p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
        <div>
          <div className="mb-4 flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-lg bg-orange-500/10 text-xs text-orange-400">
              🍳
            </span>
            <h3 className="text-base font-semibold text-fg">{title}</h3>
          </div>
          <div className="group relative mb-3 overflow-hidden rounded-2xl border border-border-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/recipe-promo.jpg"
              alt=""
              className="h-32 w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          </div>
          <p className="text-sm leading-relaxed text-muted">{body}</p>
          {communityLabel ? (
            <Link
              href="/community"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-400 transition-colors hover:text-purple-300"
            >
              {communityLabel} →
            </Link>
          ) : null}
        </div>
        <div className="mt-4 flex items-center gap-2 border-t border-border-soft pt-3">
          <Link
            href="/community"
            className="btn-gradient flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-300 hover:-translate-y-1"
          >
            {cta} <ArrowRight size={14} aria-hidden />
          </Link>
          <Link
            href="/community"
            className="inline-flex size-9 items-center justify-center rounded-xl border border-border-soft bg-surface-2 text-muted transition hover:scale-105 hover:text-pink-400"
            aria-label={cta}
          >
            <Heart size={16} aria-hidden />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="dashboard-card flex flex-col justify-between p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div>
        <div className="mb-4 flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-lg bg-orange-500/10 text-xs text-orange-400">
            🍳
          </span>
          <h3 className="text-base font-semibold text-fg">{title}</h3>
        </div>
        <div className="group relative mb-3 overflow-hidden rounded-2xl border border-border-soft">
          {recipe.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={recipe.imageUrl}
              alt=""
              className="h-32 w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/images/recipe-promo.jpg"
              alt=""
              className="h-32 w-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-105"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          {!recipe.imageUrl ? (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-1 text-[11px] text-white">
              <ChefHat size={12} aria-hidden />
            </span>
          ) : null}
        </div>
        <h4 className="text-sm font-bold tracking-tight text-fg">{recipe.title}</h4>
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-muted">
          {recipe.minutes > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Clock size={14} aria-hidden />
              {recipe.minutes} min
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Users size={14} aria-hidden />
            {recipe.servings}
          </span>
          {recipe.difficultyLabel ? <span>{recipe.difficultyLabel}</span> : null}
        </div>
        {communityLabel ? (
          <Link
            href="/community"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-400 transition-colors hover:text-purple-300"
          >
            {communityLabel} →
          </Link>
        ) : null}
      </div>
      <div className="mt-4 flex items-center gap-2 border-t border-border-soft pt-3">
        <Link
          href={`/recipes/${recipe.id}`}
          className="btn-gradient flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-300 hover:-translate-y-1"
        >
          {cta} <ArrowRight size={14} aria-hidden />
        </Link>
        <Link
          href={`/recipes/${recipe.id}`}
          className="inline-flex size-9 items-center justify-center rounded-xl border border-border-soft bg-surface-2 text-muted transition hover:scale-105 hover:text-pink-400"
          aria-label={cta}
        >
          <Heart size={16} aria-hidden />
        </Link>
      </div>
    </section>
  );
}
