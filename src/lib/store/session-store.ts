"use client";

import { create } from "zustand";

import {
  EMPTY_READING,
  type AttentionReading,
  type TrackerStatus,
} from "@/lib/attention/types";
import type { Clip } from "@/lib/media/types";
import { createId } from "@/lib/utils";

/** What caused the player to open. Determines how it closes again. */
export type PlaybackTrigger = "gaze" | "idle" | "manual";

export interface SessionEvent {
  id: string;
  at: number;
  kind:
    | "tracking-started"
    | "tracking-stopped"
    | "looked-away"
    | "looked-back"
    | "went-idle"
    | "resumed-activity"
    | "playback-started"
    | "playback-stopped"
    | "calibrated"
    | "notice";
  label: string;
  detail?: string;
}

export interface SessionStats {
  awayEpisodes: number;
  idleEpisodes: number;
  totalAwayMs: number;
  longestAwayMs: number;
  totalPlaybackMs: number;
  startedAt: number;
}

const EMPTY_STATS: SessionStats = {
  awayEpisodes: 0,
  idleEpisodes: 0,
  totalAwayMs: 0,
  longestAwayMs: 0,
  totalPlaybackMs: 0,
  startedAt: Date.now(),
};

const MAX_EVENTS = 60;
const MAX_TRACE = 180;

interface SessionState {
  trackerStatus: TrackerStatus;
  trackerError: string | null;
  reading: AttentionReading;
  /** Rolling window of smoothed scores, for the live waveform. */
  trace: number[];

  isIdle: boolean;
  idleSince: number | null;

  clips: Clip[];
  libraryStatus: "loading" | "ready" | "error";
  libraryError: string | null;

  playbackTrigger: PlaybackTrigger | null;
  playingClipId: string | null;
  /** Idle-triggered playback stays up until dismissed by hand. */
  sticky: boolean;

  events: SessionEvent[];
  stats: SessionStats;

  setTrackerStatus: (status: TrackerStatus, error?: string | null) => void;
  pushReading: (reading: AttentionReading) => void;
  resetReading: () => void;
  setIdle: (isIdle: boolean) => void;

  setClips: (clips: Clip[]) => void;
  setLibraryStatus: (
    status: SessionState["libraryStatus"],
    error?: string | null,
  ) => void;

  startPlayback: (trigger: PlaybackTrigger, clipId: string, sticky: boolean) => void;
  stopPlayback: (playedMs?: number) => void;
  setSticky: (sticky: boolean) => void;

  logEvent: (event: Omit<SessionEvent, "id" | "at">) => void;
  recordAway: (durationMs: number) => void;
  recordIdleEpisode: () => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  trackerStatus: "idle",
  trackerError: null,
  reading: EMPTY_READING,
  trace: [],

  isIdle: false,
  idleSince: null,

  clips: [],
  libraryStatus: "loading",
  libraryError: null,

  playbackTrigger: null,
  playingClipId: null,
  sticky: false,

  events: [],
  stats: EMPTY_STATS,

  setTrackerStatus: (trackerStatus, trackerError = null) =>
    set({ trackerStatus, trackerError }),

  pushReading: (reading) =>
    set((state) => {
      const trace = state.trace.length >= MAX_TRACE
        ? [...state.trace.slice(state.trace.length - MAX_TRACE + 1), reading.score]
        : [...state.trace, reading.score];
      return { reading, trace };
    }),

  resetReading: () => set({ reading: EMPTY_READING, trace: [] }),

  setIdle: (isIdle) =>
    set((state) => ({
      isIdle,
      idleSince: isIdle ? (state.idleSince ?? Date.now()) : null,
    })),

  setClips: (clips) => set({ clips }),
  setLibraryStatus: (libraryStatus, libraryError = null) =>
    set({ libraryStatus, libraryError }),

  startPlayback: (playbackTrigger, playingClipId, sticky) =>
    set({ playbackTrigger, playingClipId, sticky }),

  stopPlayback: (playedMs = 0) =>
    set((state) => ({
      playbackTrigger: null,
      playingClipId: null,
      sticky: false,
      stats: {
        ...state.stats,
        totalPlaybackMs: state.stats.totalPlaybackMs + Math.max(0, playedMs),
      },
    })),

  setSticky: (sticky) => set({ sticky }),

  logEvent: (event) =>
    set((state) => ({
      events: [
        { ...event, id: createId("evt"), at: Date.now() },
        ...state.events,
      ].slice(0, MAX_EVENTS),
    })),

  recordAway: (durationMs) =>
    set((state) => ({
      stats: {
        ...state.stats,
        awayEpisodes: state.stats.awayEpisodes + 1,
        totalAwayMs: state.stats.totalAwayMs + durationMs,
        longestAwayMs: Math.max(state.stats.longestAwayMs, durationMs),
      },
    })),

  recordIdleEpisode: () =>
    set((state) => ({
      stats: { ...state.stats, idleEpisodes: state.stats.idleEpisodes + 1 },
    })),

  clearSession: () =>
    set({ events: [], stats: { ...EMPTY_STATS, startedAt: Date.now() }, trace: [] }),
}));
