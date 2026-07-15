import type { Agent } from './agent.contract.js';
import type { BitbucketContext } from '../shared/context.js';
import type { PullRequestRepository } from '../domain/contracts/pull-request.repository.js';
import type { LlmProvider } from '../llm/LlmProvider.js';
import type { EventBus } from '../events/EventBus.js';
import type { Logger } from '../infrastructure/logger/pino.js';
import {
  PullRequestChunkingService,
  type PullRequestChunk,
} from '../services/chunking/PullRequestChunkingService.js';
import {
  mergeReviewResults,
  parseReviewResult,
  type ReviewResult,
} from '../domain/review/ReviewResult.js';
import { reviewCompletedEvent } from '../events/DomainEvent.js';
import type {
  Commit,
  PullRequest,
  PullRequestComment,
  PullRequestFileChange,
} from '../domain/pull-request/types.js';

export interface CodeReviewAgentInput {
  context: BitbucketContext;
  pullRequestId: number;
  /** Extra reviewer guidance appended to the system prompt. */
  guidelines?: string;
}

export type CodeReviewAgentOutput = ReviewResult;

export interface CodeReviewAgentDeps {
  pullRequests: PullRequestRepository;
  llm: LlmProvider;
  chunking: PullRequestChunkingService;
  eventBus: EventBus;
  logger?: Logger;
}

const SYSTEM_PROMPT = `You are a Staff Software Engineer performing a rigorous, pragmatic pull request review.
Analyze the provided pull request and respond with a SINGLE JSON object only (no prose, no markdown fences) with exactly these keys:
{
  "summary": string,                 // concise executive summary
  "architectureImpact": string[],    // architectural impact / design concerns
  "risks": string[],                 // notable risks
  "bugs": string[],                  // likely bugs / correctness issues
  "performance": string[],           // performance concerns
  "security": string[],              // security concerns
  "observability": string[],         // logging/metrics/tracing gaps
  "breakingChanges": string[],       // breaking changes
  "recommendations": string[],       // concrete, actionable recommendations
  "score": number                    // overall health score 0-100 (higher is better)
}
Use empty arrays when a category has no findings. Be specific and reference file paths where possible.`;

/**
 * Autonomous PR review workflow. Gathers PR data via the repository contract,
 * chunks large diffs, asks the configured LLM for a structured ReviewResult per
 * chunk, merges them, and publishes a ReviewCompletedEvent.
 *
 * Depends only on provider-agnostic interfaces — no Bitbucket/OpenAI specifics.
 */
export class CodeReviewAgent implements Agent<CodeReviewAgentInput, CodeReviewAgentOutput> {
  constructor(private readonly deps: CodeReviewAgentDeps) {}

  async execute(input: CodeReviewAgentInput): Promise<CodeReviewAgentOutput> {
    const { context, pullRequestId } = input;
    const repo = this.deps.pullRequests;

    const [pullRequest, diff, files, comments, commits] = await Promise.all([
      repo.get(context, pullRequestId),
      repo.getDiff(context, pullRequestId),
      repo.getFiles(context, pullRequestId),
      repo.getComments(context, pullRequestId),
      repo.getCommits(context, pullRequestId),
    ]);

    const chunks = this.deps.chunking.chunk({ diff, files });
    this.deps.logger?.debug({ msg: 'code-review.chunks', count: chunks.length, pullRequestId });

    const system = input.guidelines ? `${SYSTEM_PROMPT}\n\nAdditional guidelines:\n${input.guidelines}` : SYSTEM_PROMPT;

    const partials: ReviewResult[] = [];
    for (const chunk of chunks) {
      const prompt = this.buildPrompt({ pullRequest, comments, commits, chunk, totalChunks: chunks.length });
      const raw = await this.deps.llm.complete<unknown>(prompt, { system, json: true });
      partials.push(parseReviewResult(raw));
    }

    const result = mergeReviewResults(partials);

    await this.deps.eventBus.publish(
      reviewCompletedEvent({
        workspace: context.workspace,
        repository: context.repository,
        pullRequestId,
        score: result.score,
        summary: result.summary,
      }),
    );

    return result;
  }

  private buildPrompt(params: {
    pullRequest: PullRequest;
    comments: PullRequestComment[];
    commits: Commit[];
    chunk: PullRequestChunk;
    totalChunks: number;
  }): string {
    const { pullRequest, comments, commits, chunk, totalChunks } = params;

    const header = [
      `# Pull Request #${pullRequest.id}: ${pullRequest.title}`,
      `State: ${pullRequest.state}`,
      `Source: ${pullRequest.source.branch} -> Destination: ${pullRequest.destination.branch}`,
      pullRequest.description ? `\nDescription:\n${pullRequest.description}` : '',
    ].join('\n');

    const commitList = commits
      .slice(0, 50)
      .map((c) => `- ${c.hash.slice(0, 10)} ${firstLine(c.message)}`)
      .join('\n');

    const commentList = comments
      .slice(0, 50)
      .map((c) => `- ${c.author?.displayName ?? 'unknown'}: ${firstLine(c.content)}`)
      .join('\n');

    const fileList = chunk.files
      .map((f) => `- ${describeFile(f)}`)
      .join('\n');

    const chunkLabel = totalChunks > 1 ? ` (chunk ${chunk.index + 1} of ${totalChunks})` : '';

    return [
      header,
      commits.length ? `\n## Commits\n${commitList}` : '',
      comments.length ? `\n## Existing comments\n${commentList}` : '',
      `\n## Files in this batch${chunkLabel}\n${fileList || '(none)'}`,
      `\n## Diff${chunkLabel}\n\`\`\`diff\n${truncate(chunk.diff, 200_000)}\n\`\`\``,
      totalChunks > 1
        ? '\nReview ONLY the files/diff in this batch. Other batches are reviewed separately.'
        : '',
    ]
      .filter(Boolean)
      .join('\n');
  }
}

function firstLine(text: string): string {
  return (text ?? '').split('\n')[0]?.trim() ?? '';
}

function describeFile(file: PullRequestFileChange): string {
  const stats =
    file.linesAdded !== undefined || file.linesRemoved !== undefined
      ? ` (+${file.linesAdded ?? 0}/-${file.linesRemoved ?? 0})`
      : '';
  return `${file.status}: ${file.path}${stats}`;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}\n... [truncated ${text.length - max} chars]`;
}
