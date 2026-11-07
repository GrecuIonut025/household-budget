import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function RecipePromo({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta: string;
}) {
  return (
    <section className="relative overflow-hidden rounded-[var(--radius-lg)] bg-chart-surface shadow-[var(--shadow-card)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/recipe-promo.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-45"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-chart-surface via-chart-surface/85 to-transparent" />
      <div className="relative flex min-h-[11.5rem] flex-col justify-center gap-3 p-5 sm:max-w-[62%] sm:p-6">
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
