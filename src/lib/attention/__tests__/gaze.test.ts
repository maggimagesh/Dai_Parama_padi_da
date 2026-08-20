import { describe, expect, it } from "vitest";

import { captureCalibration, scoreSample } from "@/lib/attention/gaze";
import {
  DEFAULT_ATTENTION_SETTINGS,
  type GazeSample,
} from "@/lib/attention/types";

function makeSample(overrides: Partial<GazeSample> = {}): GazeSample {
  return {
    timestamp: 0,
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

describe("scoreSample", () => {
  it("scores a centred, open-eyed face near the top of the range", () => {
    const score = scoreSample(makeSample(), DEFAULT_ATTENTION_SETTINGS, null);
    expect(score.total).toBeGreaterThan(0.95);
  });

  it("scores zero when no face is detected", () => {
    const score = scoreSample(
      makeSample({ faceDetected: false }),
      DEFAULT_ATTENTION_SETTINGS,
      null,
    );
    expect(score.total).toBe(0);
  });

  it("decays as the head turns further from neutral", () => {
    const slight = scoreSample(makeSample({ yaw: 10 }), DEFAULT_ATTENTION_SETTINGS, null);
    const wide = scoreSample(makeSample({ yaw: 45 }), DEFAULT_ATTENTION_SETTINGS, null);

    expect(slight.head).toBeGreaterThan(wide.head);
    expect(wide.total).toBeLessThan(DEFAULT_ATTENTION_SETTINGS.exitThreshold);
  });

  it("lets head orientation alone drive the score below the away threshold", () => {
    const score = scoreSample(
      makeSample({ yaw: 55 }),
      DEFAULT_ATTENTION_SETTINGS,
      null,
    );
    expect(score.total).toBeLessThan(0.05);
  });

  it("keeps eye direction alone above the floor head orientation can reach", () => {
    const headOff = scoreSample(makeSample({ yaw: 40 }), DEFAULT_ATTENTION_SETTINGS, null);
    const eyesOff = scoreSample(
      makeSample({ gazeX: 1 }),
      DEFAULT_ATTENTION_SETTINGS,
      null,
    );

    expect(headOff.total).toBeLessThan(eyesOff.total);
  });

  it("never lets closed eyes alone drop the score to zero", () => {
    const score = scoreSample(
      makeSample({ eyeOpenness: 0 }),
      DEFAULT_ATTENTION_SETTINGS,
      null,
    );
    expect(score.total).toBeGreaterThan(DEFAULT_ATTENTION_SETTINGS.exitThreshold);
  });
});

describe("captureCalibration", () => {
  it("refuses to calibrate without enough detected frames", () => {
    expect(captureCalibration([])).toBeNull();
    expect(
      captureCalibration([makeSample(), makeSample({ faceDetected: false })]),
    ).toBeNull();
  });

  it("takes the median so a single bad frame cannot skew the neutral pose", () => {
    const samples = [
      makeSample({ yaw: 10 }),
      makeSample({ yaw: 11 }),
      makeSample({ yaw: 12 }),
      makeSample({ yaw: 11 }),
      makeSample({ yaw: 90 }), // a momentary detection glitch
    ];

    const calibration = captureCalibration(samples);
    expect(calibration?.yaw).toBe(11);
  });

  it("ignores frames with no face", () => {
    const samples = [
      makeSample({ yaw: 5 }),
      makeSample({ yaw: 5 }),
      makeSample({ yaw: 5 }),
      makeSample({ yaw: 80, faceDetected: false }),
    ];
    expect(captureCalibration(samples)?.yaw).toBe(5);
  });
});
