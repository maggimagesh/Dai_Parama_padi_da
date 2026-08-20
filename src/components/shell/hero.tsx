"use client";

import * as React from "react";
import { motion } from "motion/react";
import { ArrowRight, Check, Circle } from "lucide-react";

import { useAttention } from "@/components/attention/attention-provider";
import { usePlayback } from "@/components/player/playback-provider";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/lib/store/session-store";
import { useSettingsStore } from "@/lib/store/settings-store";
import { cn } from "@/lib/utils";

/** Three conditions have to hold before the system can actually do its job. */
function Readiness() {
  const { enabled } = useAttention();
  const trackerStatus = useSessionStore((state) => state.trackerStatus);
  const clips = useSessionStore((state) => state.clips);
  const calibration = useSettingsStore((state) => state.calibration);

  const items = [
    { label: "Camera live", done: enabled && trackerStatus === "running" },
    { label: "Clip selected", done: clips.length > 0 },
    { label: "Neutral pose set", done: Boolean(calibration) },
  ];

  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          {item.done ? (
            <Check className="size-3.5 text-focus" />
          ) : (
            <Circle className="size-3.5 text-ink-faint/50" />
          )}
          <span
            className={cn(
              "text-xs",
              item.done ? "text-ink-muted" : "text-ink-faint",
            )}
          >
            {item.label}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Hero() {
  const { enabled, enable } = useAttention();
  const { playManually, clip } = usePlayback();

  return (
    <section className="relative pb-2 pt-10 sm:pt-14">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-3xl"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-white/[0.04] px-3 py-1.5 text-[0.6875rem] tracking-tight text-ink-muted">
          <span className="size-1.5 rounded-full bg-signal" />
          Attention-aware playback · runs entirely on this device
        </span>

        <h1 className="text-balance-pretty mt-5 text-4xl font-semibold leading-[1.05] tracking-[-0.03em] sm:text-5xl lg:text-[3.5rem]">
          Your screen notices
          <br />
          <span className="bg-linear-to-r from-signal via-ink to-idle bg-clip-text text-transparent">
            when you stop watching.
          </span>
        </h1>

        <p className="text-balance-pretty mt-5 max-w-xl text-[0.9375rem] leading-relaxed text-ink-muted">
          Peripheral watches your gaze through the laptop camera. Look away and
          your clip starts playing; look back and it stops mid-frame. Step away
          entirely and the inactivity fallback takes the whole screen until you
          close it.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          {!enabled ? (
            <Button size="lg" variant="signal" onClick={enable}>
              Start attention tracking
              <ArrowRight />
            </Button>
          ) : (
            <Button
              size="lg"
              variant="primary"
              onClick={() => playManually()}
              disabled={!clip}
            >
              Preview the clip
              <ArrowRight />
            </Button>
          )}
          <Readiness />
        </div>
      </motion.div>
    </section>
  );
}
