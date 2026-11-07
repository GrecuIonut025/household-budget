import Link from "next/link";
import { ArrowRight, Lightbulb } from "lucide-react";
import clsx from "clsx";
import type { CommunityTip } from "@/lib/community/tips";
import type { Translate } from "@/lib/i18n";

const ACCENT = {
  purple: "from-purple-600/20 to-indigo-600/10 text-purple-300 border-purple-500/20",
  cyan: "from-cyan-600/20 to-blue-600/10 text-cyan-300 border-cyan-500/20",
  emerald: "from-emerald-600/20 to-teal-600/10 text-emerald-300 border-emerald-500/20",
  amber: "from-amber-500/20 to-orange-500/10 text-amber-300 border-amber-500/20",
} as const;

export function TipCard({ tip, t }: { tip: CommunityTip; t: Translate }) {
  return (
    <article className="dashboard-card flex flex-col justify-between p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div>
        <div
          className={clsx(
            "mb-4 inline-flex size-11 items-center justify-center rounded-2xl border bg-gradient-to-br",
            ACCENT[tip.accent],
          )}
        >
          <Lightbulb size={20} aria-hidden />
        </div>
        <h3 className="text-base font-semibold text-fg">{t(tip.titleKey)}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t(tip.bodyKey)}</p>
      </div>
      <Link
        href={tip.href}
        className="btn-gradient mt-5 inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition hover:-translate-y-0.5"
      >
        {t(tip.ctaKey)} <ArrowRight size={14} aria-hidden />
      </Link>
    </article>
  );
}
