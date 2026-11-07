import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={clsx(
        "rounded-[var(--radius-lg)] border border-border bg-surface p-4 sm:p-5",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[13px] font-semibold tracking-wide text-muted">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function Section({
  title,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx("space-y-3", className)}>
      {title ? (
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-[13px] font-semibold tracking-wide text-muted">
            {title}
          </h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight text-fg sm:text-[1.375rem]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
  size = "md",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "ok" | "danger" | "warn";
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p
        className={clsx(
          "tabular mt-1 font-semibold tracking-tight",
          size === "lg" && "text-3xl sm:text-4xl",
          size === "md" && "text-2xl",
          size === "sm" && "text-lg",
          tone === "ok" && "text-ok",
          tone === "danger" && "text-danger",
          tone === "warn" && "text-warn",
          tone === "default" && "text-fg",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function ProgressBar({
  value,
  max,
  tone,
}: {
  value: number;
  max: number;
  tone?: "brand" | "warn" | "danger";
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const auto =
    max > 0 && value > max
      ? "danger"
      : max > 0 && value / max > 0.85
        ? "warn"
        : "brand";
  const t = tone ?? auto;
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(Math.max(value, 0), max)}
    >
      <div
        className={clsx(
          "h-full rounded-full transition-[width]",
          t === "brand" && "bg-brand",
          t === "warn" && "bg-warn",
          t === "danger" && "bg-danger",
        )}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  compact,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={clsx(
        "flex flex-col items-start gap-1.5 text-left",
        compact
          ? "py-2"
          : "rounded-[var(--radius-md)] border border-dashed border-border px-4 py-6",
      )}
    >
      {icon ? <div className="mb-0.5 text-muted">{icon}</div> : null}
      <p className="text-sm font-medium text-fg">{title}</p>
      {body ? (
        <p className="max-w-md text-sm leading-relaxed text-muted">{body}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "ok" | "warn" | "danger" | "brand";
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[11px] font-medium",
        tone === "default" && "bg-surface-2 text-muted",
        tone === "ok" && "bg-ok-soft text-ok",
        tone === "warn" && "bg-warn-soft text-warn",
        tone === "danger" && "bg-danger-soft text-danger",
        tone === "brand" && "bg-brand-soft text-brand-strong",
      )}
    >
      {children}
    </span>
  );
}

export function Alert({
  tone = "danger",
  children,
}: {
  tone?: "danger" | "ok" | "warn";
  children: ReactNode;
}) {
  return (
    <p
      role={tone === "danger" ? "alert" : "status"}
      className={clsx(
        "rounded-[var(--radius-md)] px-3 py-2 text-sm",
        tone === "danger" && "bg-danger-soft text-danger",
        tone === "ok" && "bg-ok-soft text-ok",
        tone === "warn" && "bg-warn-soft text-warn",
      )}
    >
      {children}
    </p>
  );
}

export const inputClass =
  "block w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2.5 text-base text-fg placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60 sm:text-sm";

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

const buttonBase =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] px-3.5 text-sm font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35";

export function buttonClass(
  variant: "primary" | "secondary" | "danger" | "ghost" = "primary",
  extra?: string,
) {
  return clsx(
    buttonBase,
    variant === "primary" && "bg-brand text-brand-fg hover:bg-brand-strong",
    variant === "secondary" &&
      "border border-border bg-surface text-fg hover:bg-surface-2",
    variant === "danger" && "bg-danger-soft text-danger hover:brightness-95",
    variant === "ghost" && "text-muted hover:bg-surface-2 hover:text-fg",
    extra,
  );
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function Divider({ className }: { className?: string }) {
  return <hr className={clsx("border-0 border-t border-border", className)} />;
}

export function ListSurface({
  className,
  children,
  ...props
}: ComponentProps<"ul">) {
  return (
    <ul
      className={clsx(
        "divide-y divide-border overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface",
        className,
      )}
      {...props}
    >
      {children}
    </ul>
  );
}
