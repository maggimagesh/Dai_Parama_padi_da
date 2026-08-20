"use client";

import * as React from "react";
import type { FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { toast } from "sonner";

import { AttentionEngine, isAwayState } from "@/lib/attention/engine";
import { captureCalibration, toGazeSample } from "@/lib/attention/gaze";
import { describeCameraError, FaceTracker } from "@/lib/attention/face-tracker";
import type { AttentionState, GazeSample } from "@/lib/attention/types";
import { useSessionStore } from "@/lib/store/session-store";
import { useSettingsStore } from "@/lib/store/settings-store";

const CALIBRATION_MS = 1600;

interface AttentionContextValue {
  /** The live camera element every preview surface draws from. */
  videoElement: HTMLVideoElement | null;
  /** Latest raw landmark result, read imperatively by canvas painters. */
  resultRef: React.RefObject<FaceLandmarkerResult | null>;
  enabled: boolean;
  calibrating: boolean;
  enable: () => void;
  disable: () => void;
  toggle: () => void;
  calibrate: () => void;
}

const AttentionContext = React.createContext<AttentionContextValue | null>(null);

export function useAttention() {
  const context = React.useContext(AttentionContext);
  if (!context) {
    throw new Error("useAttention must be used inside <AttentionProvider>.");
  }
  return context;
}

export function AttentionProvider({ children }: { children: React.ReactNode }) {
  const [videoElement, setVideoElement] = React.useState<HTMLVideoElement | null>(
    null,
  );
  const [armed, setArmed] = React.useState(false);
  const [calibrating, setCalibrating] = React.useState(false);

  const resultRef = React.useRef<FaceLandmarkerResult | null>(null);
  const trackerRef = React.useRef<FaceTracker | null>(null);
  const engineRef = React.useRef<AttentionEngine | null>(null);
  const previousStateRef = React.useRef<AttentionState>("offline");
  const awaySinceRef = React.useRef<number | null>(null);
  const calibrationBufferRef = React.useRef<GazeSample[] | null>(null);

  const hydrated = useSettingsStore((state) => state.hydrated);
  const attentionSettings = useSettingsStore((state) => state.attention);
  const calibration = useSettingsStore((state) => state.calibration);
  const setCalibration = useSettingsStore((state) => state.setCalibration);
  const gazeTriggerEnabled = useSettingsStore(
    (state) => state.preferences.gazeTriggerEnabled,
  );

  // Derived rather than mirrored: switching the trigger off in settings must
  // release the camera immediately, and leaving an indicator light on for a
  // disabled feature would be its own kind of bug.
  const enabled = armed && gazeTriggerEnabled;

  // Read-only snapshots of the store actions; these identities are stable.
  const { setTrackerStatus, pushReading, resetReading, logEvent, recordAway } =
    useSessionStore.getState();

  /* -- transitions -------------------------------------------------------- */

  const handleStateChange = React.useCallback(
    (next: AttentionState) => {
      const previous = previousStateRef.current;
      if (next === previous) return;
      previousStateRef.current = next;

      const wasAway = isAwayState(previous);
      const isAway = isAwayState(next);

      if (isAway && !wasAway) {
        awaySinceRef.current = Date.now();
        logEvent({
          kind: "looked-away",
          label: next === "no-face" ? "Left the frame" : "Looked away",
          detail:
            next === "no-face"
              ? "No face detected — playback triggered."
              : "Gaze left the screen — playback triggered.",
        });
      }

      if (!isAway && wasAway) {
        const startedAt = awaySinceRef.current;
        awaySinceRef.current = null;
        if (startedAt) recordAway(Date.now() - startedAt);
        logEvent({
          kind: "looked-back",
          label: "Back on screen",
          detail: "Attention re-acquired — playback paused.",
        });
      }
    },
    [logEvent, recordAway],
  );

  /* -- detection callback ------------------------------------------------- */

  const handleResult = React.useCallback(
    (result: FaceLandmarkerResult, timestampMs: number) => {
      resultRef.current = result;

      const engine = engineRef.current;
      if (!engine) return;

      const sample = toGazeSample(result, timestampMs);
      calibrationBufferRef.current?.push(sample);

      const reading = engine.push(sample);
      pushReading(reading);
      handleStateChange(reading.state);
    },
    [pushReading, handleStateChange],
  );

  /* -- lifecycle ---------------------------------------------------------- */

  React.useEffect(() => {
    if (!enabled || !videoElement || !hydrated) return;

    const engine = new AttentionEngine(
      useSettingsStore.getState().attention,
      useSettingsStore.getState().calibration,
    );
    engineRef.current = engine;

    const tracker = new FaceTracker({
      onResult: handleResult,
      onPhase: (phase) => setTrackerStatus(phase),
      onError: (error) => {
        const message = describeCameraError(error);
        setTrackerStatus(
          error.name === "NotAllowedError" ? "denied" : "error",
          message,
        );
        toast.error("Attention tracking stopped", { description: message });
        setArmed(false);
      },
    });
    trackerRef.current = tracker;

    void tracker.start(videoElement).then(() => {
      if (trackerRef.current === tracker) {
        logEvent({
          kind: "tracking-started",
          label: "Attention tracking on",
          detail: "Camera frames are processed on-device only.",
        });
      }
    });

    return () => {
      tracker.stop();
      if (trackerRef.current === tracker) {
        trackerRef.current = null;
        engineRef.current = null;
        resultRef.current = null;
        previousStateRef.current = "offline";
        setTrackerStatus("idle");
        resetReading();
      }
    };
  }, [
    enabled,
    videoElement,
    hydrated,
    handleResult,
    setTrackerStatus,
    resetReading,
    logEvent,
  ]);

  // Tuning changes take effect on the running engine without a camera restart.
  React.useEffect(() => {
    engineRef.current?.setSettings(attentionSettings);
  }, [attentionSettings]);

  React.useEffect(() => {
    engineRef.current?.setCalibration(calibration);
  }, [calibration]);

  /* -- actions ------------------------------------------------------------ */

  const enable = React.useCallback(() => {
    useSettingsStore.getState().setPreference("gazeTriggerEnabled", true);
    setArmed(true);
  }, []);

  const disable = React.useCallback(() => {
    setArmed(false);
    logEvent({ kind: "tracking-stopped", label: "Attention tracking off" });
  }, [logEvent]);

  const toggle = React.useCallback(() => {
    if (enabled) disable();
    else enable();
  }, [enabled, enable, disable]);

  const calibrate = React.useCallback(() => {
    if (!engineRef.current) {
      toast.error("Turn on attention tracking before calibrating.");
      return;
    }
    setCalibrating(true);
    calibrationBufferRef.current = [];

    window.setTimeout(() => {
      const samples = calibrationBufferRef.current ?? [];
      calibrationBufferRef.current = null;
      setCalibrating(false);

      const next = captureCalibration(samples);
      if (!next) {
        toast.error("Calibration failed", {
          description: "Keep your face in view of the camera and try again.",
        });
        return;
      }

      setCalibration(next);
      logEvent({
        kind: "calibrated",
        label: "Neutral pose captured",
        detail: `Head ${next.yaw.toFixed(1)}° / ${next.pitch.toFixed(1)}° set as centre.`,
      });
      toast.success("Calibrated", {
        description: "Your current head position is now the reference point.",
      });
    }, CALIBRATION_MS);
  }, [setCalibration, logEvent]);

  const value = React.useMemo<AttentionContextValue>(
    () => ({
      videoElement,
      resultRef,
      enabled,
      calibrating,
      enable,
      disable,
      toggle,
      calibrate,
    }),
    [videoElement, enabled, calibrating, enable, disable, toggle, calibrate],
  );

  return (
    <AttentionContext.Provider value={value}>
      {/*
        One camera element feeds everything. It stays mounted but visually
        inert — every preview surface paints from it onto its own canvas, which
        lets the dashboard and the player show the feed at the same time.
      */}
      <video
        ref={setVideoElement}
        aria-hidden
        tabIndex={-1}
        muted
        playsInline
        className="pointer-events-none fixed left-0 top-0 -z-10 size-px opacity-0"
      />
      {children}
    </AttentionContext.Provider>
  );
}
