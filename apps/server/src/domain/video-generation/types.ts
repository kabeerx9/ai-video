export const GENERATION_CREDIT_COST = 10;

export const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";

export type OpenRouterJobStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export type VideoModelSummary = {
  id: string;
  name: string;
  description: string | null;
  supportedResolutions: string[];
  supportedAspectRatios: string[];
  pricingSkus: Record<string, string>;
};

export type CreateVideoGenerationInput = {
  model: string;
  prompt: string;
  duration?: number;
  resolution?: string;
  aspectRatio?: string;
};

export type OpenRouterVideoJob = {
  id: string;
  status: OpenRouterJobStatus;
  pollingUrl: string;
  unsignedUrls: string[];
  error: string | null;
  usage: {
    cost: number | null;
    isByok: boolean;
  } | null;
};

export type GenerationJobView = {
  id: string;
  prompt: string;
  model: string;
  status: string;
  creditsCharged: number;
  error: string | null;
  videoUrl: string | null;
  openRouterCostUsd: number | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateGenerationJobInput = {
  userId: string;
  openRouterJobId: string;
  prompt: string;
  model: string;
  creditsCharged: number;
};

export type GenerationJobRecord = {
  id: string;
  userId: string;
  openRouterJobId: string;
  prompt: string;
  model: string;
  status: string;
  creditsCharged: number;
  creditsRefunded: boolean;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
};
