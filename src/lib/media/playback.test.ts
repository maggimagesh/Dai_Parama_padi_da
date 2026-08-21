import { describe, expect, it } from "vitest";

import { resolveInitialMuted, resolveStartPosition } from "./playback";

describe("resolveStartPosition", () => {
  it("replays from the top under the default restart policy", () => {
    // The reported bug: a second look-away picked up mid-clip.
    expect(
      resolveStartPosition({
        policy: "restart",
        savedSeconds: 4.2,
        durationSeconds: 7.6,
      }),
    ).toBe(0);
  });

  it("ignores a saved position even when it is otherwise valid", () => {
    for (const savedSeconds of [0.1, 1, 3.5, 7]) {
      expect(
        resolveStartPosition({
          policy: "restart",
          savedSeconds,
          durationSeconds: 7.6,
        }),
      ).toBe(0);
    }
  });

  it("honours a saved position when resume is opted into", () => {
    expect(
      resolveStartPosition({
        policy: "resume",
        savedSeconds: 4.2,
        durationSeconds: 7.6,
      }),
    ).toBe(4.2);
  });

  it("starts over when the saved position is at or past the end", () => {
    // Otherwise the clip sits frozen on its final frame.
    expect(
      resolveStartPosition({
        policy: "resume",
        savedSeconds: 7.5,
        durationSeconds: 7.6,
      }),
    ).toBe(0);
    expect(
      resolveStartPosition({
        policy: "resume",
        savedSeconds: 99,
        durationSeconds: 7.6,
      }),
    ).toBe(0);
  });

  it("survives a duration the browser has not reported yet", () => {
    // `video.duration` is NaN until metadata loads.
    expect(
      resolveStartPosition({
        policy: "resume",
        savedSeconds: 3,
        durationSeconds: Number.NaN,
      }),
    ).toBe(3);
  });

  it("rejects nonsense saved positions rather than seeking to them", () => {
    for (const savedSeconds of [Number.NaN, -1, Number.POSITIVE_INFINITY]) {
      expect(
        resolveStartPosition({
          policy: "resume",
          savedSeconds,
          durationSeconds: 7.6,
        }),
      ).toBe(0);
    }
  });
});

describe("resolveInitialMuted", () => {
  it("follows the preference in both directions", () => {
    expect(resolveInitialMuted(false)).toBe(false);
    expect(resolveInitialMuted(true)).toBe(true);
  });

  it("depends on nothing but the preference", () => {
    // The reported bug: one autoplay-blocked start left the player muted for
    // every later trigger. Nothing about a prior session may reach this.
    expect(resolveInitialMuted(false)).toBe(false);
    expect(resolveInitialMuted(false)).toBe(false);
    expect(resolveInitialMuted(false)).toBe(false);
  });
});
