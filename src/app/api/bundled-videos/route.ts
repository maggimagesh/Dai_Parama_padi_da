import { readdir, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { NextResponse } from "next/server";

import type { BundledClipManifestEntry } from "@/lib/media/types";

/**
 * Enumerates the clips committed to `public/videos`, so dropping a file into
 * the repository is enough to make it available in the app — no upload step,
 * no database, no rebuild of a hard-coded list.
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

function titleize(fileName: string) {
  return fileName
    .replace(extname(fileName), "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export const dynamic = "force-dynamic";

export async function GET() {
  let entries: string[];

  try {
    entries = await readdir(VIDEO_DIR);
  } catch {
    // No directory yet is a normal state for a fresh clone, not an error.
    return NextResponse.json({ clips: [] satisfies BundledClipManifestEntry[] });
  }

  const clips: BundledClipManifestEntry[] = [];

  for (const entry of entries) {
    const extension = extname(entry).toLowerCase();
    const mimeType = MIME_BY_EXTENSION[extension];
    if (!mimeType) continue;

    try {
      const info = await stat(join(VIDEO_DIR, entry));
      if (!info.isFile()) continue;
      clips.push({
        name: titleize(entry),
        file: `/videos/${encodeURIComponent(entry)}`,
        sizeBytes: info.size,
        mimeType,
      });
    } catch {
      // A file that vanished between readdir and stat simply isn't listed.
    }
  }

  clips.sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ clips });
}
