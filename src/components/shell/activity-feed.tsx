"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Camera,
  CameraOff,
  Crosshair,
  Eye,
  EyeOff,
  Info,
  MonitorPause,
  MonitorPlay,
  MousePointerClick,
  Timer,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, SectionLabel } from "@/components/ui/card";
import { useSessionStore, type SessionEvent } from "@/lib/store/session-store";
import { cn, formatClock } from "@/lib/utils";

const ICONS: Record<SessionEvent["kind"], React.ElementType> = {
  "tracking-started": Camera,
  "tracking-stopped": CameraOff,
  "looked-away": EyeOff,
  "looked-back": Eye,
  "went-idle": Timer,
  "resumed-activity": MousePointerClick,
  "playback-started": MonitorPlay,
  "playback-stopped": MonitorPause,
  calibrated: Crosshair,
  notice: Info,
};

const TONES: Partial<Record<SessionEvent["kind"], string>> = {
  "looked-away": "text-away",
  "looked-back": "text-focus",
  "went-idle": "text-idle",
  "playback-started": "text-signal",
  calibrated: "text-signal",
};

export function ActivityFeed({ className }: { className?: string }) {
  const events = useSessionStore((state) => state.events);
  const clearSession = useSessionStore((state) => state.clearSession);

  return (
    <Card className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex items-start justify-between gap-4 px-6 pt-6">
        <div>
          <SectionLabel>Activity</SectionLabel>
          <h2 className="mt-2 text-base font-semibold tracking-tight">
            This session
          </h2>
        </div>
        {events.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearSession}>
            Clear
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
        {events.length === 0 ? (
          <p className="rounded-2xl border border-hairline bg-white/[0.02] px-4 py-6 text-center text-xs leading-relaxed text-ink-faint">
            Nothing logged yet. Turn on tracking and the timeline fills in as
            your attention moves.
          </p>
        ) : (
          <ol className="relative flex flex-col gap-0.5">
            {/* Spine connecting the markers. */}
            <span
              aria-hidden
              className="absolute bottom-3 left-[13px] top-3 w-px bg-linear-to-b from-transparent via-white/10 to-transparent"
            />
            <AnimatePresence initial={false}>
              {events.map((event) => {
                const Icon = ICONS[event.kind];
                return (
                  <motion.li
                    key={event.id}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className="relative flex gap-3 rounded-xl px-1 py-2"
                  >
                    <span className="relative z-10 mt-0.5 grid size-[26px] shrink-0 place-items-center rounded-full border border-hairline bg-surface">
                      <Icon
                        className={`size-3.5 ${TONES[event.kind] ?? "text-ink-faint"}`}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-[0.8125rem] font-medium text-ink">
                          {event.label}
                        </span>
                        <span className="tabular shrink-0 text-[0.625rem] text-ink-faint">
                          {formatClock(event.at)}
                        </span>
                      </span>
                      {event.detail && (
                        <span className="text-balance-pretty mt-0.5 block text-[0.6875rem] leading-relaxed text-ink-faint">
                          {event.detail}
                        </span>
                      )}
                    </span>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ol>
        )}
      </div>
    </Card>
  );
}
