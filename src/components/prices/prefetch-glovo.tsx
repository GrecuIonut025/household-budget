"use client";

import { useEffect } from "react";
import { prefetchGlovoCatalog } from "@/components/prices/glovo-brasov";

/** Warm Glovo catalog in the background while the user is in the app shell. */
export function PrefetchGlovoCatalog() {
  useEffect(() => {
    const idle =
      typeof window !== "undefined" && "requestIdleCallback" in window
        ? window.requestIdleCallback.bind(window)
        : (cb: () => void) => window.setTimeout(cb, 200);
    const id = idle(() => prefetchGlovoCatalog());
    return () => {
      if (typeof window !== "undefined" && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(id as number);
      } else {
        clearTimeout(id as number);
      }
    };
  }, []);
  return null;
}
