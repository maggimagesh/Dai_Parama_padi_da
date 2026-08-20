import { describe, expect, it } from "vitest";

import { clamp, falloff, formatDuration, mapRange, smoothTowards } from "@/lib/utils";

describe("smoothTowards", () => {
  it("is frame-rate independent over the same elapsed time", () => {
    const tau = 200;

    let coarse = 0;
    coarse = smoothTowards(coarse, 1, 100, tau);
    coarse = smoothTowards(coarse, 1, 100, tau);

    let fine = 0;
    for (let i = 0; i < 20; i++) fine = smoothTowards(fine, 1, 10, tau);

    expect(fine).toBeCloseTo(coarse, 5);
  });

  it("snaps to the target when the time constant is zero", () => {
    expect(smoothTowards(0, 1, 16, 0)).toBe(1);
  });
});

describe("falloff", () => {
  it("peaks at no deviation and decays monotonically", () => {
    expect(falloff(0, 20)).toBe(1);
    expect(falloff(10, 20)).toBeGreaterThan(falloff(20, 20));
    expect(falloff(60, 20)).toBeLessThan(0.01);
  });
});

describe("mapRange", () => {
  it("clamps to the output range", () => {
    expect(mapRange(-5, 0, 10, 0, 1)).toBe(0);
    expect(mapRange(50, 0, 10, 0, 1)).toBe(1);
    expect(mapRange(5, 0, 10, 0, 1)).toBe(0.5);
  });

  it("degrades gracefully on an empty input range", () => {
    expect(mapRange(3, 2, 2, 7, 9)).toBe(7);
  });
});

describe("formatDuration", () => {
  it("formats minutes and hours", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(75)).toBe("1:15");
    expect(formatDuration(3725)).toBe("1:02:05");
  });

  it("returns a placeholder for unknown durations", () => {
    expect(formatDuration(Number.NaN)).toBe("--:--");
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe("--:--");
  });
});

describe("clamp", () => {
  it("bounds to the given range", () => {
    expect(clamp(1.4)).toBe(1);
    expect(clamp(-2, -1, 1)).toBe(-1);
  });
});
