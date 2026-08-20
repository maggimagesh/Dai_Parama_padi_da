"use client";

import * as React from "react";
import { motion, useSpring, useTransform } from "motion/react";

import { STATE_COPY, type AttentionReading } from "@/lib/attention/types";
import { useSettingsStore } from "@/lib/store/settings-store";
import { clamp, cn } from "@/lib/utils";

const SIZE = 260;
const RADIUS = 108;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The instrument. One glance should answer three questions: are you being
 * seen, how confident is the reading, and how close is it to flipping.
 *
 * The travelling dot is the honest part — it plots where the tracker thinks you
 * are looking relative to your calibrated neutral, so a wrong call is visible
 * rather than mysterious.
 */
export function AttentionOrb({
  reading,
  active,
  className,
}: {
  reading: AttentionReading;
  active: boolean;
  className?: string;
}) {
  const tolerance = useSettingsStore((state) => state.attention.headTolerance);
  const calibration = useSettingsStore((state) => state.calibration);

  const copy = STATE_COPY[active ? reading.state : "offline"];
  const isAway = reading.state === "away" || reading.state === "no-face";

  const score = active ? reading.score : 0;

  const springScore = useSpring(score, { stiffness: 140, damping: 22, mass: 0.6 });
  React.useEffect(() => springScore.set(score), [score, springScore]);

  const dashOffset = useTransform(
    springScore,
    (value) => CIRCUMFERENCE * (1 - clamp(value)),
  );

  // Head rotation and eyeball direction both move the dot; head dominates,
  // matching how the score itself is weighted.
  const sample = reading.sample;
  const offsetX = sample
    ? clamp(
        ((sample.yaw - (calibration?.yaw ?? 0)) / (tolerance * 2)) * 0.7 +
          sample.gazeX * 0.3,
        -1,
        1,
      )
    : 0;
  const offsetY = sample
    ? clamp(
        ((sample.pitch - (calibration?.pitch ?? 0)) / (tolerance * 2.4)) * 0.7 -
          sample.gazeY * 0.3,
        -1,
        1,
      )
    : 0;

  const dotX = useSpring(0, { stiffness: 190, damping: 24 });
  const dotY = useSpring(0, { stiffness: 190, damping: 24 });
  React.useEffect(() => {
    dotX.set(active && sample?.faceDetected ? offsetX * (RADIUS - 26) : 0);
    dotY.set(active && sample?.faceDetected ? offsetY * (RADIUS - 26) : 0);
  }, [offsetX, offsetY, active, sample?.faceDetected, dotX, dotY]);

  return (
    <div
      className={cn("relative grid place-items-center", className)}
      style={{ width: SIZE, height: SIZE }}
    >
      {/* State-tinted bloom behind the dial. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-4 rounded-full blur-3xl"
        animate={{ opacity: active ? (isAway ? 0.55 : 0.35) : 0.12 }}
        transition={{ duration: 0.6 }}
        style={{
          background: `radial-gradient(circle at 50% 50%, ${copy.tone}, transparent 68%)`,
        }}
      />

      {isAway && (
        <span
          aria-hidden
          className="pointer-events-none absolute size-[220px] rounded-full border animate-(--animate-pulse-ring)"
          style={{ borderColor: copy.tone }}
        />
      )}

      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="absolute inset-0 -rotate-90"
        aria-hidden
      >
        <defs>
          <linearGradient id="orb-arc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-signal)" />
            <stop offset="100%" stopColor={copy.tone} />
          </linearGradient>
        </defs>

        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="oklch(1 0 0 / 8%)"
          strokeWidth={2}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS - 14}
          fill="none"
          stroke="oklch(1 0 0 / 4%)"
          strokeWidth={1}
          strokeDasharray="2 8"
        />
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="url(#orb-arc)"
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          style={{ strokeDashoffset: dashOffset }}
        />
      </svg>

      {/* Reticle: the coordinate frame the dot moves in. */}
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="absolute inset-0"
        aria-hidden
      >
        <g stroke="oklch(1 0 0 / 7%)" strokeWidth={1}>
          <line x1={SIZE / 2} y1={54} x2={SIZE / 2} y2={SIZE - 54} />
          <line x1={54} y1={SIZE / 2} x2={SIZE - 54} y2={SIZE / 2} />
        </g>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={30}
          fill="none"
          stroke="oklch(1 0 0 / 9%)"
          strokeDasharray="3 6"
        />
      </svg>

      <motion.span
        aria-hidden
        className="absolute size-3 rounded-full border border-white/70"
        style={{
          x: dotX,
          y: dotY,
          backgroundColor: copy.tone,
          boxShadow: `0 0 18px 2px ${copy.tone}`,
          opacity: active && sample?.faceDetected ? 1 : 0.25,
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-1 text-center">
        <span
          className="tabular text-[2.75rem] font-semibold leading-none tracking-tighter"
          style={{ color: copy.tone }}
        >
          {Math.round(score * 100)}
          <span className="ml-0.5 text-base font-normal text-ink-faint">%</span>
        </span>
        <span className="text-xs font-medium tracking-tight text-ink">
          {copy.label}
        </span>
        {active && reading.pendingMs > 0 && (
          <span className="tabular text-[0.6875rem] text-ink-faint">
            {(reading.pendingMs / 1000).toFixed(1)}s to switch
          </span>
        )}
      </div>
    </div>
  );
}
