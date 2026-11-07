import clsx from "clsx";
import { Heart } from "lucide-react";
import { toggleFavorite } from "@/app/actions/recipes";

/** Works in server components: a plain form posting to a server action. */
export function FavoriteButton({
  recipeId,
  householdId,
  isFavorite,
  label,
  className,
}: {
  recipeId: string;
  householdId: string;
  isFavorite: boolean;
  label: string;
  className?: string;
}) {
  return (
    <form action={toggleFavorite}>
      <input type="hidden" name="id" value={recipeId} />
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="favorite" value={String(!isFavorite)} />
      <button
        type="submit"
        aria-label={label}
        aria-pressed={isFavorite}
        className={clsx(
          "grid size-11 place-items-center rounded-full backdrop-blur transition active:scale-95",
          isFavorite ? "bg-surface/90 text-danger" : "bg-surface/80 text-muted hover:text-fg",
          className,
        )}
      >
        <Heart size={20} aria-hidden fill={isFavorite ? "currentColor" : "none"} />
      </button>
    </form>
  );
}
