export type SourceName = 'wikimedia-commons' | 'openverse' | 'klipy';
export type Safety = 'safe' | 'moderate';
export type SourceParam = 'auto' | 'wikimedia' | 'openverse' | 'klipy';

export interface Gif {
  /** Stable id usable with get_gif, e.g. `wikimedia:File:Foo.gif` or `openverse:<uuid>`. */
  id: string;
  title: string;
  /** Direct URL of the original GIF file. */
  url: string;
  /** Smaller preview/thumbnail URL (a Commons thumb, not the original, whenever one can be built). */
  previewUrl: string;
  /** Same clip as MP4 (smaller; what chat apps actually send). KLIPY only. */
  mp4Url?: string | null;
  /** Same clip as animated WebP. KLIPY only. */
  webpUrl?: string | null;
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
  /** Ready-to-paste attribution line (title, credit and link: for showing next to the GIF in a UI). */
  attribution: string;
  /**
   * schema.org `creditText` (IPTC "Credit Line"): the credit this GIF needs, without its title or link. The same for
   * every result of a provider whose terms ask for a platform credit ("Powered by KLIPY"); the work's own credit
   * (author and license) for openly licensed files that require attribution; '' when none is required.
   */
  creditText: string;
  description: string | null;
}

export interface SearchParams {
  query: string;
  limit: number;
  safety: Safety;
  source: SourceParam;
  /** Skip files larger than this (bytes). Files with unknown size are kept. */
  maxBytes?: number;
  /** KLIPY locale, e.g. en_US. Ignored by other sources. */
  locale?: string;
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
