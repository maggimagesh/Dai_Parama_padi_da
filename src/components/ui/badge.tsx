import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.6875rem] font-medium tracking-tight",
  {
    variants: {
      variant: {
        neutral: "border-hairline bg-white/[0.04] text-ink-muted",
        signal:
          "border-[color-mix(in_oklch,var(--color-signal)_35%,transparent)] bg-[color-mix(in_oklch,var(--color-signal)_12%,transparent)] text-[color-mix(in_oklch,var(--color-signal)_90%,white)]",
        focus:
          "border-[color-mix(in_oklch,var(--color-focus)_35%,transparent)] bg-[color-mix(in_oklch,var(--color-focus)_12%,transparent)] text-[color-mix(in_oklch,var(--color-focus)_90%,white)]",
        warn: "border-[color-mix(in_oklch,var(--color-drift)_35%,transparent)] bg-[color-mix(in_oklch,var(--color-drift)_12%,transparent)] text-[color-mix(in_oklch,var(--color-drift)_92%,white)]",
        alert:
          "border-[color-mix(in_oklch,var(--color-away)_38%,transparent)] bg-[color-mix(in_oklch,var(--color-away)_14%,transparent)] text-[color-mix(in_oklch,var(--color-away)_92%,white)]",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
