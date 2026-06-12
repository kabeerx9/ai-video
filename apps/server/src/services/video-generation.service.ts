import { JobStatus } from "@ai-video/db/types";

import { JobNotFoundError } from "@/domain/video-generation/errors";
import {
  isTerminalJobStatus,
  isTerminalOpenRouterStatus,
  mapOpenRouterStatus,
  shouldRefundOpenRouterStatus,
} from "@/domain/video-generation/status-mapper";
import type {
  CreateVideoGenerationInput,
  GenerationJobRecord,
  GenerationJobView,
  OpenRouterVideoJob,
  VideoModelSummary,
} from "@/domain/video-generation/types";
import { GENERATION_CREDIT_COST } from "@/domain/video-generation/types";
import type { ICreditsService } from "@/modules/credits/credits.service.interface";
import type { IGenerationJobRepository } from "@/modules/generation-jobs/generation-job.repository.interface";
import type { IOpenRouterVideoClient } from "@/modules/openrouter/openrouter-video.client.interface";

type VideoGenerationServiceConfig = {
  creditCost: number;
};

export class VideoGenerationService {
  constructor(
    private readonly openRouterClient: IOpenRouterVideoClient,
    private readonly jobRepository: IGenerationJobRepository,
    private readonly creditsService: ICreditsService,
    private readonly config: VideoGenerationServiceConfig,
  ) {}

  listModels(): Promise<VideoModelSummary[]> {
    return this.openRouterClient.listModels();
  }

  async startGeneration(
    userId: string,
    input: CreateVideoGenerationInput,
  ): Promise<GenerationJobView> {
    await this.creditsService.spendCredits(userId, this.config.creditCost, {
      description: "Video generation",
      metadata: { model: input.model },
    });

    let openRouterJob: OpenRouterVideoJob;

    try {
      openRouterJob = await this.openRouterClient.createVideo(input);
    } catch (error) {
      await this.creditsService.refundCredits(userId, this.config.creditCost, {
        description: "Video generation failed before submission",
        metadata: { model: input.model },
      });
      throw error;
    }

    const job = await this.jobRepository.create({
      userId,
      openRouterJobId: openRouterJob.id,
      prompt: input.prompt,
      model: input.model,
      creditsCharged: this.config.creditCost,
    });

    const syncedStatus = mapOpenRouterStatus(openRouterJob.status);
    const updatedJob = await this.jobRepository.updateFromOpenRouter(job.id, {
      status: syncedStatus,
      error: openRouterJob.error,
    });

    return this.toView(updatedJob, openRouterJob);
  }

  async getJob(userId: string, jobId: string): Promise<GenerationJobView> {
    const job = await this.jobRepository.findByIdForUser(jobId, userId);
    if (!job) {
      throw new JobNotFoundError();
    }

    if (isTerminalJobStatus(job.status)) {
      return this.toView(job, null);
    }

    const openRouterJob = await this.openRouterClient.getJob(job.openRouterJobId);
    const updatedJob = await this.syncJobFromOpenRouter(job, openRouterJob);

    return this.toView(updatedJob, openRouterJob);
  }

  async getJobContent(userId: string, jobId: string): Promise<Response> {
    const job = await this.jobRepository.findByIdForUser(jobId, userId);
    if (!job) {
      throw new JobNotFoundError();
    }

    if (job.status !== JobStatus.COMPLETED) {
      throw new JobNotFoundError();
    }

    const openRouterJob = await this.openRouterClient.getJob(job.openRouterJobId);
    const contentUrl = openRouterJob.unsignedUrls[0];

    if (!contentUrl) {
      throw new JobNotFoundError();
    }

    return this.openRouterClient.fetchVideoContent(contentUrl);
  }

  private async syncJobFromOpenRouter(
    job: GenerationJobRecord,
    openRouterJob: OpenRouterVideoJob,
  ): Promise<GenerationJobRecord> {
    const mappedStatus = mapOpenRouterStatus(openRouterJob.status);

    if (!isTerminalOpenRouterStatus(openRouterJob.status)) {
      return this.jobRepository.updateFromOpenRouter(job.id, {
        status: mappedStatus,
        error: openRouterJob.error,
      });
    }

    const shouldRefund =
      shouldRefundOpenRouterStatus(openRouterJob.status) && !job.creditsRefunded;

    if (shouldRefund) {
      await this.creditsService.refundCredits(job.userId, job.creditsCharged, {
        description: "Video generation failed",
        metadata: {
          jobId: job.id,
          openRouterJobId: job.openRouterJobId,
          status: openRouterJob.status,
        },
      });
    }

    return this.jobRepository.updateFromOpenRouter(job.id, {
      status: mappedStatus,
      error: openRouterJob.error,
      creditsRefunded: shouldRefund ? true : job.creditsRefunded,
    });
  }

  private toView(
    job: GenerationJobRecord,
    openRouterJob: OpenRouterVideoJob | null,
  ): GenerationJobView {
    const isCompleted = job.status === JobStatus.COMPLETED;
    const hasOpenRouterContent =
      openRouterJob?.status === "completed" && (openRouterJob.unsignedUrls.length ?? 0) > 0;

    return {
      id: job.id,
      prompt: job.prompt,
      model: job.model,
      status: job.status,
      creditsCharged: job.creditsCharged,
      error: job.error,
      videoUrl:
        isCompleted || hasOpenRouterContent ? `/api/videos/jobs/${job.id}/content` : null,
      openRouterCostUsd: openRouterJob?.usage?.cost ?? null,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };
  }
}

export function createVideoGenerationService(deps: {
  openRouterClient: IOpenRouterVideoClient;
  jobRepository: IGenerationJobRepository;
  creditsService: ICreditsService;
}): VideoGenerationService {
  return new VideoGenerationService(
    deps.openRouterClient,
    deps.jobRepository,
    deps.creditsService,
    { creditCost: GENERATION_CREDIT_COST },
  );
}
