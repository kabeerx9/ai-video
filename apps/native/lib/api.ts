import { env } from "@ai-video/env/native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { getClerkAuthToken } from "@/utils/clerk-auth";

export type MeResponse = {
  id: string;
  clerkId: string;
  email: string | null;
  name: string | null;
  imageUrl: string | null;
  credits: number;
  createdAt: string;
  updatedAt: string;
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getClerkAuthToken();
  const headers = new Headers(init?.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${env.EXPO_PUBLIC_SERVER_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(response.status, payload?.error ?? response.statusText);
  }

  return response.json() as Promise<T>;
}

export function getMe() {
  return apiFetch<MeResponse>("/api/me");
}

export type VideoModel = {
  id: string;
  name: string;
  description: string | null;
  supportedResolutions: string[];
  supportedAspectRatios: string[];
  pricingSkus: Record<string, string>;
};

export type GenerationJob = {
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

export function getVideoModels() {
  return apiFetch<{ models: VideoModel[] }>("/api/videos/models");
}

export function getGenerationJobs(limit = 12) {
  return apiFetch<{ jobs: GenerationJob[] }>(`/api/videos/jobs?limit=${limit}`);
}

export function generateVideo(body: {
  prompt: string;
  model: string;
  duration?: number;
  resolution?: string;
  aspectRatio?: string;
}) {
  return apiFetch<{ job: GenerationJob }>("/api/videos/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getGenerationJob(jobId: string) {
  return apiFetch<{ job: GenerationJob }>(`/api/videos/jobs/${jobId}`);
}

export async function getGenerationJobVideoSource(jobId: string) {
  const token = await getClerkAuthToken();
  return {
    uri: `${env.EXPO_PUBLIC_SERVER_URL}/api/videos/jobs/${jobId}/content`,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    contentType: "progressive" as const,
  };
}

export async function downloadGenerationJob(jobId: string) {
  const token = await getClerkAuthToken();
  const destination = new File(Paths.cache, `ai-video-${jobId}.mp4`);
  const file = await File.downloadFileAsync(
    `${env.EXPO_PUBLIC_SERVER_URL}/api/videos/jobs/${jobId}/content`,
    destination,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      idempotent: true,
    },
  );

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing is not available on this device");
  }

  await Sharing.shareAsync(file.uri, {
    dialogTitle: "Save or share your generated video",
    mimeType: "video/mp4",
    UTI: "public.mpeg-4",
  });
}
