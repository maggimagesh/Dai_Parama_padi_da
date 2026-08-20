"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

export function Slider({
  className,
  "aria-label": ariaLabel,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      className={cn(
        "relative flex w-full touch-none select-none items-center py-2",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-white/10">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-linear-to-r from-signal-deep to-signal" />
      </SliderPrimitive.Track>
      {/*
        The thumb carries role="slider", so the accessible name has to live here
        rather than on the root — a label on the root leaves the control unnamed
        to assistive technology.
      */}
      <SliderPrimitive.Thumb
        aria-label={ariaLabel}
        className={cn(
          "block size-4 rounded-full border border-white/40 bg-ink shadow-[0_2px_10px_oklch(0_0_0/55%)]",
          "transition-[box-shadow,transform] duration-200 ease-[var(--ease-out-quint)]",
          "hover:scale-110 focus-visible:ring-4 focus-visible:ring-signal/25 focus-visible:outline-none",
        )}
      />
    </SliderPrimitive.Root>
  );
}
