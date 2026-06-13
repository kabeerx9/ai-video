import type {
  CreateVideoGenerationInput,
  OpenRouterVideoJob,
  VideoModelSummary,
} from "@/domain/video-generation/types";

export interface IOpenRouterVideoClient {
  listModels(): Promise<VideoModelSummary[]>;
  createVideo(input: CreateVideoGenerationInput): Promise<OpenRouterVideoJob>;
  getJob(openRouterJobId: string): Promise<OpenRouterVideoJob>;
  fetchVideoContent(contentUrl: string, range?: string): Promise<Response>;
}
