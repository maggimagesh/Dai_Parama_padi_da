import { describe, expect, it } from "vitest";
import { cameraCrop, clampCameraZoom, isPhoneCamera } from "./camera";

describe("phone camera detection", () => {
  it.each([
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1", true],
    ["Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 Chrome/128.0.0.0 Mobile Safari/537.36", true],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36", false],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15", false],
    ["Mozilla/5.0 (Linux; Android 14; Tablet) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36", false],
    ["Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1", false],
  ])("classifies %s", (ua, expected) => {
    expect(isPhoneCamera(ua)).toBe(expected);
  });

  it("accepts mobile client hints without requiring UA parsing", () => {
    expect(isPhoneCamera("reduced UA", true)).toBe(true);
    expect(isPhoneCamera("reduced UA", false)).toBe(false);
    expect(isPhoneCamera("iPhone", false)).toBe(true);
  });
});

describe("camera zoom framing", () => {
  it("clamps bounds and rounds repeated increments without floating-point drift", () => {
    expect(clampCameraZoom(0)).toBe(1);
    expect(clampCameraZoom(99)).toBe(3);
    expect(clampCameraZoom(NaN)).toBe(1);
    expect(clampCameraZoom(Infinity)).toBe(1);
    let value = 1;
    for (let i = 0; i < 10; i++) value = clampCameraZoom(value + 0.1);
    expect(value).toBe(2);
    for (let i = 0; i < 10; i++) value = clampCameraZoom(value - 0.1);
    expect(value).toBe(1);
  });

  it.each([[1920, 1080], [1080, 1920], [1280, 1280]])("matches centered preview crop for %i × %i", (width, height) => {
    for (const zoom of [1, 1.5, 2, 3]) {
      const crop = cameraCrop(width, height, zoom);
      expect(crop.side).toBe(Math.min(width, height) / zoom);
      expect(crop.x + crop.side / 2).toBe(width / 2);
      expect(crop.y + crop.side / 2).toBe(height / 2);
      expect(crop.x).toBeGreaterThanOrEqual(0);
      expect(crop.y).toBeGreaterThanOrEqual(0);
      expect(crop.x + crop.side).toBeLessThanOrEqual(width);
      expect(crop.y + crop.side).toBeLessThanOrEqual(height);
    }
  });
});
