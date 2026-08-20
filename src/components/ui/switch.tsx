"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

export function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-[22px] w-[38px] shrink-0 cursor-pointer items-center rounded-full border border-hairline-strong bg-white/[0.06] p-[2px] transition-colors duration-300 ease-[var(--ease-out-quint)]",
        "data-[state=checked]:border-transparent data-[state=checked]:bg-linear-to-r data-[state=checked]:from-signal data-[state=checked]:to-signal-deep",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-ink shadow-[0_2px_6px_oklch(0_0_0/45%)] transition-transform duration-300 ease-[var(--ease-out-quint)]",
          "data-[state=checked]:translate-x-4 data-[state=checked]:bg-canvas-deep",
        )}
      />
    </SwitchPrimitive.Root>
  );
}
