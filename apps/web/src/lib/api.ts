import { env } from "@ai-video/env/web";

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

  const response = await fetch(`${env.VITE_SERVER_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
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
