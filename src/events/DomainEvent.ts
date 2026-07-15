/**
 * A domain event represents something meaningful that happened in the system.
 * Kept intentionally generic so notification/automation handlers (Slack, Teams,
 * auto-approval, ...) can be added later without changing producers.
 */
export interface DomainEvent<TPayload = unknown> {
  name: string;
  occurredAt: string;
  payload: TPayload;
}

/** Canonical event names. Extend this as new automations are added. */
export const EventNames = {
  ReviewCompleted: 'ReviewCompletedEvent',
  PullRequestReviewed: 'PullRequestReviewedEvent',
  PullRequestApproved: 'PullRequestApprovedEvent',
  PipelineFailed: 'PipelineFailedEvent',
} as const;

export type EventName = (typeof EventNames)[keyof typeof EventNames];

export interface ReviewCompletedPayload {
  workspace: string;
  repository?: string;
  pullRequestId: number;
  score: number;
  summary: string;
}

export function createDomainEvent<TPayload>(name: string, payload: TPayload): DomainEvent<TPayload> {
  return { name, occurredAt: new Date().toISOString(), payload };
}

export function reviewCompletedEvent(
  payload: ReviewCompletedPayload,
): DomainEvent<ReviewCompletedPayload> {
  return createDomainEvent(EventNames.ReviewCompleted, payload);
}
