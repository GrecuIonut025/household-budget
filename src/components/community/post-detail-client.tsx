"use client";

import { ChefHat } from "lucide-react";
import { DoubleTapLove } from "@/components/community/post-actions";
import { StorageImage } from "@/components/media/storage-image";

export function PostDetailClient({
  recipeId,
  canReact,
  imageUrl,
}: {
  recipeId: string;
  canReact: boolean;
  imageUrl?: string | null;
}) {
  return (
    <DoubleTapLove recipeId={recipeId} canReact={canReact}>
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface-2 sm:aspect-square">
        {imageUrl ? (
          <StorageImage
            src={imageUrl}
            sizes="(max-width: 640px) 100vw, 470px"
            className="size-full"
            priority
          />
        ) : (
          <div className="grid size-full place-items-center text-brand/60">
            <ChefHat size={56} aria-hidden />
          </div>
        )}
      </div>
    </DoubleTapLove>
  );
}
