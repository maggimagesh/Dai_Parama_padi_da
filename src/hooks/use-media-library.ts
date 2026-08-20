"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  deleteStoredClip,
  listStoredClips,
  saveStoredClip,
} from "@/lib/media/clip-store";
import { probeVideo } from "@/lib/media/thumbnail";
import type {
  BundledClipManifestEntry,
  Clip,
  StoredClip,
} from "@/lib/media/types";
import { useSessionStore } from "@/lib/store/session-store";
import { useSettingsStore } from "@/lib/store/settings-store";
import { createId } from "@/lib/utils";

const ACCEPTED = /^video\//;
const MAX_UPLOAD_BYTES = 750 * 1024 * 1024;

function toClip(stored: StoredClip, url: string): Clip {
  return {
    id: stored.id,
    name: stored.name,
    source: stored.source,
    // An upload has exactly one encode: the file the user handed us.
    sources: [{ url, mimeType: stored.mimeType }],
    url,
    durationSeconds: stored.durationSeconds,
    sizeBytes: stored.sizeBytes,
    mimeType: stored.mimeType,
    poster: stored.poster,
    addedAt: stored.addedAt,
  };
}

/**
 * Assembles the library from two sources that behave differently on purpose:
 * clips committed to `public/videos` (shared with the repo) and clips uploaded
 * in the browser (kept in IndexedDB, never sent anywhere).
 */
export function useMediaLibrary() {
  const setClips = useSessionStore((state) => state.setClips);
  const setLibraryStatus = useSessionStore((state) => state.setLibraryStatus);
  const clips = useSessionStore((state) => state.clips);
  const activeClipId = useSettingsStore((state) => state.activeClipId);
  const setActiveClipId = useSettingsStore((state) => state.setActiveClipId);

  const [busy, setBusy] = React.useState(false);
  const objectUrlsRef = React.useRef(new Set<string>());

  const trackUrl = React.useCallback((url: string) => {
    objectUrlsRef.current.add(url);
    return url;
  }, []);

  const load = React.useCallback(async () => {
    setLibraryStatus("loading");
    try {
      const [bundled, stored] = await Promise.all([
        fetch("/api/bundled-videos")
          .then((response) =>
            response.ok
              ? (response.json() as Promise<{
                  clips: BundledClipManifestEntry[];
                }>)
              : { clips: [] },
          )
          .catch(() => ({ clips: [] as BundledClipManifestEntry[] })),
        listStoredClips().catch(() => [] as StoredClip[]),
      ]);

      const bundledClips: Clip[] = bundled.clips
        .filter((entry) => entry.sources.length > 0)
        .map((entry) => ({
          id: `bundled:${entry.id}`,
          name: entry.name,
          source: "bundled",
          sources: entry.sources,
          url: entry.sources[0].url,
          // Duration is filled in lazily by the card once the browser reads
          // it; blocking the library on metadata for every file is slower.
          durationSeconds: 0,
          sizeBytes: entry.sizeBytes,
          mimeType: entry.sources[0].mimeType,
          addedAt: entry.modifiedAt,
        }));

      const uploaded = stored.map((item) =>
        toClip(item, trackUrl(URL.createObjectURL(item.blob))),
      );

      // One timeline across both sources: the most recently added clip leads,
      // which is the one the default selection falls back to.
      setClips(
        [...uploaded, ...bundledClips].sort((a, b) => b.addedAt - a.addedAt),
      );
      setLibraryStatus("ready");
    } catch (error) {
      setLibraryStatus(
        "error",
        error instanceof Error
          ? error.message
          : "The library could not be read.",
      );
    }
  }, [setClips, setLibraryStatus, trackUrl]);

  React.useEffect(() => {
    void load();
    const urls = objectUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, [load]);

  // Keep a valid selection at all times: fall back to the first clip whenever
  // the chosen one disappears.
  React.useEffect(() => {
    if (clips.length === 0) return;
    if (!activeClipId || !clips.some((clip) => clip.id === activeClipId)) {
      setActiveClipId(clips[0].id);
    }
  }, [clips, activeClipId, setActiveClipId]);

  const addFiles = React.useCallback(
    async (files: FileList | File[]) => {
      const candidates = Array.from(files).filter((file) =>
        ACCEPTED.test(file.type),
      );
      const rejected = Array.from(files).length - candidates.length;
      if (rejected > 0) {
        toast.error(
          `${rejected} file${rejected > 1 ? "s were" : " was"} not a video`,
        );
      }
      if (candidates.length === 0) return;

      setBusy(true);
      let added = 0;

      for (const file of candidates) {
        if (file.size > MAX_UPLOAD_BYTES) {
          toast.error(`"${file.name}" is too large`, {
            description:
              "Files above 750 MB are better committed to public/videos than stored in the browser.",
          });
          continue;
        }

        try {
          const probe = await probeVideo(file);
          const stored: StoredClip = {
            id: createId("clip"),
            name: file.name.replace(/\.[^.]+$/, ""),
            source: "upload",
            durationSeconds: probe.durationSeconds,
            sizeBytes: file.size,
            mimeType: file.type,
            poster: probe.poster,
            addedAt: Date.now(),
            blob: file,
          };
          await saveStoredClip(stored);
          added += 1;
        } catch (error) {
          toast.error(`"${file.name}" could not be added`, {
            description:
              error instanceof Error
                ? error.message
                : "Unsupported video file.",
          });
        }
      }

      setBusy(false);
      if (added > 0) {
        await load();
        toast.success(
          `${added} clip${added > 1 ? "s" : ""} added to the library`,
        );
      }
    },
    [load],
  );

  const removeClip = React.useCallback(
    async (clip: Clip) => {
      if (clip.source === "bundled") {
        toast.info("Bundled clips live in the repository", {
          description: `Delete it from public/videos to remove "${clip.name}".`,
        });
        return;
      }
      await deleteStoredClip(clip.id);
      URL.revokeObjectURL(clip.url);
      objectUrlsRef.current.delete(clip.url);
      await load();
      toast.success(`Removed "${clip.name}"`);
    },
    [load],
  );

  return { clips, busy, addFiles, removeClip, reload: load };
}
