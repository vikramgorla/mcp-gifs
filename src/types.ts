export type SourceName = 'wikimedia-commons' | 'openverse';
export type Safety = 'safe' | 'moderate';
export type SourceParam = 'auto' | 'wikimedia' | 'openverse';

export interface Gif {
  /** Stable id usable with get_gif, e.g. `wikimedia:File:Foo.gif` or `openverse:<uuid>`. */
  id: string;
  title: string;
  /** Direct URL of the original GIF file. */
  url: string;
  /** Smaller preview/thumbnail URL (may be the original when the file is small). */
  previewUrl: string;
  width: number;
  height: number;
  fileSizeBytes: number | null;
  /** true = verified animated (frameCount > 1); null = unknown (source does not expose it). */
  animated: boolean | null;
  frameCount: number | null;
  source: SourceName;
  /** Human landing page (file description page). */
  pageUrl: string;
  author: string | null;
  authorUrl: string | null;
  license: string;
  licenseUrl: string | null;
  attributionRequired: boolean;
  /** Ready-to-paste attribution line. */
  attribution: string;
  description: string | null;
}

export interface SearchParams {
  query: string;
  limit: number;
  safety: Safety;
  source: SourceParam;
  /** Skip files larger than this (bytes). Files with unknown size are kept. */
  maxBytes?: number;
}

export interface SearchResult {
  query: string;
  safety: Safety;
  count: number;
  results: Gif[];
  sourcesQueried: SourceName[];
  notes: string[];
}

/** Subset of the Cache API we use; lets Node fall back to an in-memory map. */
export interface ResultCache {
  get(key: string): Promise<unknown | undefined>;
  put(key: string, value: unknown, ttlSeconds: number): Promise<void>;
}
