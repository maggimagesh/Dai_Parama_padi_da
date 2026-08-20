"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Check, Film, HardDrive, Play, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import type { Clip } from "@/lib/media/types";
import { cn, formatBytes, formatDuration } from "@/lib/utils";

/**
 * Bundled clips arrive without a duration — reading metadata for every file on
 * the server would make the library slow to open. Each card fills its own in
 * once it is on screen, which costs a metadata-only request per visible clip.
 */
function useLazyDuration(clip: Clip) {
  const [probed, setProbed] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (clip.durationSeconds > 0) return;

    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = clip.url;

    const onLoaded = () => {
      if (Number.isFinite(video.duration)) setProbed(video.duration);
    };
    video.addEventListener("loadedmetadata", onLoaded);

    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeAttribute("src");
      video.load();
    };
  }, [clip.url, clip.durationSeconds]);

  return clip.durationSeconds > 0 ? clip.durationSeconds : (probed ?? 0);
}

export function ClipCard({
  clip,
  selected,
  onSelect,
  onPreview,
  onRemove,
}: {
  clip: Clip;
  selected: boolean;
  onSelect: () => void;
  onPreview: () => void;
  onRemove: () => void;
}) {
  const duration = useLazyDuration(clip);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-white/[0.02] transition-colors duration-300",
        selected
          ? "border-signal/45 bg-signal/[0.06]"
          : "border-hairline hover:border-white/20",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex w-full items-center gap-3 p-2.5 text-left"
      >
        <span className="relative grid aspect-video w-24 shrink-0 place-items-center overflow-hidden rounded-xl bg-canvas-deep">
          {clip.poster ? (
            // Posters are locally generated data URLs; next/image adds nothing here.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={clip.poster}
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="absolute inset-0 bg-linear-135 from-signal-deep/35 via-canvas to-idle/25"
            />
          )}
          <Film className="relative size-4 text-white/45" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[0.8125rem] font-medium text-ink">
              {clip.name}
            </span>
            {selected && (
              <Check className="size-3.5 shrink-0 text-signal" aria-hidden />
            )}
          </span>
          <span className="mt-1 flex items-center gap-2 text-[0.6875rem] text-ink-faint">
            <span className="tabular">{formatDuration(duration)}</span>
            <span aria-hidden>·</span>
            <span className="tabular">{formatBytes(clip.sizeBytes)}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              {clip.source === "bundled" ? (
                <>
                  <HardDrive className="size-3" />
                  in repo
                </>
              ) : (
                "local"
              )}
            </span>
          </span>
        </span>
      </button>

      <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
        <Hint label="Preview this clip now">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onPreview}
            aria-label={`Preview ${clip.name}`}
          >
            <Play />
          </Button>
        </Hint>
        <Hint
          label={
            clip.source === "bundled"
              ? "Bundled clips are removed by deleting the file from public/videos"
              : "Remove from this browser"
          }
        >
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            aria-label={`Remove ${clip.name}`}
            className="hover:text-away"
          >
            <Trash2 />
          </Button>
        </Hint>
      </div>
    </motion.li>
  );
}
