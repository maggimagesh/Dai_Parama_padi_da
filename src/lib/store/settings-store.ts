"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  DEFAULT_ATTENTION_SETTINGS,
  type AttentionSettings,
  type Calibration,
} from "@/lib/attention/types";

/** How a triggered clip picks up: where it left off, or from the top. */
export type ResumePolicy = "resume" | "restart";

export interface Preferences {
  /** Master switch for camera-based triggering. */
  gazeTriggerEnabled: boolean;
  /** Master switch for the inactivity fallback. */
  idleTriggerEnabled: boolean;
  idleTimeoutMs: number;
  /** Idle playback goes fullscreen; gaze playback can stay windowed. */
  fullscreenOnIdle: boolean;
  fullscreenOnAway: boolean;
  muted: boolean;
  volume: number;
  resumePolicy: ResumePolicy;
  /** Advance through the library instead of repeating one clip. */
  shuffle: boolean;
  loop: boolean;
  /** Fade audio in and out instead of cutting it. */
  softFade: boolean;
  /** Debug overlays on the camera preview. */
  showLandmarks: boolean;
  mirrorPreview: boolean;
  /** Sit the preview in the corner while the overlay player is up. */
  keepPreviewDuringPlayback: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  gazeTriggerEnabled: true,
  idleTriggerEnabled: true,
  idleTimeoutMs: 180_000,
  fullscreenOnIdle: true,
  fullscreenOnAway: false,
  muted: false,
  volume: 0.7,
  resumePolicy: "restart",
  shuffle: false,
  loop: true,
  softFade: true,
  showLandmarks: true,
  mirrorPreview: true,
  keepPreviewDuringPlayback: true,
};

interface SettingsState {
  attention: AttentionSettings;
  preferences: Preferences;
  calibration: Calibration | null;
  activeClipId: string | null;
  /** Cleared once the user has seen the first-run walkthrough. */
  onboarded: boolean;
  hydrated: boolean;

  setAttention: (patch: Partial<AttentionSettings>) => void;
  setPreference: <K extends keyof Preferences>(
    key: K,
    value: Preferences[K],
  ) => void;
  setCalibration: (calibration: Calibration | null) => void;
  setActiveClipId: (id: string | null) => void;
  completeOnboarding: () => void;
  resetTuning: () => void;
  markHydrated: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      attention: DEFAULT_ATTENTION_SETTINGS,
      preferences: DEFAULT_PREFERENCES,
      calibration: null,
      activeClipId: null,
      onboarded: false,
      hydrated: false,

      setAttention: (patch) =>
        set((state) => ({ attention: { ...state.attention, ...patch } })),

      setPreference: (key, value) =>
        set((state) => ({
          preferences: { ...state.preferences, [key]: value },
        })),

      setCalibration: (calibration) => set({ calibration }),
      setActiveClipId: (activeClipId) => set({ activeClipId }),
      completeOnboarding: () => set({ onboarded: true }),

      resetTuning: () =>
        set({
          attention: DEFAULT_ATTENTION_SETTINGS,
          calibration: null,
        }),

      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "peripheral.settings",
      version: 3,
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<SettingsState>;
        // v1 shipped a 60s fallback; the timeout is now three minutes.
        if (version < 2 && state.preferences) {
          state.preferences = {
            ...state.preferences,
            idleTimeoutMs: DEFAULT_PREFERENCES.idleTimeoutMs,
          };
        }
        // v2 resumed a triggered clip mid-way. Every trigger now replays from
        // the top, which is what people expect from an ambient player.
        if (version < 3 && state.preferences) {
          state.preferences = {
            ...state.preferences,
            resumePolicy: DEFAULT_PREFERENCES.resumePolicy,
          };
        }
        return state as SettingsState;
      },
      partialize: ({
        attention,
        preferences,
        calibration,
        activeClipId,
        onboarded,
      }) => ({
        attention,
        preferences,
        calibration,
        activeClipId,
        onboarded,
      }),
      // Merge rather than replace, so preferences added in a later version
      // still get their defaults instead of coming back undefined.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<SettingsState>;
        return {
          ...current,
          ...saved,
          attention: { ...current.attention, ...saved.attention },
          preferences: { ...current.preferences, ...saved.preferences },
        };
      },
      // `hydrated` gates camera work until localStorage has been read, so we
      // never start tracking against defaults and then swap settings underneath.
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);
