/**
 * Reads a clip's duration and grabs a representative frame for its card.
 *
 * Seeking a few seconds in avoids the black frame most encoders start with;
 * for very short clips we take the midpoint instead.
 */
export interface ClipProbe {
  durationSeconds: number;
  poster?: string;
  width: number;
  height: number;
}

const POSTER_WIDTH = 480;
const PROBE_TIMEOUT_MS = 12_000;

export function probeVideo(source: Blob | string): Promise<ClipProbe> {
  return new Promise((resolve, reject) => {
    const objectUrl = typeof source === "string" ? null : URL.createObjectURL(source);
    const url = objectUrl ?? (source as string);

    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";

    let settled = false;

    const cleanup = () => {
      clearTimeout(timeout);
      video.removeAttribute("src");
      video.load();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };

    const finish = (probe: ClipProbe) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(probe);
    };

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    };

    const timeout = setTimeout(
      () => fail("Timed out while reading the video."),
      PROBE_TIMEOUT_MS,
    );

    video.onerror = () => fail("This file could not be decoded as video.");

    video.onloadedmetadata = () => {
      const durationSeconds = Number.isFinite(video.duration) ? video.duration : 0;
      const width = video.videoWidth;
      const height = video.videoHeight;

      const seekTo = durationSeconds > 6 ? 3 : durationSeconds / 2;

      video.onseeked = () => {
        try {
          const canvas = document.createElement("canvas");
          const scale = width ? Math.min(1, POSTER_WIDTH / width) : 1;
          canvas.width = Math.max(1, Math.round(width * scale));
          canvas.height = Math.max(1, Math.round(height * scale));

          const context = canvas.getContext("2d");
          if (!context) {
            finish({ durationSeconds, width, height });
            return;
          }
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          finish({
            durationSeconds,
            width,
            height,
            poster: canvas.toDataURL("image/jpeg", 0.72),
          });
        } catch {
          // Tainted canvas (cross-origin clip) — the card falls back to a
          // gradient placeholder, which is a fine outcome.
          finish({ durationSeconds, width, height });
        }
      };

      try {
        video.currentTime = seekTo;
      } catch {
        finish({ durationSeconds, width, height });
      }
    };

    video.src = url;
  });
}
