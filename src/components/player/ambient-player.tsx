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

import { toast } from "sonner";

import { CameraCanvas } from "@/components/attention/camera-canvas";
import { useAttention } from "@/components/attention/attention-provider";
import { usePlayback } from "@/components/player/playback-provider";
import { Button } from "@/components/ui/button";
import { useFullscreen } from "@/hooks/use-fullscreen";
import {
  resolveInitialMuted,
  resolveStartPosition,
} from "@/lib/media/playback";
import { STATE_COPY } from "@/lib/attention/types";
import { useSessionStore } from "@/lib/store/session-store";
import { useSettingsStore } from "@/lib/store/settings-store";
import { clamp, cn, formatDuration } from "@/lib/utils";

/**
 * Last-known position per clip, surviving the player unmounting. Only consulted
 * under the opt-in "resume" policy — by default every trigger replays from the
 * top, so this is recorded but ignored.
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
  const resumeAppliedRef = React.useRef(false);

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

  /**
   * A clip the browser cannot decode is a dead end for that clip, not for the
   * feature: skip to the next one if the library has it, and otherwise close
   * rather than leaving a black rectangle over the screen.
   *
   * Individual `<source>` children fire their own error events as the browser
   * works down the list, and React surfaces those here too. Those are ordinary
   * fallback, not failure — only the media element setting `video.error`, once
   * every candidate is exhausted, means the clip is genuinely unplayable.
   */
  const handleDecodeError = React.useCallback(() => {
    const video = videoRef.current;
    if (!video?.error) return;

    const { logEvent } = useSessionStore.getState();
    const label = clip?.name ?? "This clip";

    logEvent({
      kind: "notice",
      label: `${label} could not be played`,
      detail: "No source in this clip is a format this browser can decode.",
    });

    if (clipCount > 1) {
      toast.error(`Skipping "${label}"`, {
        description: "This browser can't decode any of its sources.",
      });
      playNext();
      return;
    }

    toast.error(`"${label}" can't be played here`, {
      description:
        "Add an H.264 MP4 or VP9 WebM encode — see public/videos/README.md.",
    });
    dismiss();
  }, [clip?.name, clipCount, playNext, dismiss]);

  /**
   * Seeks to the session's start position. Deferred to `loadedmetadata` because
   * a clip loaded through `<source>` children has no duration before then, and
   * runs once per session — looping re-fires the event, which must not re-seek.
   */
  const applyResumePosition = React.useCallback(() => {
    const video = videoRef.current;
    if (!video || !clip || resumeAppliedRef.current) return;
    resumeAppliedRef.current = true;

    video.currentTime = resolveStartPosition({
      policy: preferences.resumePolicy,
      savedSeconds: resumePositions.get(clip.id) ?? 0,
      durationSeconds: video.duration,
    });
  }, [clip, preferences.resumePolicy]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!active || !video || !clip) return;

    // Every session starts from the preference, never from whatever the last
    // one degraded to. A single autoplay-blocked start used to leave `muted`
    // stuck on for the rest of the page's life, so later look-aways played
    // silently even with "start muted" switched off.
    const wantsMuted = resolveInitialMuted(preferences.muted);
    setMuted(wantsMuted);
    setAutoplayBlocked(false);
    video.muted = wantsMuted;
    video.volume = preferences.softFade ? 0 : preferences.volume;

    // The seek waits for metadata (see `applyResumePosition`): a clip served
    // through <source> children has no duration yet at this point, and
    // assigning currentTime before then is discarded.
    resumeAppliedRef.current = false;
    video.load();

    void video
      .play()
      .then(() => {
        setPaused(false);
        rampVolume(preferences.volume, 700);
      })
      .catch(() => {
        // Browsers block unmuted autoplay without a gesture. Play muted rather
        // than not at all, and surface the "tap to unmute" affordance.
        video.muted = true;
        setMuted(true);
        void video
          .play()
          .then(() => {
            setPaused(false);
            // Ramp anyway: the volume must be right the instant the user
            // unmutes, otherwise they unmute into silence.
            rampVolume(preferences.volume, 700);
          })
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
            // Keyed by clip: browsers only re-evaluate <source> children on a
            // fresh media element, so swapping clips has to remount this.
            key={clip.id}
            loop={preferences.loop}
            playsInline
            initial={{ scale: 1.04, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="size-full object-contain"
            onLoadedMetadata={(event) => {
              setDuration(event.currentTarget.duration || 0);
              applyResumePosition();
            }}
            onTimeUpdate={(event) =>
              setProgress(event.currentTarget.currentTime)
            }
            onEnded={() => {
              resumePositions.delete(clip.id);
              if (!preferences.loop && clipCount > 1) playNext();
            }}
            onError={handleDecodeError}
            onClick={togglePlay}
          >
            {/* Offered in preference order; the browser takes the first it can decode. */}
            {clip.sources.map((source) => (
              <source
                key={source.url}
                src={source.url}
                type={source.mimeType}
              />
            ))}
          </motion.video>

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
