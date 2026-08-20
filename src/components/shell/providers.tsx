"use client";

import * as React from "react";
import { Toaster } from "sonner";

import { AttentionProvider } from "@/components/attention/attention-provider";
import { PlaybackProvider } from "@/components/player/playback-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
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
