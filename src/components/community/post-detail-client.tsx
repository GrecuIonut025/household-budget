"use client";

import type { ReactNode } from "react";
import { DoubleTapLove } from "@/components/community/post-actions";

export function PostDetailClient({
  recipeId,
  canReact,
  children,
}: {
  recipeId: string;
  canReact: boolean;
  imageUrl?: string | null;
  children: ReactNode;
}) {
  return (
    <DoubleTapLove recipeId={recipeId} canReact={canReact}>
      {children}
    </DoubleTapLove>
  );
}
