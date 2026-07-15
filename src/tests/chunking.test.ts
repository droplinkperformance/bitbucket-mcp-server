import { describe, it, expect } from 'vitest';
import { PullRequestChunkingService } from '../services/chunking/PullRequestChunkingService.js';
import type { PullRequestFileChange } from '../domain/pull-request/types.js';

function diffFor(path: string, lines: number): string {
  const body = Array.from({ length: lines }, (_, i) => `+line ${i}`).join('\n');
  return `diff --git a/${path} b/${path}\n${body}`;
}

describe('PullRequestChunkingService', () => {
  it('parses a unified diff into per-file segments', () => {
    const service = new PullRequestChunkingService({ maxFilesPerChunk: 50, maxDiffLinesPerChunk: 5000 });
    const diff = `${diffFor('a.ts', 2)}\n${diffFor('b.ts', 3)}`;
    const segments = service.parseDiffByFile(diff);
    expect(segments.map((s) => s.path)).toEqual(['a.ts', 'b.ts']);
  });

  it('keeps a small PR in a single chunk', () => {
    const service = new PullRequestChunkingService({ maxFilesPerChunk: 50, maxDiffLinesPerChunk: 5000 });
    const files: PullRequestFileChange[] = [{ path: 'a.ts', status: 'modified' }];
    const chunks = service.chunk({ diff: diffFor('a.ts', 5), files });
    expect(chunks).toHaveLength(1);
  });

  it('splits by file count', () => {
    const service = new PullRequestChunkingService({ maxFilesPerChunk: 2, maxDiffLinesPerChunk: 100000 });
    const paths = ['a', 'b', 'c', 'd', 'e'];
    const diff = paths.map((p) => diffFor(`${p}.ts`, 2)).join('\n');
    const files = paths.map((p) => ({ path: `${p}.ts`, status: 'modified' as const }));
    const chunks = service.chunk({ diff, files });
    expect(chunks.length).toBe(3); // 2 + 2 + 1
    expect(chunks.every((c) => c.files.length <= 2)).toBe(true);
  });

  it('splits by diff line budget', () => {
    const service = new PullRequestChunkingService({ maxFilesPerChunk: 50, maxDiffLinesPerChunk: 10 });
    const diff = `${diffFor('a.ts', 6)}\n${diffFor('b.ts', 6)}`;
    const files = [
      { path: 'a.ts', status: 'modified' as const },
      { path: 'b.ts', status: 'modified' as const },
    ];
    const chunks = service.chunk({ diff, files });
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('splits a single oversized file across multiple chunks', () => {
    const service = new PullRequestChunkingService({ maxFilesPerChunk: 50, maxDiffLinesPerChunk: 10 });
    const chunks = service.chunk({
      diff: diffFor('big.ts', 35),
      files: [{ path: 'big.ts', status: 'modified' }],
    });
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('reports when chunking is needed', () => {
    const service = new PullRequestChunkingService({ maxFilesPerChunk: 1, maxDiffLinesPerChunk: 5 });
    expect(
      service.needsChunking({
        diff: diffFor('a.ts', 100),
        files: [{ path: 'a.ts', status: 'modified' }],
      }),
    ).toBe(true);
  });
});
