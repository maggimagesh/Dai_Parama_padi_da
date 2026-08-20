"use client";

import * as React from "react";
import { Eye, Lock, Timer } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const STEPS = [
  {
    icon: Eye,
    title: "Look away, it plays",
    body: "The webcam feeds an on-device face landmark model. Head orientation and eyeball direction are combined into one attention score; when it stays below your look-away threshold for the configured delay, the selected clip starts. Look back and it stops.",
  },
  {
    icon: Timer,
    title: "Or walk away, it takes over",
    body: "A second trigger watches for keyboard, pointer, and scroll input. If the machine goes untouched for the timeout — camera or no camera — the clip plays fullscreen and stays there until you close it by hand.",
  },
  {
    icon: Lock,
    title: "Nothing leaves the device",
    body: "The landmark model and its WebAssembly runtime are served from this origin, and uploaded clips are kept in your browser's own storage. No video frame, landmark, or clip is ever sent to a server.",
  },
];

export function HowItWorks({ children }: { children: React.ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogTitle>How Peripheral works</DialogTitle>
        <DialogDescription>
          Two independent triggers, one player, and a strict rule about where
          your data goes.
        </DialogDescription>

        <ul className="mt-6 flex flex-col gap-5">
          {STEPS.map((step) => (
            <li key={step.title} className="flex gap-3.5">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl border border-hairline bg-white/[0.05]">
                <step.icon className="size-4 text-signal" />
              </span>
              <span>
                <span className="block text-[0.8125rem] font-medium text-ink">
                  {step.title}
                </span>
                <span className="text-balance-pretty mt-1 block text-xs leading-relaxed text-ink-faint">
                  {step.body}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-6 rounded-xl border border-hairline bg-white/[0.03] px-3.5 py-3 text-[0.6875rem] leading-relaxed text-ink-faint">
          Gaze estimation from a laptop webcam is an approximation, not eye
          tracking hardware. Calibrate from your normal seating position, and use
          the sensitivity sliders if it triggers too eagerly or not eagerly
          enough.
        </p>
      </DialogContent>
    </Dialog>
  );
}
