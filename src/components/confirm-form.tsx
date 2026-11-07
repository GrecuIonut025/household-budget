"use client";

import type { ComponentProps, ReactNode } from "react";

/** A form that asks for confirmation before submitting its server action. */
export function ConfirmForm({
  message,
  children,
  ...props
}: Omit<ComponentProps<"form">, "onSubmit"> & { message: string; children: ReactNode }) {
  return (
    <form
      {...props}
      onSubmit={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </form>
  );
}
