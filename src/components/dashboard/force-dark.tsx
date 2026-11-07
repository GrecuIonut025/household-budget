"use client";

import { useLayoutEffect } from "react";
import { useTheme } from "@/components/theme-provider";

/** Forces dark chrome for the local visual-shell preview only. */
export function ForceDark() {
  const { setPreference } = useTheme();
  useLayoutEffect(() => {
    setPreference("dark");
  }, [setPreference]);
  return null;
}
