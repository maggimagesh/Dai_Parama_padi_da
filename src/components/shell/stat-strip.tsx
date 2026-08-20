"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Clock, Eye, Timer, Video } from "lucide-react";

import { usePlayback } from "@/components/player/playback-provider";
import { SectionLabel } from "@/components/ui/card";
import { useSessionStore } from "@/lib/store/session-store";
import { useSettingsStore } from "@/lib/store/settings-store";
import { clamp, cn, formatDuration } from "@/lib/utils";

function Tile({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  children,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="glass edge-light relative overflow-hidden rounded-2xl px-4 py-3.5">
      <div className="flex items-center gap-2">
        <Icon className="size-3.5" style={{ color: accent }} />
        <SectionLabel>{label}</SectionLabel>
      </div>
      <p
        className="tabular mt-2 text-xl font-semibold tracking-tight"
        style={{ color: accent }}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[0.6875rem] text-ink-faint">{sub}</p>}
      {children}
    </div>
  );
}

export function StatStrip({ className }: { className?: string }) {
  const stats = useSessionStore((state) => state.stats);
  const isIdle = useSessionStore((state) => state.isIdle);
  const { idleMs } = usePlayback();

  const idleTimeoutMs = useSettingsStore(
    (state) => state.preferences.idleTimeoutMs,
  );
  const idleEnabled = useSettingsStore(
    (state) => state.preferences.idleTriggerEnabled,
  );

  const remaining = Math.max(0, idleTimeoutMs - idleMs);
  const progress = clamp(idleMs / Math.max(1, idleTimeoutMs));

  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>
      <Tile
        icon={Eye}
        label="Look-aways"
        value={String(stats.awayEpisodes)}
        sub={`${formatDuration(stats.totalAwayMs / 1000)} off screen`}
        accent="var(--color-away)"
      />
      <Tile
        icon={Clock}
        label="Longest away"
        value={formatDuration(stats.longestAwayMs / 1000)}
        sub={`${stats.idleEpisodes} idle episode${stats.idleEpisodes === 1 ? "" : "s"}`}
      />
      <Tile
        icon={Video}
        label="Played"
        value={formatDuration(stats.totalPlaybackMs / 1000)}
        sub="Triggered playback this session"
        accent="var(--color-signal)"
      />
      <Tile
        icon={Timer}
        label="Idle fallback"
        value={
          !idleEnabled ? "Off" : isIdle ? "Armed" : formatDuration(remaining / 1000)
        }
        sub={
          !idleEnabled
            ? "Inactivity trigger disabled"
            : isIdle
              ? "No input detected"
              : "Until fullscreen playback"
        }
        accent={isIdle ? "var(--color-idle)" : undefined}
      >
        {idleEnabled && (
          <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/8">
            <motion.div
              className="h-full rounded-full bg-linear-to-r from-signal-deep to-idle"
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.4, ease: "linear" }}
            />
          </div>
        )}
      </Tile>
    </div>
  );
}
