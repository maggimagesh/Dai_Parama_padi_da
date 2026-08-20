/** Where a clip's bytes live. Bundled clips ship with the repo; uploads are local-only. */
export type ClipSource = "bundled" | "upload";

export interface Clip {
  id: string;
  name: string;
  source: ClipSource;
  /** Playable URL — a public path for bundled clips, an object URL for uploads. */
  url: string;
  durationSeconds: number;
  sizeBytes: number;
  mimeType: string;
  /** Data-URL poster frame grabbed from the clip itself. */
  poster?: string;
  addedAt: number;
}

/** The IndexedDB row. Uploads keep their bytes here so they survive a reload. */
export interface StoredClip extends Omit<Clip, "url"> {
  blob: Blob;
}

export interface BundledClipManifestEntry {
  name: string;
  file: string;
  sizeBytes: number;
  mimeType: string;
}
