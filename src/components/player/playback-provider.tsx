"use client";

import * as React from "react";

import { isAwayState } from "@/lib/attention/engine";
import { IdleWatcher } from "@/lib/idle/idle-watcher";
import type { Clip } from "@/lib/media/types";
import {
  useSessionStore,
  type PlaybackTrigger,
} from "@/lib/store/session-store";
import { useSettingsStore } from "@/lib/store/settings-store";

interface PlaybackContextValue {
  clip: Clip | null;
  trigger: PlaybackTrigger | null;
  sticky: boolean;
  /** True while the overlay player should be mounted. */
  active: boolean;
  idleMs: number;
  playManually: (clipId?: string) => void;
  dismiss: () => void;
  playNext: () => void;
}

const PlaybackContext = React.createContext<PlaybackContextValue | null>(null);

export function usePlayback() {
  const context = React.useContext(PlaybackContext);
  if (!context) {
    throw new Error("usePlayback must be used inside <PlaybackProvider>.");
  }
  return context;
}

/**
 * The director. It watches two independent triggers and decides what the
 * player does about them:
 *
 *  - **Gaze** — you looked away from the monitor. Playback runs only while that
 *    remains true, and stops the moment you look back.
 *  - **Idle** — the machine went untouched for long enough. Playback goes
 *    fullscreen and is *sticky*: it stays up until you dismiss it by hand, even
 *    once you start typing again.
 *
 * Idle outranks gaze, and can promote an already-running gaze session to a
 * sticky one, so the two triggers never fight over the same player.
 */
