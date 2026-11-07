"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { buttonClass } from "./ui";
import { useI18n } from "@/lib/i18n/provider";

export function CopyButton({ value }: { value: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass("secondary")}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
      {copied ? t("settings.inviteCopied") : t("settings.inviteCopy")}
    </button>
  );
}
