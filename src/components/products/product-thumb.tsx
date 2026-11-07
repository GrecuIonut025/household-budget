import clsx from "clsx";
import { Package } from "lucide-react";

export function ProductThumb({ url, size = "md" }: { url?: string | null; size?: "md" | "lg" }) {
  return (
    <span
      className={clsx(
        "grid shrink-0 place-items-center overflow-hidden rounded-[var(--radius-md)] bg-surface-2 text-muted",
        size === "md" ? "size-14" : "size-24 rounded-[var(--radius-lg)]",
      )}
    >
      {url ? (
        // signed Supabase Storage URL; next/image would need a remote pattern per project
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <Package size={size === "md" ? 22 : 32} aria-hidden />
      )}
    </span>
  );
}