export function PlaybackProvider({ children }: { children: React.ReactNode }) {
  const clips = useSessionStore((state) => state.clips);
  const reading = useSessionStore((state) => state.reading);
  const trackerStatus = useSessionStore((state) => state.trackerStatus);
  const playbackTrigger = useSessionStore((state) => state.playbackTrigger);
  const playingClipId = useSessionStore((state) => state.playingClipId);
  const sticky = useSessionStore((state) => state.sticky);
  const isIdle = useSessionStore((state) => state.isIdle);

  const activeClipId = useSettingsStore((state) => state.activeClipId);
  const setActiveClipId = useSettingsStore((state) => state.setActiveClipId);
  const preferences = useSettingsStore((state) => state.preferences);

  const [idleMs, setIdleMs] = React.useState(0);

  const watcherRef = React.useRef<IdleWatcher | null>(null);
  const startedAtRef = React.useRef<number | null>(null);
  // Set when a gaze-triggered player is dismissed by hand: suppresses
  // re-triggering until attention has actually returned to the screen.
  const gazeSuppressedRef = React.useRef(false);

  const selectedClip = React.useMemo(
    () =>
      clips.find((clip) => clip.id === (playingClipId ?? activeClipId)) ??
      clips[0] ??
      null,
    [clips, playingClipId, activeClipId],
  );

  /* -- idle watcher ------------------------------------------------------- */

  React.useEffect(() => {
    const { setIdle, logEvent, recordIdleEpisode } = useSessionStore.getState();

    if (!preferences.idleTriggerEnabled) {
      setIdle(false);
      return;
    }

    const watcher = new IdleWatcher({
      timeoutMs: useSettingsStore.getState().preferences.idleTimeoutMs,
      onIdle: () => {
        const seconds = Math.round(
          useSettingsStore.getState().preferences.idleTimeoutMs / 1000,
        );
        setIdle(true);
        recordIdleEpisode();
        logEvent({
          kind: "went-idle",
          label: "Machine went idle",
          detail: `No input for ${seconds}s — fullscreen playback armed.`,
        });
      },
      onActive: () => {
        setIdle(false);
        logEvent({ kind: "resumed-activity", label: "Activity resumed" });
      },
    });

    watcherRef.current = watcher;
    watcher.start();

    const ticker = window.setInterval(() => setIdleMs(watcher.idleMs), 500);

    return () => {
      window.clearInterval(ticker);
      watcher.stop();
      watcherRef.current = null;
    };
    // Re-created only when the trigger is switched on or off; timeout changes
    // are pushed into the live instance below instead of tearing it down.
  }, [preferences.idleTriggerEnabled]);

  React.useEffect(() => {
    watcherRef.current?.setTimeoutMs(preferences.idleTimeoutMs);
  }, [preferences.idleTimeoutMs]);

  /* -- trigger evaluation ------------------------------------------------- */

  const gazeAway =
    preferences.gazeTriggerEnabled &&
    trackerStatus === "running" &&
    isAwayState(reading.state);

  const idleTriggered = preferences.idleTriggerEnabled && isIdle;

  React.useEffect(() => {
    if (!gazeAway) gazeSuppressedRef.current = false;
  }, [gazeAway]);

  React.useEffect(() => {
    const { startPlayback, stopPlayback, logEvent, setSticky } =
      useSessionStore.getState();

    const clipId = selectedClip?.id;

    const begin = (trigger: PlaybackTrigger, isSticky: boolean) => {
      if (!clipId) return;
      startedAtRef.current = Date.now();
      startPlayback(trigger, clipId, isSticky);
      logEvent({
        kind: "playback-started",
        label:
          trigger === "idle"
            ? "Fullscreen playback started"
            : "Playback started",
        detail:
          trigger === "idle"
            ? "Inactivity fallback — stays up until dismissed."
            : "Running until you look back at the screen.",
      });
    };

    // Idle wins, and promotes an in-flight gaze session rather than restarting it.
    if (idleTriggered) {
      if (!playbackTrigger) {
        begin("idle", true);
      } else if (!sticky) {
        setSticky(true);
      }
      return;
    }

    if (gazeAway && !gazeSuppressedRef.current) {
      if (!playbackTrigger) begin("gaze", false);
      return;
    }

    // Nothing is asking for playback: retire anything that isn't sticky.
    if (playbackTrigger === "gaze" && !gazeAway) {
      const playedMs = startedAtRef.current
        ? Date.now() - startedAtRef.current
        : 0;
      startedAtRef.current = null;
      stopPlayback(playedMs);
      logEvent({
        kind: "playback-stopped",
        label: "Playback paused",
        detail: "You looked back at the monitor.",
      });
    }
  }, [gazeAway, idleTriggered, playbackTrigger, sticky, selectedClip?.id]);

  /* -- imperative controls ------------------------------------------------ */

  const dismiss = React.useCallback(() => {
    const { playbackTrigger: trigger, stopPlayback, logEvent } =
      useSessionStore.getState();

    if (trigger === "gaze") {
      // Don't relaunch the instant this effect re-runs — wait until the user
      // has genuinely looked back at least once.
      gazeSuppressedRef.current = true;
    }

    const playedMs = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
    startedAtRef.current = null;
    stopPlayback(playedMs);
    // Closing the player is itself an interaction; without this the idle timer
    // would still be expired and immediately reopen it.
    watcherRef.current?.nudge();
    logEvent({ kind: "playback-stopped", label: "Player closed" });
  }, []);

  const playManually = React.useCallback(
    (clipId?: string) => {
      const { startPlayback, logEvent } = useSessionStore.getState();
      const target = clipId ?? selectedClip?.id;
      if (!target) return;
      if (clipId) setActiveClipId(clipId);
      startedAtRef.current = Date.now();
      startPlayback("manual", target, true);
      logEvent({ kind: "playback-started", label: "Preview started" });
    },
    [selectedClip?.id, setActiveClipId],
  );

  const playNext = React.useCallback(() => {
    if (clips.length < 2 || !selectedClip) return;
    const index = clips.findIndex((clip) => clip.id === selectedClip.id);
    const nextIndex = preferences.shuffle
      ? (index + 1 + Math.floor(Math.random() * (clips.length - 1))) % clips.length
      : (index + 1) % clips.length;
    const next = clips[nextIndex];
    setActiveClipId(next.id);
    useSessionStore.setState({ playingClipId: next.id });
  }, [clips, selectedClip, preferences.shuffle, setActiveClipId]);

  const value = React.useMemo<PlaybackContextValue>(
    () => ({
      clip: selectedClip,
      trigger: playbackTrigger,
      sticky,
      active: playbackTrigger !== null && selectedClip !== null,
      // A disabled fallback has no meaningful countdown to report.
      idleMs: preferences.idleTriggerEnabled ? idleMs : 0,
      playManually,
      dismiss,
      playNext,
    }),
    [
      selectedClip,
      playbackTrigger,
      sticky,
      idleMs,
      preferences.idleTriggerEnabled,
      playManually,
      dismiss,
      playNext,
    ],
  );

  return (
    <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>
  );
}
