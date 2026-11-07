"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./ui";
import { useI18n } from "@/lib/i18n/provider";
import type { ComponentProps } from "react";

export function SubmitButton({ children, variant, className, ...rest }: ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  const { t } = useI18n();
  return (
    <Button type="submit" variant={variant} className={className} disabled={pending || rest.disabled} {...rest}>
      {pending ? t("common.saving") : children}
    </Button>
  );
}
