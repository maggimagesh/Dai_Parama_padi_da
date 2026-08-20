import { describe, expect, it } from "vitest";

import { AttentionEngine, isAwayState } from "@/lib/attention/engine";
import {
  DEFAULT_ATTENTION_SETTINGS,
  type AttentionSettings,
  type GazeSample,
} from "@/lib/attention/types";

const SETTINGS: AttentionSettings = {
  ...DEFAULT_ATTENTION_SETTINGS,
  smoothingTau: 1, // Effectively unsmoothed, so thresholds are exercised directly.
  awayDelayMs: 500,
  returnDelayMs: 200,
  faceLostGraceMs: 600,
};

const FRAME_MS = 50;

function sampleAt(timestamp: number, overrides: Partial<GazeSample> = {}): GazeSample {
  return {
    timestamp,
    faceDetected: true,
    yaw: 0,
    pitch: 0,
    roll: 0,
    gazeX: 0,
    gazeY: 0,
    eyeOpenness: 1,
    facePositionX: 0.5,
    facePositionY: 0.5,
    faceScale: 0.4,
    ...overrides,
  };
}

/** Feeds `count` frames and returns the final reading. */
function run(
  engine: AttentionEngine,
  count: number,
  start: number,
  overrides: Partial<GazeSample> = {},
) {
  let reading = engine.push(sampleAt(start, overrides));
  for (let i = 1; i < count; i++) {
    reading = engine.push(sampleAt(start + i * FRAME_MS, overrides));
  }
  return { reading, endsAt: start + (count - 1) * FRAME_MS };
}

describe("AttentionEngine", () => {
  it("reports focus immediately when the first frame is centred", () => {
    const engine = new AttentionEngine(SETTINGS, null);
    const reading = engine.push(sampleAt(0));

    expect(reading.state).toBe("focused");
    expect(reading.score).toBeGreaterThan(SETTINGS.enterThreshold);
  });

  it("holds at 'drifting' until the away delay elapses", () => {
    const engine = new AttentionEngine(SETTINGS, null);
    engine.push(sampleAt(0));

    // A hard turn away, but only 200ms of it — below the 500ms dwell.
    const { reading } = run(engine, 5, FRAME_MS, { yaw: 70, gazeX: 0.9 });

    expect(reading.state).toBe("drifting");
    expect(reading.pendingMs).toBeGreaterThan(0);
  });

  it("fires 'away' once the signal has stayed low for the away delay", () => {
    const engine = new AttentionEngine(SETTINGS, null);
    engine.push(sampleAt(0));

    const { reading } = run(engine, 20, FRAME_MS, { yaw: 70, gazeX: 0.9 });

    expect(reading.state).toBe("away");
    expect(isAwayState(reading.state)).toBe(true);
  });

  it("returns to focus only after the look-back delay", () => {
    const engine = new AttentionEngine(SETTINGS, null);
    engine.push(sampleAt(0));
    const away = run(engine, 20, FRAME_MS, { yaw: 70, gazeX: 0.9 });
    expect(away.reading.state).toBe("away");

    // One centred frame is not enough to cancel playback.
    const immediate = engine.push(sampleAt(away.endsAt + FRAME_MS));
    expect(immediate.state).toBe("away");

    const recovered = run(engine, 10, away.endsAt + 2 * FRAME_MS);
    expect(recovered.reading.state).toBe("focused");
  });

  it("treats a lost face as away only after the grace period", () => {
    const engine = new AttentionEngine(SETTINGS, null);
    engine.push(sampleAt(0));

    const brief = run(engine, 4, FRAME_MS, { faceDetected: false });
    expect(brief.reading.state).toBe("focused");

    const sustained = run(engine, 20, brief.endsAt + FRAME_MS, {
      faceDetected: false,
    });
    expect(sustained.reading.state).toBe("no-face");
  });

  it("does not flip state inside the dead band", () => {
    const engine = new AttentionEngine(SETTINGS, null);
    engine.push(sampleAt(0));

    // Yaw chosen to land the score inside the dead band.
    const { reading } = run(engine, 30, FRAME_MS, { yaw: 18 });

    expect(reading.score).toBeGreaterThan(SETTINGS.exitThreshold);
    expect(reading.score).toBeLessThan(SETTINGS.enterThreshold);
    expect(reading.state).toBe("focused");
  });

  it("measures deviation from the calibrated neutral pose, not from zero", () => {
    // Someone whose monitor sits to their left holds a permanent yaw offset.
    const calibration = { yaw: 25, pitch: 0, gazeX: 0, gazeY: 0, capturedAt: 0 };
    const engine = new AttentionEngine(SETTINGS, calibration);

    const onScreen = engine.push(sampleAt(0, { yaw: 25 }));
    expect(onScreen.state).toBe("focused");

    // Facing the camera dead-on is now the off-screen case.
    const { reading } = run(engine, 20, FRAME_MS, { yaw: -20 });
    expect(reading.state).toBe("away");
  });

  it("keeps a blink from registering as looking away", () => {
    const engine = new AttentionEngine(SETTINGS, null);
    engine.push(sampleAt(0));

    const { reading } = run(engine, 20, FRAME_MS, { eyeOpenness: 0 });

    expect(reading.state).toBe("focused");
  });
});
