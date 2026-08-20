"use client";

import * as React from "react";
import { AnimatePresence } from "motion/react";
import { FolderOpen, Loader2, Upload } from "lucide-react";

import { ClipCard } from "@/components/library/clip-card";
import { usePlayback } from "@/components/player/playback-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionLabel } from "@/components/ui/card";
import { useMediaLibrary } from "@/hooks/use-media-library";
import { useSettingsStore } from "@/lib/store/settings-store";
import { cn } from "@/lib/utils";

export function LibraryPanel() {
  const { clips, busy, addFiles, removeClip } = useMediaLibrary();
  const activeClipId = useSettingsStore((state) => state.activeClipId);
  const setActiveClipId = useSettingsStore((state) => state.setActiveClipId);
  const { playManually } = usePlayback();

  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  // Nested dragenter/dragleave pairs fire constantly; counting them is the
  // only reliable way to know when the pointer has truly left the zone.
  const dragDepth = React.useRef(0);

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (event.dataTransfer.files.length) void addFiles(event.dataTransfer.files);
  };

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-4 px-6 pt-6">
        <div>
          <SectionLabel>Library</SectionLabel>
          <h2 className="mt-2 text-base font-semibold tracking-tight">
            What plays when you look away
          </h2>
        </div>
        <Badge>{clips.length} clip{clips.length === 1 ? "" : "s"}</Badge>
      </div>

      <div className="px-6 pt-4">
        <div
          onDragEnter={(event) => {
            event.preventDefault();
            dragDepth.current += 1;
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            event.preventDefault();
            dragDepth.current = Math.max(0, dragDepth.current - 1);
            if (dragDepth.current === 0) setDragging(false);
          }}
          onDrop={handleDrop}
          className={cn(
            "relative overflow-hidden rounded-2xl border border-dashed px-5 py-6 text-center transition-colors duration-300",
            dragging
              ? "border-signal/60 bg-signal/[0.08]"
              : "border-white/12 bg-white/[0.02]",
          )}
        >
          {dragging && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 animate-(--animate-sheen) bg-linear-to-r from-transparent via-white/10 to-transparent"
            />
          )}

          <div className="relative flex flex-col items-center gap-2">
            <span className="grid size-9 place-items-center rounded-full border border-hairline bg-white/[0.05]">
              {busy ? (
                <Loader2 className="size-4 animate-spin text-signal" />
              ) : (
                <Upload className="size-4 text-ink-muted" />
              )}
            </span>
            <p className="text-[0.8125rem] font-medium text-ink">
              {busy ? "Reading your clips…" : "Drop video files here"}
            </p>
            <p className="text-balance-pretty max-w-xs text-[0.6875rem] leading-relaxed text-ink-faint">
              Uploads stay in this browser. To share a clip with the repo, commit
              it to{" "}
              <code className="rounded bg-white/8 px-1 py-0.5 font-mono text-[0.625rem]">
                public/videos
              </code>{" "}
              and it appears here automatically.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-1"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              <FolderOpen />
              Choose files
            </Button>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            multiple
            className="sr-only"
            onChange={(event) => {
              if (event.target.files?.length) void addFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </div>
      </div>

      <div className="px-6 pb-6 pt-4">
        {clips.length === 0 ? (
          <p className="rounded-2xl border border-hairline bg-white/[0.02] px-4 py-6 text-center text-xs leading-relaxed text-ink-faint">
            No clips yet. Add one above — until then, the triggers have nothing
            to play.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {clips.map((clip) => (
                <ClipCard
                  key={clip.id}
                  clip={clip}
                  selected={clip.id === activeClipId}
                  onSelect={() => setActiveClipId(clip.id)}
                  onPreview={() => playManually(clip.id)}
                  onRemove={() => void removeClip(clip)}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </Card>
  );
}
