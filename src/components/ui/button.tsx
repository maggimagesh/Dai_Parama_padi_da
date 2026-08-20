"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium tracking-tight transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-200 ease-[var(--ease-out-quint)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-linear-to-b from-ink to-[oklch(0.86_0.005_265)] text-canvas-deep shadow-[0_8px_24px_-10px_oklch(1_0_0/45%)] hover:from-white hover:to-ink",
        signal:
          "bg-linear-to-b from-[color-mix(in_oklch,var(--color-signal)_92%,white)] to-signal-deep text-canvas-deep shadow-[0_10px_30px_-12px_var(--color-signal)] hover:brightness-110",
        outline:
          "border border-hairline-strong bg-white/[0.03] text-ink hover:border-white/25 hover:bg-white/[0.07]",
        ghost: "text-ink-muted hover:bg-white/[0.06] hover:text-ink",
        danger:
          "border border-[color-mix(in_oklch,var(--color-away)_35%,transparent)] bg-[color-mix(in_oklch,var(--color-away)_14%,transparent)] text-[color-mix(in_oklch,var(--color-away)_88%,white)] hover:bg-[color-mix(in_oklch,var(--color-away)_22%,transparent)]",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-[0.95rem]",
        icon: "size-10",
        "icon-sm": "size-8 [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "outline", size: "md" },
  },
);

export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
