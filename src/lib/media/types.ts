/** Where a clip's bytes live. Bundled clips ship with the repo; uploads are local-only. */
export type ClipOrigin = "bundled" | "upload";

/** One encode of a clip. A clip may offer several so the browser can choose. */
export interface ClipSourceFile {
  url: string;
  mimeType: string;
}

export interface Clip {
  id: string;
  name: string;
  source: ClipOrigin;
  /**
   * Every encode of this clip, in the order the browser should try them.
   * Grouping alternates under one entry is what lets a single library item
   * play in browsers that disagree about codecs.
   */
  sources: ClipSourceFile[];
  /** The preferred source's URL — for probing, posters, and anything needing one URL. */
  url: string;
  durationSeconds: number;
  sizeBytes: number;
  mimeType: string;
  /** Data-URL poster frame grabbed from the clip itself. */
  poster?: string;
  addedAt: number;
}

/** The IndexedDB row. Uploads keep their bytes here so they survive a reload. */
export interface StoredClip extends Omit<Clip, "url" | "sources"> {
  blob: Blob;
}

export interface BundledClipManifestEntry {
  id: string;
  name: string;
  sizeBytes: number;
  /** File mtime, used to order the library newest-first. */
  modifiedAt: number;
  sources: ClipSourceFile[];
}
