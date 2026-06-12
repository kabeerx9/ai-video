import { JobStatus } from "@ai-video/db/types";

import type { OpenRouterJobStatus } from "@/domain/video-generation/types";

const OPENROUTER_TO_JOB_STATUS: Record<OpenRouterJobStatus, JobStatus> = {
  pending: JobStatus.PENDING,
  in_progress: JobStatus.PROCESSING,
  completed: JobStatus.COMPLETED,
  failed: JobStatus.FAILED,
  cancelled: JobStatus.CANCELLED,
  expired: JobStatus.EXPIRED,
};

const TERMINAL_OPENROUTER_STATUSES = new Set<OpenRouterJobStatus>([
  "completed",
  "failed",
  "cancelled",
  "expired",
]);

const REFUNDABLE_OPENROUTER_STATUSES = new Set<OpenRouterJobStatus>([
  "failed",
  "cancelled",
  "expired",
]);

export function mapOpenRouterStatus(status: OpenRouterJobStatus): JobStatus {
  return OPENROUTER_TO_JOB_STATUS[status];
}

export function isTerminalOpenRouterStatus(status: OpenRouterJobStatus): boolean {
  return TERMINAL_OPENROUTER_STATUSES.has(status);
}

export function shouldRefundOpenRouterStatus(status: OpenRouterJobStatus): boolean {
  return REFUNDABLE_OPENROUTER_STATUSES.has(status);
}

export function isTerminalJobStatus(status: string): boolean {
  return (
    status === JobStatus.COMPLETED ||
    status === JobStatus.FAILED ||
    status === JobStatus.CANCELLED ||
    status === JobStatus.EXPIRED
  );
}
