import clsx from "clsx";
import type { CommunityGrade } from "@/lib/community/grades";
import type { Translate } from "@/lib/i18n";

const TONE: Record<CommunityGrade, string> = {
  1: "border-slate-500/40 bg-slate-500/15 text-slate-300",
  2: "border-slate-400/40 bg-slate-400/15 text-slate-200",
  3: "border-cyan-500/40 bg-cyan-500/15 text-cyan-300",
  4: "border-sky-500/40 bg-sky-500/15 text-sky-300",
  5: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  6: "border-lime-500/40 bg-lime-500/15 text-lime-300",
  7: "border-amber-500/40 bg-amber-500/15 text-amber-300",
  8: "border-orange-500/40 bg-orange-500/15 text-orange-300",
  9: "border-rose-500/40 bg-rose-500/15 text-rose-300",
  10: "border-violet-400/50 bg-violet-500/20 text-violet-200",
};

export function GradeBadge({
  grade,
  t,
  className,
}: {
  grade: CommunityGrade;
  t: Translate;
  className?: string;
}) {
  return (
    <span
      title={t("community.grade.title", { grade, name: t(`community.grade.${grade}`) })}
      className={clsx(
        "inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase",
        TONE[grade],
        className,
      )}
    >
      {t("community.grade.short", { grade })}
    </span>
  );
}
