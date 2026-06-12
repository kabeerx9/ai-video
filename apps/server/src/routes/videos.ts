import { getAuth, clerkClient } from "@clerk/fastify";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import type { AppContainer } from "@/container";
import { JobNotFoundError, OpenRouterApiError } from "@/domain/video-generation/errors";
import { InsufficientCreditsError } from "@/modules/credits/credits.service";
import { getOrCreateUserByClerkId, mapClerkApiUser } from "@/services/user";

const generateVideoBodySchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  model: z.string().trim().min(1),
  duration: z.number().int().positive().optional(),
  resolution: z.string().trim().min(1).optional(),
  aspectRatio: z.string().trim().min(1).optional(),
});

async function resolveAuthenticatedUserId(request: FastifyRequest, reply: FastifyReply) {
  const { userId: clerkUserId } = getAuth(request);

  if (!clerkUserId) {
    reply.code(401).send({ error: "Unauthorized" });
    return null;
  }

  const user = await getOrCreateUserByClerkId(clerkUserId, async () => {
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    return mapClerkApiUser(clerkUser);
  });

  return user.id;
}

function handleRouteError(error: unknown, reply: FastifyReply) {
  if (error instanceof InsufficientCreditsError) {
    return reply.code(402).send({ error: error.message });
  }

  if (error instanceof JobNotFoundError) {
    return reply.code(404).send({ error: error.message });
  }

  if (error instanceof OpenRouterApiError) {
    const statusCode = error.status >= 400 && error.status < 600 ? error.status : 502;
    return reply.code(statusCode).send({ error: error.message });
  }

  if (error instanceof z.ZodError) {
    return reply.code(400).send({ error: error.issues[0]?.message ?? "Invalid request" });
  }

  throw error;
}

export function registerVideoRoutes(fastify: FastifyInstance, container: AppContainer) {
  const { videoGenerationService } = container;

  fastify.get("/api/videos/models", async (request, reply) => {
    const userId = await resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return;
    }

    try {
      const models = await videoGenerationService.listModels();
      return { models };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  fastify.post("/api/videos/generate", async (request, reply) => {
    const userId = await resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return;
    }

    try {
      const body = generateVideoBodySchema.parse(request.body);
      const job = await videoGenerationService.startGeneration(userId, body);
      return reply.code(202).send({ job });
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  fastify.get("/api/videos/jobs/:jobId", async (request, reply) => {
    const userId = await resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return;
    }

    try {
      const { jobId } = request.params as { jobId: string };
      const job = await videoGenerationService.getJob(userId, jobId);
      return { job };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  fastify.get("/api/videos/jobs/:jobId/content", async (request, reply) => {
    const userId = await resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return;
    }

    try {
      const { jobId } = request.params as { jobId: string };
      const videoResponse = await videoGenerationService.getJobContent(userId, jobId);
      const contentType = videoResponse.headers.get("content-type") ?? "video/mp4";
      const buffer = Buffer.from(await videoResponse.arrayBuffer());

      return reply
        .header("Content-Type", contentType)
        .header("Cache-Control", "private, max-age=3600")
        .send(buffer);
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}
