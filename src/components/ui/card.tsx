import * as React from "react";

import { cn } from "@/lib/utils";

export function Card({
  className,
  interactive = false,
  ...props
}: React.ComponentProps<"div"> & { interactive?: boolean }) {
  return (
    <div
      data-slot="card"
      className={cn(
        "glass edge-light grain relative overflow-hidden rounded-(--radius-card)",
        interactive &&
          "transition-[border-color,box-shadow,transform] duration-300 ease-[var(--ease-out-quint)] hover:-translate-y-0.5 hover:border-white/20",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 px-6 pt-5 pb-4",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      className={cn("text-sm font-semibold tracking-tight text-ink", className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-balance-pretty mt-1 text-xs leading-relaxed text-ink-faint",
        className,
      )}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-6 pb-6", className)} {...props} />;
}

/** Small uppercase label used to title a group of controls. */
export function SectionLabel({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-ink-faint",
        className,
      )}
      {...props}
    />
  );
}
