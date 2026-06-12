import { CreditsService } from "@/modules/credits/credits.service";
import { PrismaGenerationJobRepository } from "@/modules/generation-jobs/generation-job.repository";
import { createOpenRouterVideoClient } from "@/modules/openrouter/openrouter-video.client";
import {
  createVideoGenerationService,
  VideoGenerationService,
} from "@/services/video-generation.service";

export type AppContainer = {
  videoGenerationService: VideoGenerationService;
};

export function createAppContainer(): AppContainer {
  const openRouterClient = createOpenRouterVideoClient();
  const jobRepository = new PrismaGenerationJobRepository();
  const creditsService = new CreditsService();

  const videoGenerationService = createVideoGenerationService({
    openRouterClient,
    jobRepository,
    creditsService,
  });

  return { videoGenerationService };
}
