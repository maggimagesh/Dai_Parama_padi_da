"use client";

import * as React from "react";
import { Toaster } from "sonner";
import { usePathname } from "next/navigation";

import { AttentionProvider } from "@/components/attention/attention-provider";
import { PlaybackProvider } from "@/components/player/playback-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Unmount the attention camera and playback when entering the puzzle route.
  // Each experience owns and releases its own camera stream.
  if (pathname === "/puzzle-game") {
    return <TooltipProvider>{children}</TooltipProvider>;
  }

  return (
    <TooltipProvider delayDuration={220} skipDelayDuration={400}>
      <AttentionProvider>
        <PlaybackProvider>
          {children}
          <Toaster
            position="bottom-right"
            theme="dark"
            toastOptions={{
              classNames: {
                toast:
                  "!glass-deep !rounded-2xl !border-hairline !text-ink !text-[0.8125rem]",
                description: "!text-ink-faint !text-xs",
              },
            }}
          />
        </PlaybackProvider>
      </AttentionProvider>
    </TooltipProvider>
  );
}
