"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Eye,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  SkipForward,
  Timer,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import { CameraCanvas } from "@/components/attention/camera-canvas";
import { useAttention } from "@/components/attention/attention-provider";
import { usePlayback } from "@/components/player/playback-provider";
import { Button } from "@/components/ui/button";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { STATE_COPY } from "@/lib/attention/types";
import { useSessionStore } from "@/lib/store/session-store";
import { useSettingsStore } from "@/lib/store/settings-store";
import { clamp, cn, formatDuration } from "@/lib/utils";

/**
 * Playback positions survive the player unmounting, so a clip interrupted by
 * looking back picks up where it left off on the next look-away.
 */
const resumePositions = new Map<string, number>();

const FADE_STEP_MS = 40;
const CONTROLS_IDLE_MS = 2600;

export function AmbientPlayer() {
  const { clip, trigger, sticky, active, dismiss, playNext } = usePlayback();
  const { enabled: trackingEnabled } = useAttention();

  const preferences = useSettingsStore((state) => state.preferences);
  const reading = useSessionStore((state) => state.reading);
  const clipCount = useSessionStore((state) => state.clips.length);

  const shellRef = React.useRef<HTMLDivElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const fadeRef = React.useRef<number | null>(null);

  const { isFullscreen, enter, exit } = useFullscreen(shellRef);

  const [paused, setPaused] = React.useState(false);
  const [muted, setMuted] = React.useState(preferences.muted);
  const [progress, setProgress] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [controlsVisible, setControlsVisible] = React.useState(true);
  const [autoplayBlocked, setAutoplayBlocked] = React.useState(false);

  const wantsFullscreen =
    trigger === "idle"
      ? preferences.fullscreenOnIdle
      : trigger === "gaze"
        ? preferences.fullscreenOnAway
        : false;

  /* -- audio ramping ------------------------------------------------------ */

  const clearFade = React.useCallback(() => {
    if (fadeRef.current !== null) {
      window.clearInterval(fadeRef.current);
      fadeRef.current = null;
    }
  }, []);

  const rampVolume = React.useCallback(
    (to: number, durationMs: number, onDone?: () => void) => {
      const video = videoRef.current;
      if (!video) return;
      clearFade();

      if (!preferences.softFade || durationMs <= 0) {
        video.volume = clamp(to);
        onDone?.();
        return;
      }

      const from = video.volume;
      const steps = Math.max(1, Math.round(durationMs / FADE_STEP_MS));
      let step = 0;

      fadeRef.current = window.setInterval(() => {
        step += 1;
        const next = from + (to - from) * (step / steps);
        video.volume = clamp(next);
        if (step >= steps) {
          clearFade();
          onDone?.();
        }
      }, FADE_STEP_MS);
    },
    [preferences.softFade, clearFade],
  );

  /* -- start / stop ------------------------------------------------------- */

  React.useEffect(() => {
    const video = videoRef.current;
    if (!active || !video || !clip) return;

    video.muted = muted;
    video.volume = preferences.softFade ? 0 : preferences.volume;

    const saved = resumePositions.get(clip.id) ?? 0;
    if (preferences.resumePolicy === "resume" && saved > 0) {
      // A clip that ran to the end should start over rather than sit on its
      // final frame.
      video.currentTime =
        saved < (video.duration || Infinity) - 0.5 ? saved : 0;
    } else {
      video.currentTime = 0;
    }

    void video
      .play()
      .then(() => {
        setAutoplayBlocked(false);
        setPaused(false);
        rampVolume(preferences.volume, 700);
      })
      .catch(() => {
        // Browsers block unmuted autoplay without a gesture. Rather than
        // failing, drop to muted playback and say so.
        video.muted = true;
        setMuted(true);
        void video
          .play()
          .then(() => setPaused(false))
          .catch(() => setPaused(true));
        setAutoplayBlocked(true);
      });

    return () => {
      clearFade();
      if (clip) resumePositions.set(clip.id, video.currentTime);
      video.pause();
    };
    // Restarting on every preference tweak would interrupt playback; the clip
    // and the trigger are what genuinely define a playback session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, clip?.id, trigger]);

  React.useEffect(() => {
    if (!active || !wantsFullscreen) return;
    void enter();
    return () => {
      void exit();
    };
  }, [active, wantsFullscreen, enter, exit]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    if (!muted && !fadeRef.current) video.volume = preferences.volume;
  }, [muted, preferences.volume]);

  /* -- controls auto-hide ------------------------------------------------- */

  React.useEffect(() => {
    if (!active) return;
    let timer = window.setTimeout(
      () => setControlsVisible(false),
      CONTROLS_IDLE_MS,
    );

    const wake = () => {
      setControlsVisible(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(
        () => setControlsVisible(false),
        CONTROLS_IDLE_MS,
      );
    };

    const shell = shellRef.current;
    shell?.addEventListener("pointermove", wake);
    shell?.addEventListener("pointerdown", wake);

    return () => {
      window.clearTimeout(timer);
      shell?.removeEventListener("pointermove", wake);
      shell?.removeEventListener("pointerdown", wake);
    };
  }, [active]);

  // Move focus onto the overlay when it opens: playback can start while your
  // hands are nowhere near the machine, and Escape should work on the first press.
  React.useEffect(() => {
    if (active) shellRef.current?.focus();
  }, [active]);

  /* -- keyboard ----------------------------------------------------------- */

  const togglePlay = React.useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().then(() => setPaused(false));
    } else {
      video.pause();
      setPaused(true);
    }
  }, []);

  React.useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
      }
      if (event.key === " " || event.key === "k") {
        event.preventDefault();
        togglePlay();
      }
      if (event.key === "m") setMuted((value) => !value);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, dismiss, togglePlay]);

  const stateCopy = STATE_COPY[reading.state];
  const percent = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    // `mode="wait"` matters here: a fast look-away / look-back / look-away
    // sequence would otherwise stack the incoming overlay on top of the one
    // still animating out.
    <AnimatePresence mode="wait">
      {active && clip ? (
        <motion.div
          ref={shellRef}
          key="ambient-player"
          role="dialog"
          aria-modal="true"
          aria-label={`Playing ${clip.name}`}
          tabIndex={-1}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-50 grid place-items-center bg-black"
        >
          <motion.video
            ref={videoRef}
            src={clip.url}
            loop={preferences.loop}
            playsInline
            initial={{ scale: 1.04, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="size-full object-contain"
            onLoadedMetadata={(event) =>
              setDuration(event.currentTarget.duration || 0)
            }
            onTimeUpdate={(event) =>
              setProgress(event.currentTarget.currentTime)
            }
            onEnded={() => {
              resumePositions.delete(clip.id);
              if (!preferences.loop && clipCount > 1) playNext();
            }}
            onClick={togglePlay}
          />

          {/* Vignette keeps the chrome readable over bright footage. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,oklch(0_0_0/65%)_100%)]"
          />

          {/*
            The chrome fades in place rather than mounting and unmounting.
            A nested AnimatePresence inside the overlay's own presence tree
            can leave the parent's exit unresolved, stranding an invisible
            full-screen layer over the page.
          */}
          <motion.div
            animate={{
              opacity: controlsVisible ? 1 : 0,
              y: controlsVisible ? 0 : -12,
            }}
            transition={{ duration: 0.25 }}
            className={cn(
              "absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-3 bg-linear-to-b from-black/70 to-transparent p-5 sm:p-7",
              !controlsVisible && "pointer-events-none",
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur"
                style={{
                  borderColor: `color-mix(in oklch, ${trigger === "idle" ? "var(--color-idle)" : stateCopy.tone} 40%, transparent)`,
                  color:
                    trigger === "idle" ? "var(--color-idle)" : stateCopy.tone,
                  backgroundColor: "oklch(0 0 0 / 40%)",
                }}
              >
                {trigger === "idle" ? (
                  <Timer className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
                {trigger === "idle"
                  ? "Inactivity fallback"
                  : trigger === "gaze"
                    ? "You looked away"
                    : "Preview"}
              </span>

              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {clip.name}
                </p>
                <p className="mt-0.5 text-[0.6875rem] text-white/55">
                  {sticky
                    ? "Stays until you close it"
                    : "Stops when you look back at the monitor"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {preferences.keepPreviewDuringPlayback && trackingEnabled && (
                <div className="relative hidden aspect-video w-32 overflow-hidden rounded-xl border border-white/15 sm:block">
                  <CameraCanvas
                    className="absolute inset-0"
                    overlay={false}
                    quality={0.6}
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-center text-[0.5625rem] tracking-wide text-white/70">
                    {Math.round(reading.score * 100)}% on screen
                  </span>
                </div>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={dismiss}
                aria-label="Close player"
                className="bg-black/40 text-white hover:bg-white/15"
              >
                <X />
              </Button>
            </div>
          </motion.div>

          <motion.div
            animate={{
              opacity: controlsVisible ? 1 : 0,
              y: controlsVisible ? 0 : 16,
            }}
            transition={{ duration: 0.25 }}
            className={cn(
              "absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent p-5 sm:p-7",
              !controlsVisible && "pointer-events-none",
            )}
          >
            {autoplayBlocked && (
              <p className="mx-auto mb-3 w-fit rounded-full bg-white/10 px-3 py-1.5 text-[0.6875rem] text-white/70">
                Your browser blocked audio until you interact — press{" "}
                <kbd className="font-mono">M</kbd> to unmute.
              </p>
            )}

            <div className="mx-auto flex max-w-4xl items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePlay}
                aria-label={paused ? "Play" : "Pause"}
                className="text-white hover:bg-white/15"
              >
                {paused ? <Play /> : <Pause />}
              </Button>

              <span className="tabular shrink-0 text-xs text-white/70">
                {formatDuration(progress)}
              </span>

              <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/20">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-white"
                  style={{ width: `${percent}%` }}
                />
              </div>

              <span className="tabular shrink-0 text-xs text-white/70">
                {formatDuration(duration)}
              </span>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMuted((value) => !value)}
                aria-label={muted ? "Unmute" : "Mute"}
                className="text-white hover:bg-white/15"
              >
                {muted ? <VolumeX /> : <Volume2 />}
              </Button>

              {clipCount > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={playNext}
                  aria-label="Next clip"
                  className="text-white hover:bg-white/15"
                >
                  <SkipForward />
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={() => (isFullscreen ? void exit() : void enter())}
                aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                className="text-white hover:bg-white/15"
              >
                {isFullscreen ? <Minimize2 /> : <Maximize2 />}
              </Button>
            </div>
          </motion.div>

          {/* Non-sticky playback needs no dismissal, so say what will end it. */}
          {!sticky && (
            <motion.span
              animate={{ opacity: controlsVisible ? 0 : 1 }}
              transition={{ duration: 0.25 }}
              className={cn(
                "pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full px-4 py-2",
                "bg-black/45 text-[0.6875rem] tracking-wide text-white/60 backdrop-blur",
              )}
            >
              Look back at the monitor to stop
            </motion.span>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
