import type { PullRequestFileChange } from '../../domain/pull-request/types.js';

export interface ChunkingThresholds {
  maxFilesPerChunk: number;
  maxDiffLinesPerChunk: number;
}

export interface DiffFileSegment {
  path: string;
  diff: string;
  lineCount: number;
}

export interface PullRequestChunk {
  index: number;
  files: PullRequestFileChange[];
  diff: string;
  lineCount: number;
}

export interface ChunkInput {
  diff: string;
  files: PullRequestFileChange[];
}

const DIFF_HEADER = /^diff --git a\/(.+?) b\/(.+?)\s*$/;

/**
 * Splits very large pull requests into bounded analysis batches so review
 * agents never assume the whole PR fits in the LLM context window. Per-batch
 * results are merged downstream (see mergeReviewResults).
 */
export class PullRequestChunkingService {
  constructor(private readonly thresholds: ChunkingThresholds) {}

  needsChunking(input: ChunkInput): boolean {
    const lineCount = input.diff ? input.diff.split('\n').length : 0;
    return (
      input.files.length > this.thresholds.maxFilesPerChunk ||
      lineCount > this.thresholds.maxDiffLinesPerChunk
    );
  }

  /** Parse a unified diff into one segment per file. */
  parseDiffByFile(diff: string): DiffFileSegment[] {
    if (!diff || !diff.trim()) {
      return [];
    }
    const lines = diff.split('\n');
    const segments: DiffFileSegment[] = [];
    let currentPath: string | null = null;
    let buffer: string[] = [];

    const flush = () => {
      if (currentPath !== null) {
        const body = buffer.join('\n');
        segments.push({ path: currentPath, diff: body, lineCount: buffer.length });
      }
      buffer = [];
    };

    for (const line of lines) {
      const header = line.match(DIFF_HEADER);
      if (header) {
        flush();
        currentPath = header[2] ?? header[1] ?? 'unknown';
      }
      buffer.push(line);
    }
    flush();
    return segments;
  }

  chunk(input: ChunkInput): PullRequestChunk[] {
    const { maxFilesPerChunk, maxDiffLinesPerChunk } = this.thresholds;
    const segments = this.parseDiffByFile(input.diff);
    const fileByPath = new Map(input.files.map((file) => [file.path, file]));
    const chunks: PullRequestChunk[] = [];

    let currentFiles: PullRequestFileChange[] = [];
    let currentDiff: string[] = [];
    let currentLines = 0;

    const pushChunk = () => {
      if (currentFiles.length === 0 && currentDiff.length === 0) {
        return;
      }
      chunks.push({
        index: chunks.length,
        files: currentFiles,
        diff: currentDiff.join('\n'),
        lineCount: currentLines,
      });
      currentFiles = [];
      currentDiff = [];
      currentLines = 0;
    };

    const fileMetaFor = (path: string): PullRequestFileChange => {
      const existing = fileByPath.get(path);
      fileByPath.delete(path);
      return existing ?? { path, status: 'unknown' };
    };

    for (const segment of segments) {
      if (segment.lineCount > maxDiffLinesPerChunk) {
        // A single oversized file: flush, then split it across line batches.
        pushChunk();
        for (const part of this.splitLines(segment.diff, maxDiffLinesPerChunk)) {
          chunks.push({
            index: chunks.length,
            files: [fileMetaFor(segment.path)],
            diff: part.text,
            lineCount: part.lineCount,
          });
        }
        continue;
      }

      const wouldExceed =
        currentFiles.length >= maxFilesPerChunk ||
        currentLines + segment.lineCount > maxDiffLinesPerChunk;
      if (wouldExceed) {
        pushChunk();
      }
      currentFiles.push(fileMetaFor(segment.path));
      currentDiff.push(segment.diff);
      currentLines += segment.lineCount;
    }
    pushChunk();

    // Any files without a diff segment (e.g. binary/renames) still get reviewed.
    const leftover = [...fileByPath.values()];
    for (let i = 0; i < leftover.length; i += maxFilesPerChunk) {
      chunks.push({
        index: chunks.length,
        files: leftover.slice(i, i + maxFilesPerChunk),
        diff: '',
        lineCount: 0,
      });
    }

    if (chunks.length === 0) {
      chunks.push({ index: 0, files: input.files, diff: input.diff, lineCount: 0 });
    }
    return chunks;
  }

  private splitLines(diff: string, maxLines: number): Array<{ text: string; lineCount: number }> {
    const lines = diff.split('\n');
    const parts: Array<{ text: string; lineCount: number }> = [];
    for (let i = 0; i < lines.length; i += maxLines) {
      const slice = lines.slice(i, i + maxLines);
      parts.push({ text: slice.join('\n'), lineCount: slice.length });
    }
    return parts;
  }
}
