import Link from "next/link";
import type { CommunityAuthor } from "@/lib/data/community";
import type { Translate } from "@/lib/i18n";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return (parts[0]!.slice(0, 1) + parts[1]!.slice(0, 1)).toUpperCase();
}

/** Instagram-style author rings from recent feed authors (no separate stories backend). */
export function StoriesStrip({
  authors,
  t,
}: {
  authors: CommunityAuthor[];
  t: Translate;
}) {
  if (authors.length === 0) return null;

  return (
    <section
      aria-label={t("community.storiesLabel")}
      className="border-b border-border-soft"
    >
      <ul className="flex gap-3 overflow-x-auto px-1 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {authors.map((author) => (
          <li key={author.id} className="w-16 shrink-0">
            <Link
              href={`/community/members/${author.id}`}
              className="flex flex-col items-center gap-1.5"
            >
              <span className="rounded-full bg-gradient-to-tr from-brand-amber via-brand to-brand-indigo p-[2px]">
                <span className="grid size-14 place-items-center overflow-hidden rounded-full border-2 border-bg bg-surface-2 text-xs font-semibold text-fg md:border-surface">
                  {author.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={author.avatarUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    initials(author.displayName)
                  )}
                </span>
              </span>
              <span className="w-full truncate text-center text-[11px] font-medium text-fg">
                {author.displayName}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
