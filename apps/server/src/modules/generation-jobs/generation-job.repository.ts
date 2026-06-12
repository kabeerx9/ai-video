import prisma from "@ai-video/db";
import { JobStatus } from "@ai-video/db/types";

import type {
  CreateGenerationJobInput,
  GenerationJobRecord,
} from "@/domain/video-generation/types";
import type { IGenerationJobRepository } from "@/modules/generation-jobs/generation-job.repository.interface";

function mapRecord(job: {
  id: string;
  userId: string;
  openRouterJobId: string;
  prompt: string;
  model: string;
  status: JobStatus;
  creditsCharged: number;
  creditsRefunded: boolean;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}): GenerationJobRecord {
  return {
    id: job.id,
    userId: job.userId,
    openRouterJobId: job.openRouterJobId,
    prompt: job.prompt,
    model: job.model,
    status: job.status,
    creditsCharged: job.creditsCharged,
    creditsRefunded: job.creditsRefunded,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export class PrismaGenerationJobRepository implements IGenerationJobRepository {
  async create(input: CreateGenerationJobInput): Promise<GenerationJobRecord> {
    const job = await prisma.generationJob.create({
      data: {
        userId: input.userId,
        openRouterJobId: input.openRouterJobId,
        prompt: input.prompt,
        model: input.model,
        creditsCharged: input.creditsCharged,
        status: JobStatus.PENDING,
      },
    });

    return mapRecord(job);
  }

  async findByIdForUser(jobId: string, userId: string): Promise<GenerationJobRecord | null> {
    const job = await prisma.generationJob.findFirst({
      where: { id: jobId, userId },
    });

    return job ? mapRecord(job) : null;
  }

  async updateFromOpenRouter(
    jobId: string,
    data: {
      status: string;
      error?: string | null;
      creditsRefunded?: boolean;
    },
  ): Promise<GenerationJobRecord> {
    const job = await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: data.status as JobStatus,
        error: data.error ?? null,
        creditsRefunded: data.creditsRefunded,
      },
    });

    return mapRecord(job);
  }
}
