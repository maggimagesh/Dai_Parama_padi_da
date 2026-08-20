"use client";

import * as React from "react";

import { useAttention } from "@/components/attention/attention-provider";
import { useSettingsStore } from "@/lib/store/settings-store";
import { cn } from "@/lib/utils";

const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
  400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
  54, 103, 67, 109,
];
const LEFT_EYE = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7];
const RIGHT_EYE = [362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382];
const IRIS_LEFT = [468, 469, 470, 471, 472];
const IRIS_RIGHT = [473, 474, 475, 476, 477];

/**
 * Paints the camera feed and, optionally, the landmark constellation the
 * tracker is actually reading.
 *
 * Multiple instances can render at once — each one paints from the single
 * shared `<video>` element owned by the attention provider, so the dashboard
 * preview and the in-player thumbnail never fight over the camera.
 */
export function CameraCanvas({
  className,
  overlay = true,
  quality = 1,
}: {
  className?: string;
  /** Draw the mesh on top of the feed. */
  overlay?: boolean;
  /** Render scale multiplier — lower it for small previews. */
  quality?: number;
}) {
  const { videoElement, resultRef } = useAttention();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const mirror = useSettingsStore((state) => state.preferences.mirrorPreview);
  const showLandmarks = useSettingsStore(
    (state) => state.preferences.showLandmarks,
  );

  const drawMesh = overlay && showLandmarks;

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !videoElement) return;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    let frame = 0;
    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2) * quality;
      width = Math.max(1, Math.round(rect.width * dpr));
      height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const render = () => {
      frame = requestAnimationFrame(render);
      if (!width || !height) return;

      context.clearRect(0, 0, width, height);

      const ready = videoElement.readyState >= 2 && videoElement.videoWidth > 0;
      if (!ready) return;

      context.save();
      if (mirror) {
        context.translate(width, 0);
        context.scale(-1, 1);
      }

      // Cover-fit the feed so the frame is always filled, never letterboxed.
      const videoAspect = videoElement.videoWidth / videoElement.videoHeight;
      const canvasAspect = width / height;
      let drawWidth = width;
      let drawHeight = height;
      let offsetX = 0;
      let offsetY = 0;
      if (videoAspect > canvasAspect) {
        drawWidth = height * videoAspect;
        offsetX = (width - drawWidth) / 2;
      } else {
        drawHeight = width / videoAspect;
        offsetY = (height - drawHeight) / 2;
      }

      context.drawImage(videoElement, offsetX, offsetY, drawWidth, drawHeight);

      const landmarks = drawMesh ? resultRef.current?.faceLandmarks?.[0] : null;
      if (landmarks?.length) {
        const toX = (x: number) => offsetX + x * drawWidth;
        const toY = (y: number) => offsetY + y * drawHeight;
        const scale = Math.min(width, height);

        // The full point cloud, faint — it reads as texture rather than clutter.
        context.fillStyle = "rgba(180, 240, 255, 0.28)";
        const dot = Math.max(0.6, scale * 0.0025);
        for (const point of landmarks) {
          context.beginPath();
          context.arc(toX(point.x), toY(point.y), dot, 0, Math.PI * 2);
          context.fill();
        }

        const stroke = (indices: number[], color: string, lineWidth: number) => {
          context.beginPath();
          indices.forEach((index, i) => {
            const point = landmarks[index];
            if (!point) return;
            const x = toX(point.x);
            const y = toY(point.y);
            if (i === 0) context.moveTo(x, y);
            else context.lineTo(x, y);
          });
          context.closePath();
          context.strokeStyle = color;
          context.lineWidth = lineWidth;
          context.stroke();
        };

        stroke(FACE_OVAL, "rgba(140, 226, 255, 0.55)", Math.max(1, scale * 0.0035));
        stroke(LEFT_EYE, "rgba(120, 255, 214, 0.9)", Math.max(1, scale * 0.003));
        stroke(RIGHT_EYE, "rgba(120, 255, 214, 0.9)", Math.max(1, scale * 0.003));

        context.fillStyle = "rgba(255, 255, 255, 0.95)";
        for (const index of [...IRIS_LEFT, ...IRIS_RIGHT]) {
          const point = landmarks[index];
          if (!point) continue;
          context.beginPath();
          context.arc(toX(point.x), toY(point.y), dot * 1.6, 0, Math.PI * 2);
          context.fill();
        }
      }

      context.restore();
    };

    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [videoElement, resultRef, mirror, drawMesh, quality]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn("size-full object-cover", className)}
    />
  );
}
