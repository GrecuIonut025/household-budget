import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={clsx("rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5", className)}
      {...props}
    />
  );
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold tracking-tight text-fg">{children}</h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "ok" | "danger";
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p
        className={clsx(
          "tabular mt-1 text-2xl font-semibold tracking-tight",
          tone === "ok" && "text-ok",
          tone === "danger" && "text-danger",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function ProgressBar({ value, max, tone }: { value: number; max: number; tone?: "brand" | "warn" | "danger" }) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const auto = max > 0 && value > max ? "danger" : max > 0 && value / max > 0.85 ? "warn" : "brand";
  const t = tone ?? auto;
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
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
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center">
      {icon ? <div className="mb-1 text-muted">{icon}</div> : null}
      <p className="text-sm font-medium">{title}</p>
      {body ? <p className="max-w-sm text-sm text-muted">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "ok" | "warn" | "danger" | "brand" }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
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

export function Alert({ tone = "danger", children }: { tone?: "danger" | "ok"; children: ReactNode }) {
  return (
    <p
      role={tone === "danger" ? "alert" : "status"}
      className={clsx(
        "rounded-xl px-3 py-2 text-sm",
        tone === "danger" ? "bg-danger-soft text-danger" : "bg-ok-soft text-ok",
      )}
    >
      {children}
    </p>
  );
}

export const inputClass =
  "block w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-base text-fg placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:opacity-60 sm:text-sm";

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
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40";

export function buttonClass(variant: "primary" | "secondary" | "danger" | "ghost" = "primary", extra?: string) {
  return clsx(
    buttonBase,
    variant === "primary" && "bg-brand text-brand-fg hover:bg-brand-strong",
    variant === "secondary" && "border border-border bg-surface text-fg hover:bg-surface-2",
    variant === "danger" && "bg-danger-soft text-danger hover:brightness-95",
    variant === "ghost" && "text-muted hover:bg-surface-2 hover:text-fg",
    extra,
  );
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}
