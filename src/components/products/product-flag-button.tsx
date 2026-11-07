import { Star } from "lucide-react";
import clsx from "clsx";
import { setProductFlag } from "@/app/actions/products";

/** Server-action form button toggling `is_favorite` / `is_frequent` / `is_archived`. */
export function FavoriteButton({ productId, active, label }: { productId: string; active: boolean; label: string }) {
  return (
    <form action={setProductFlag}>
      <input type="hidden" name="id" value={productId} />
      <input type="hidden" name="field" value="is_favorite" />
      <input type="hidden" name="value" value={String(!active)} />
      <button
        type="submit"
        aria-label={label}
        aria-pressed={active}
        className="grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2"
      >
        <Star size={20} aria-hidden className={clsx(active && "fill-warn text-warn")} />
      </button>
    </form>
  );
}
