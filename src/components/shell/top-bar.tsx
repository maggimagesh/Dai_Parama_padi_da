"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { CircleHelp, Lock, Play, Puzzle } from "lucide-react";

import { useAttention } from "@/components/attention/attention-provider";
import { usePlayback } from "@/components/player/playback-provider";
import { HowItWorks } from "@/components/shell/how-it-works";
import { Logo } from "@/components/shell/logo";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import { STATE_COPY } from "@/lib/attention/types";
import { useSessionStore } from "@/lib/store/session-store";

export function TopBar() {
  const { enabled } = useAttention();
  const { playManually, clip } = usePlayback();
  const state = useSessionStore((state) => state.reading.state);
  const trackerStatus = useSessionStore((state) => state.trackerStatus);
  const isIdle = useSessionStore((state) => state.isIdle);

  const live = enabled && trackerStatus === "running";
  const tone = isIdle
    ? "var(--color-idle)"
    : live
      ? STATE_COPY[state].tone
      : "var(--color-ink-faint)";
  const label = isIdle ? "Idle" : live ? STATE_COPY[state].label : "Sensor off";

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-canvas-deep/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[100rem] items-center gap-4 px-5 sm:px-8">
        <Logo />

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight">
            Peripheral
          </p>
          <p className="hidden truncate text-[0.6875rem] text-ink-faint sm:block">
            Plays when you look away. Stops when you look back.
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/puzzle-game" aria-label="Puzzle game"><Puzzle /><span className="hidden sm:inline">Puzzle game</span></Link>
          </Button>
          <motion.div
            layout
            className="flex items-center gap-2 rounded-full border border-hairline bg-white/[0.04] px-3 py-1.5"
          >
            <span className="relative flex size-2">
              {live && (
                <span
                  className="absolute inline-flex size-full animate-ping rounded-full opacity-70"
                  style={{ backgroundColor: tone }}
                />
              )}
              <span
                className="relative inline-flex size-2 rounded-full"
                style={{ backgroundColor: tone }}
              />
            </span>
            <span className="text-xs font-medium" style={{ color: tone }}>
              {label}
            </span>
          </motion.div>

          <Hint label="All camera processing happens on this device. No frames, landmarks, or clips are uploaded.">
            <span className="hidden items-center gap-1.5 rounded-full border border-hairline bg-white/[0.04] px-3 py-1.5 text-xs text-ink-faint md:inline-flex">
              <Lock className="size-3" />
              On-device
            </span>
          </Hint>

          <Hint label="Preview the selected clip without waiting for a trigger">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => playManually()}
              disabled={!clip}
              aria-label="Preview selected clip"
            >
              <Play />
            </Button>
          </Hint>

          <HowItWorks>
            <Button variant="ghost" size="icon" aria-label="How it works">
              <CircleHelp />
            </Button>
          </HowItWorks>
        </div>
      </div>
    </header>
  );
}
