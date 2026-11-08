"use client";

import Image from "next/image";
import clsx from "clsx";

/**
 * Storage-backed image. Uses next/image with `unoptimized` for same-origin
 * `/api/media` (auth cookies must ride with the browser request — the optimizer
 * would fetch without them and 401). Remote https URLs can be optimized.
 */
export function StorageImage({
  src,
  alt = "",
  className,
  sizes = "(max-width: 470px) 100vw, 470px",
  priority,
}: {
  src: string;
  alt?: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const proxied = src.startsWith("/api/media");
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={proxied}
      className={clsx("object-cover", className)}
      referrerPolicy="no-referrer"
    />
  );
}
