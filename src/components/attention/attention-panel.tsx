"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Camera,
  CameraOff,
  Crosshair,
  Loader2,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import { AttentionOrb } from "@/components/attention/attention-orb";
import { CameraCanvas } from "@/components/attention/camera-canvas";
import { SignalTrace } from "@/components/attention/signal-trace";
import { useAttention } from "@/components/attention/attention-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionLabel } from "@/components/ui/card";
import { Hint } from "@/components/ui/tooltip";
import { STATE_COPY } from "@/lib/attention/types";
import { useSessionStore } from "@/lib/store/session-store";
import { useSettingsStore } from "@/lib/store/settings-store";
import { cn } from "@/lib/utils";

const COMPONENT_LABELS: Record<string, { label: string; hint: string }> = {
  head: {
    label: "Head",
    hint: "How far your head has turned or tilted from the calibrated neutral pose. Weighted heaviest — it is the most reliable signal at webcam distance.",
  },
  gaze: {
    label: "Eyes",
    hint: "Eyeball direction inside the sockets. Catches the case where your head stays still but your eyes wander off-screen.",
  },
  eyes: {
    label: "Lids",
    hint: "Eyelid openness. Contributes only a small share, so an ordinary blink can never register as looking away.",
  },
};

export function AttentionPanel() {
  const { enabled, enable, disable, calibrate, calibrating } = useAttention();
  const reading = useSessionStore((state) => state.reading);
  const trackerStatus = useSessionStore((state) => state.trackerStatus);
  const trackerError = useSessionStore((state) => state.trackerError);
  const calibration = useSettingsStore((state) => state.calibration);

  const copy = STATE_COPY[enabled ? reading.state : "offline"];
  const starting =
    trackerStatus === "requesting-permission" || trackerStatus === "loading-model";

  return (
    <Card className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-4 px-6 pt-6">
        <div>
          <SectionLabel>Attention sensor</SectionLabel>
          <h2 className="mt-2 text-lg font-semibold tracking-tight">
            {copy.label}
          </h2>
          <p className="text-balance-pretty mt-1 max-w-sm text-sm leading-relaxed text-ink-faint">
            {trackerError ?? copy.detail}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {calibration ? (
            <Badge variant="focus">
              <ShieldCheck className="size-3" />
              Calibrated
            </Badge>
          ) : (
            <Badge>Uncalibrated</Badge>
          )}
          <Button
            variant={enabled ? "outline" : "signal"}
            size="sm"
            onClick={enabled ? disable : enable}
          >
            {starting ? (
              <Loader2 className="animate-spin" />
            ) : enabled ? (
              <CameraOff />
            ) : (
              <Camera />
            )}
            {enabled ? "Stop" : "Start tracking"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[auto_1fr] lg:items-center">
        <AttentionOrb
          reading={reading}
          active={enabled && trackerStatus === "running"}
          className="mx-auto"
        />

        <div className="flex min-w-0 flex-col gap-4">
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-hairline bg-canvas-deep">
            <CameraCanvas className="absolute inset-0" />

            {/* Corner ticks — the "framing" affordance of a viewfinder. */}
            <span aria-hidden className="pointer-events-none absolute inset-3">
              {["left-0 top-0 border-l border-t", "right-0 top-0 border-r border-t", "left-0 bottom-0 border-l border-b", "right-0 bottom-0 border-r border-b"].map(
                (position) => (
                  <i
                    key={position}
                    className={cn("absolute size-4 border-white/25", position)}
                  />
                ),
              )}
            </span>

            <AnimatePresence>
              {(!enabled || trackerStatus !== "running") && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 grid place-items-center bg-canvas-deep/85 px-6 text-center backdrop-blur-sm"
                >
                  {trackerStatus === "denied" || trackerStatus === "error" ? (
                    <div className="flex max-w-xs flex-col items-center gap-2">
                      <TriangleAlert className="size-5 text-away" />
                      <p className="text-xs leading-relaxed text-ink-muted">
                        {trackerError}
                      </p>
                    </div>
                  ) : starting ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="size-5 animate-spin text-signal" />
                      <p className="text-xs text-ink-muted">
                        {trackerStatus === "requesting-permission"
                          ? "Waiting for camera permission…"
                          : "Loading the landmark model…"}
                      </p>
                    </div>
                  ) : (
                    <div className="flex max-w-xs flex-col items-center gap-2">
                      <Camera className="size-5 text-ink-faint" />
                      <p className="text-xs leading-relaxed text-ink-faint">
                        The camera is off. Nothing is captured until you start
                        tracking.
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {enabled && trackerStatus === "running" && (
              <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-canvas-deep/70 px-2.5 py-1 backdrop-blur">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-away opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-away" />
                </span>
                <span className="tabular text-[0.625rem] text-ink-muted">
                  {reading.fps.toFixed(0)} fps
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(["head", "gaze", "eyes"] as const).map((key) => {
              const value = enabled ? reading.components[key] : 0;
              const meta = COMPONENT_LABELS[key];
              return (
                <Hint key={key} label={meta.hint}>
                  <div className="cursor-help rounded-xl border border-hairline bg-white/[0.03] px-3 py-2.5 text-left">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[0.6875rem] text-ink-faint">
                        {meta.label}
                      </span>
                      <span className="tabular text-xs font-medium text-ink">
                        {Math.round(value * 100)}
                      </span>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/8">
                      <motion.div
                        className="h-full rounded-full bg-linear-to-r from-signal-deep to-signal"
                        animate={{ width: `${value * 100}%` }}
                        transition={{ duration: 0.25 }}
                      />
                    </div>
                  </div>
                </Hint>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-hairline px-6 py-4">
        <SignalTrace />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-6 py-4">
        <p className="text-balance-pretty max-w-md text-xs leading-relaxed text-ink-faint">
          Sit the way you normally work, look straight at the monitor, then
          capture your neutral pose. Everything is measured relative to it.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={calibrate}
          disabled={!enabled || calibrating || trackerStatus !== "running"}
        >
          {calibrating ? <Loader2 className="animate-spin" /> : <Crosshair />}
          {calibrating ? "Hold still…" : "Calibrate"}
        </Button>
      </div>
    </Card>
  );
}
