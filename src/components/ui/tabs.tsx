"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-hairline bg-white/[0.03] p-1",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative rounded-full px-3.5 py-1.5 text-xs font-medium text-ink-faint transition-colors duration-200",
        "hover:text-ink-muted",
        "data-[state=active]:bg-white/[0.09] data-[state=active]:text-ink data-[state=active]:shadow-[0_1px_0_0_oklch(1_0_0/10%)_inset]",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn(
        "mt-4 focus-visible:outline-none data-[state=active]:animate-[rise_0.4s_var(--ease-out-quint)_both]",
        className,
      )}
      {...props}
    />
  );
}
