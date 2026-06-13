import type {
  CreateGenerationJobInput,
  GenerationJobRecord,
} from "@/domain/video-generation/types";

export interface IGenerationJobRepository {
  create(input: CreateGenerationJobInput): Promise<GenerationJobRecord>;
  listByUser(userId: string, limit: number): Promise<GenerationJobRecord[]>;
  findByIdForUser(jobId: string, userId: string): Promise<GenerationJobRecord | null>;
  updateFromOpenRouter(
    jobId: string,
    data: {
      status: string;
      error?: string | null;
      creditsRefunded?: boolean;
    },
  ): Promise<GenerationJobRecord>;
}
