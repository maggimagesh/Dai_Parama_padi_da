import { readdir, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { NextResponse } from "next/server";

import type {
  BundledClipManifestEntry,
  ClipSourceFile,
} from "@/lib/media/types";

/**
 * Enumerates the clips committed to `public/videos`, so dropping a file into
 * the repository is enough to make it available in the app — no upload step,
 * no database, no rebuild of a hard-coded list.
 *
 * Files that share a basename are grouped into one clip with several sources
 * (`clip.mp4` + `clip.webm` → a single "Clip" entry), which lets one entry
 * cover browsers that disagree about codecs.
 */

const VIDEO_DIR = join(process.cwd(), "public", "videos");

const MIME_BY_EXTENSION: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
  ".ogv": "video/ogg",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
};

/**
 * Offered to the browser in this order. MP4 leads because it is the most
 * widely hardware-accelerated; WebM covers builds without H.264. The browser
 * picks the first source it can actually decode.
 */
const SOURCE_PRIORITY = [".mp4", ".m4v", ".webm", ".ogv", ".mov", ".mkv"];

function titleize(fileName: string) {
  return fileName
    .replace(extname(fileName), "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

interface Grouped {
  name: string;
  sources: (ClipSourceFile & { extension: string })[];
  sizeBytes: number;
  modifiedAt: number;
}

export const dynamic = "force-dynamic";

export async function GET() {
  let entries: string[];

  try {
    entries = await readdir(VIDEO_DIR);
  } catch {
    // No directory yet is a normal state for a fresh clone, not an error.
    return NextResponse.json({
      clips: [] satisfies BundledClipManifestEntry[],
    });
  }

  const groups = new Map<string, Grouped>();

  for (const entry of entries) {
    const extension = extname(entry).toLowerCase();
    const mimeType = MIME_BY_EXTENSION[extension];
    if (!mimeType) continue;

    try {
      const info = await stat(join(VIDEO_DIR, entry));
      if (!info.isFile()) continue;

      const key = basename(entry, extname(entry));
      const group = groups.get(key) ?? {
        name: titleize(entry),
        sources: [],
        sizeBytes: 0,
        modifiedAt: 0,
      };

      group.sources.push({
        url: `/videos/${encodeURIComponent(entry)}`,
        mimeType,
        extension,
      });
      // Report the size of the encode the browser is most likely to fetch,
      // not the sum of every alternate encode of the same footage.
      group.sizeBytes = Math.max(group.sizeBytes, info.size);
      group.modifiedAt = Math.max(group.modifiedAt, info.mtimeMs);

      groups.set(key, group);
    } catch {
      // A file that vanished between readdir and stat simply isn't listed.
    }
  }

  const clips: BundledClipManifestEntry[] = [...groups.entries()].map(
    ([id, group]) => ({
      id,
      name: group.name,
      sizeBytes: group.sizeBytes,
      modifiedAt: group.modifiedAt,
      sources: [...group.sources]
        .sort(
          (a, b) =>
            SOURCE_PRIORITY.indexOf(a.extension) -
            SOURCE_PRIORITY.indexOf(b.extension),
        )
        .map(({ url, mimeType }) => ({ url, mimeType })),
    }),
  );

  // Newest first, so the clip you just dropped in becomes the default
  // selection rather than whichever filename happens to sort first.
  clips.sort(
    (a, b) => b.modifiedAt - a.modifiedAt || a.name.localeCompare(b.name),
  );

  return NextResponse.json({ clips });
}
