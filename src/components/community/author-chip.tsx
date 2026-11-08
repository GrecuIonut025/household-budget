import Link from "next/link";
import clsx from "clsx";
import { GradeBadge } from "@/components/community/grade-badge";
import type { CommunityAuthor } from "@/lib/data/community";
import type { Translate } from "@/lib/i18n";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return (parts[0]!.slice(0, 1) + parts[1]!.slice(0, 1)).toUpperCase();
}

export function AuthorChip({
  author,
  t,
  size = "md",
  className,
  avatarOnly = false,
}: {
  author: CommunityAuthor;
  t: Translate;
  size?: "sm" | "md";
  className?: string;
  /** Avatar link only — for Instagram-style comment rows. */
  avatarOnly?: boolean;
}) {
  const avatarSize = size === "sm" ? "size-7 text-[10px]" : "size-9 text-xs";
  const avatar = (
    <span
      className={clsx(
        "grid shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-surface-2 font-semibold text-fg",
        avatarSize,
      )}
    >
      {author.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={author.avatarUrl} alt="" className="size-full object-cover" />
      ) : (
        initials(author.displayName)
      )}
    </span>
  );

  if (avatarOnly) {
    return (
      <Link
        href={`/community/members/${author.id}`}
        aria-label={author.displayName}
        className={clsx("inline-flex shrink-0 rounded-full transition hover:opacity-90", className)}
      >
        {avatar}
      </Link>
    );
  }

  return (
    <Link
      href={`/community/members/${author.id}`}
      className={clsx(
        "group inline-flex min-w-0 max-w-full items-center gap-2 rounded-xl transition hover:opacity-90",
        className,
      )}
    >
      {avatar}
      <span className="min-w-0 flex flex-col">
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            className={clsx(
              "truncate font-semibold text-fg group-hover:text-brand-strong",
              size === "sm" ? "text-xs" : "text-sm",
            )}
          >
            {author.displayName}
          </span>
          <GradeBadge grade={author.grade} t={t} />
        </span>
        {size === "md" ? (
          <span className="text-[11px] text-muted">{t("community.postedBy")}</span>
        ) : null}
      </span>
    </Link>
  );
}
