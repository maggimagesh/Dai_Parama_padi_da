"use client";

import * as React from "react";

import { useSessionStore } from "@/lib/store/session-store";
import { useSettingsStore } from "@/lib/store/settings-store";
import { cn } from "@/lib/utils";

/**
 * Rolling plot of the smoothed attention score with the enter/exit thresholds
 * drawn in. Seeing the trace sit between the two bands is what makes the dead
 * band — and therefore the tuning sliders — legible.
 */
export function SignalTrace({ className }: { className?: string }) {
  const trace = useSessionStore((state) => state.trace);
  const enterThreshold = useSettingsStore((state) => state.attention.enterThreshold);
  const exitThreshold = useSettingsStore((state) => state.attention.exitThreshold);

  const width = 100;
  const height = 32;

  const path = React.useMemo(() => {
    if (trace.length < 2) return "";
    const step = width / (trace.length - 1);
    return trace
      .map((value, index) => {
        const x = index * step;
        const y = height - value * height;
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }, [trace]);

  const area = path ? `${path} L${width},${height} L0,${height} Z` : "";

  const empty = trace.length < 2;

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className={cn("h-16 w-full transition-opacity duration-500", empty && "opacity-30")}
        aria-hidden
      >
        <defs>
          <linearGradient id="trace-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-signal)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--color-signal)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Dead band: between these lines the state is held, not flipped. */}
        <rect
          x="0"
          y={height - enterThreshold * height}
          width={width}
          height={Math.max(0, (enterThreshold - exitThreshold) * height)}
          fill="oklch(1 0 0 / 4%)"
        />
        <line
          x1="0"
          x2={width}
          y1={height - enterThreshold * height}
          y2={height - enterThreshold * height}
          stroke="var(--color-focus)"
          strokeOpacity="0.5"
          strokeWidth="1"
          strokeDasharray="3 4"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1="0"
          x2={width}
          y1={height - exitThreshold * height}
          y2={height - exitThreshold * height}
          stroke="var(--color-away)"
          strokeOpacity="0.5"
          strokeWidth="1"
          strokeDasharray="3 4"
          vectorEffect="non-scaling-stroke"
        />

        {area && <path d={area} fill="url(#trace-fill)" />}
        {path && (
          <path
            d={path}
            fill="none"
            stroke="var(--color-signal)"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {empty && (
        <span className="pointer-events-none absolute inset-x-0 top-5 text-center text-[0.6875rem] text-ink-faint">
          Waiting for the sensor
        </span>
      )}

      <div className="mt-1 flex items-center justify-between text-[0.625rem] text-ink-faint">
        <span>
          {empty
            ? "Attention signal"
            : `Attention signal · last ${trace.length} frames`}
        </span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <i className="size-1.5 rounded-full bg-focus" />
            look-back {Math.round(enterThreshold * 100)}%
          </span>
          <span className="flex items-center gap-1">
            <i className="size-1.5 rounded-full bg-away" />
            look-away {Math.round(exitThreshold * 100)}%
          </span>
        </span>
      </div>
    </div>
  );
}
