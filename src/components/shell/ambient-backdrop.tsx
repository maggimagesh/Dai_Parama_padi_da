"use client";

import * as React from "react";
import { motion } from "motion/react";

import { STATE_COPY } from "@/lib/attention/types";
import { useSessionStore } from "@/lib/store/session-store";

/**
 * Room lighting for the whole app. The wash behind the interface takes on the
 * colour of the current attention state, so the page reads as "away" from the
 * corner of your eye — before you have parsed a single label.
 */
export function AmbientBackdrop() {
  const state = useSessionStore((state) => state.reading.state);
  const trackerStatus = useSessionStore((state) => state.trackerStatus);
  const isIdle = useSessionStore((state) => state.isIdle);

  const tone = isIdle
    ? "var(--color-idle)"
    : trackerStatus === "running"
      ? STATE_COPY[state].tone
      : "var(--color-signal-deep)";

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-canvas-deep" />

      <motion.div
        className="absolute -left-[18%] -top-[28%] size-[70vw] rounded-full blur-[120px] animate-(--animate-drift-slow)"
        animate={{ backgroundColor: tone, opacity: 0.16 }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.div
        className="absolute -right-[22%] top-[18%] size-[60vw] rounded-full blur-[140px]"
        animate={{ backgroundColor: tone, opacity: 0.1 }}
        transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
      />
      <div className="absolute -bottom-[30%] left-[22%] size-[55vw] rounded-full bg-signal-deep/10 blur-[150px]" />

      {/* Faint engineering grid — gives the dark field a sense of scale. */}
      <div
        className="absolute inset-0 opacity-[0.045]"
        style={{
          backgroundImage:
            "linear-gradient(to right, oklch(1 0 0 / 60%) 1px, transparent 1px), linear-gradient(to bottom, oklch(1 0 0 / 60%) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent 75%)",
        }}
      />

      <div className="grain absolute inset-0" />
    </div>
  );
}
