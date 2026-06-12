import { env } from "@ai-video/env/server";

import { OPENROUTER_API_BASE } from "@/domain/video-generation/types";
import { OpenRouterApiError } from "@/domain/video-generation/errors";
import type {
  CreateVideoGenerationInput,
  OpenRouterJobStatus,
  OpenRouterVideoJob,
  VideoModelSummary,
} from "@/domain/video-generation/types";
import type { IOpenRouterVideoClient } from "@/modules/openrouter/openrouter-video.client.interface";

type RawVideoModel = {
  id: string;
  name: string;
  description?: string;
  supported_resolutions?: string[];
  supported_aspect_ratios?: string[];
  pricing_skus?: Record<string, string>;
};

type RawVideoJob = {
  id: string;
  status: OpenRouterJobStatus;
  polling_url: string;
  unsigned_urls?: string[];
  error?: string;
  usage?: {
    cost: number | null;
    is_byok: boolean;
  };
};

function mapJob(raw: RawVideoJob): OpenRouterVideoJob {
  return {
    id: raw.id,
    status: raw.status,
    pollingUrl: raw.polling_url,
    unsignedUrls: raw.unsigned_urls ?? [],
    error: raw.error ?? null,
    usage: raw.usage
      ? {
          cost: raw.usage.cost,
          isByok: raw.usage.is_byok,
        }
      : null,
  };
}

function mapModel(raw: RawVideoModel): VideoModelSummary {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? null,
    supportedResolutions: raw.supported_resolutions ?? [],
    supportedAspectRatios: raw.supported_aspect_ratios ?? [],
    pricingSkus: raw.pricing_skus ?? {},
  };
}

export class OpenRouterVideoClient implements IOpenRouterVideoClient {
  constructor(private readonly apiKey: string) {}

  async listModels(): Promise<VideoModelSummary[]> {
    const response = await this.request<{ data: RawVideoModel[] }>("/videos/models");
    return response.data.map(mapModel);
  }

  async createVideo(input: CreateVideoGenerationInput): Promise<OpenRouterVideoJob> {
    const body: Record<string, unknown> = {
      model: input.model,
      prompt: input.prompt,
    };

    if (input.duration !== undefined) {
      body.duration = input.duration;
    }

    if (input.resolution !== undefined) {
      body.resolution = input.resolution;
    }

    if (input.aspectRatio !== undefined) {
      body.aspect_ratio = input.aspectRatio;
    }

    const raw = await this.request<RawVideoJob>("/videos", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return mapJob(raw);
  }

  async getJob(openRouterJobId: string): Promise<OpenRouterVideoJob> {
    const raw = await this.request<RawVideoJob>(`/videos/${openRouterJobId}`);
    return mapJob(raw);
  }

  async fetchVideoContent(contentUrl: string): Promise<Response> {
    const response = await fetch(contentUrl, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new OpenRouterApiError(response.status, "Failed to fetch generated video content");
    }

    return response;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${OPENROUTER_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new OpenRouterApiError(
        response.status,
        payload?.error ?? `OpenRouter request failed (${response.status})`,
      );
    }

    return response.json() as Promise<T>;
  }
}

export function createOpenRouterVideoClient(): OpenRouterVideoClient {
  return new OpenRouterVideoClient(env.OPENROUTER_API_KEY);
}
