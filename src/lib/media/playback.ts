import type { ResumePolicy } from "@/lib/store/settings-store";

/**
 * Where a triggered clip should begin.
 *
 * Kept as a pure function so the rule is testable on its own: the player has
 * to consult it from a media event handler, which is awkward to exercise, and
 * getting this wrong is silent — the clip just quietly starts in the wrong
 * place.
 */
export function resolveStartPosition({
  policy,
  savedSeconds,
  durationSeconds,
}: {
  policy: ResumePolicy;
  savedSeconds: number;
  durationSeconds: number;
}): number {
  if (policy === "restart") return 0;

  // Guard against a saved position that no longer makes sense: a NaN or
  // negative value, or one past the end of a clip that has since changed.
  if (!Number.isFinite(savedSeconds) || savedSeconds <= 0) return 0;

  const duration = Number.isFinite(durationSeconds)
    ? durationSeconds
    : Infinity;

  // A clip that ran to its end should start over rather than sit frozen on the
  // final frame.
  return savedSeconds < duration - 0.5 ? savedSeconds : 0;
}

/**
 * Whether a playback session should begin muted.
 *
 * This reads only from preferences on purpose. An earlier session that was
 * forced to mute itself to satisfy an autoplay policy must not leak that
 * decision into the next one.
 */
export function resolveInitialMuted(preferenceMuted: boolean): boolean {
  return preferenceMuted;
}
