import { getAuth, clerkClient } from "@clerk/fastify";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Readable } from "node:stream";
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

const listJobsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

type ByteRange = {
  start: number;
  end: number;
};

function toNodeStream(response: Response) {
  if (!response.body) {
    return null;
  }

  return Readable.fromWeb(response.body);
}

export function parseByteRange(rangeHeader: string, contentLength: number): ByteRange | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match || contentLength <= 0) {
    return null;
  }

  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) {
    return null;
  }

  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      return null;
    }

    return {
      start: Math.max(contentLength - suffixLength, 0),
      end: contentLength - 1,
    };
  }

  const start = Number(rawStart);
  const requestedEnd = rawEnd ? Number(rawEnd) : contentLength - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    start >= contentLength ||
    requestedEnd < start
  ) {
    return null;
  }

  return {
    start,
    end: Math.min(requestedEnd, contentLength - 1),
  };
}

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

  fastify.get("/api/videos/jobs", async (request, reply) => {
    const userId = await resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return;
    }

    try {
      const { limit } = listJobsQuerySchema.parse(request.query);
      const jobs = await videoGenerationService.listJobs(userId, limit);
      return { jobs };
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
      const requestedRange = request.headers.range;
      const videoResponse = await videoGenerationService.getJobContent(
        userId,
        jobId,
        requestedRange,
      );
      const contentType = videoResponse.headers.get("content-type") ?? "video/mp4";
      const upstreamContentLength = videoResponse.headers.get("content-length");
      const upstreamContentRange = videoResponse.headers.get("content-range");

      reply
        .header("Accept-Ranges", "bytes")
        .header("Content-Type", contentType)
        .header("Cache-Control", "private, max-age=3600");

      if (requestedRange && videoResponse.status === 206 && upstreamContentRange) {
        const stream = toNodeStream(videoResponse);
        if (!stream) {
          return reply.code(502).send({ error: "Video content was empty" });
        }

        if (upstreamContentLength) {
          reply.header("Content-Length", upstreamContentLength);
        }

        return reply
          .code(206)
          .header("Content-Range", upstreamContentRange)
          .send(stream);
      }

      if (requestedRange) {
        const buffer = Buffer.from(await videoResponse.arrayBuffer());
        const range = parseByteRange(requestedRange, buffer.length);
        if (!range) {
          return reply
            .code(416)
            .header("Content-Range", `bytes */${buffer.length}`)
            .header("Content-Length", 0)
            .send();
        }

        const partialBuffer = buffer.subarray(range.start, range.end + 1);
        return reply
          .code(206)
          .header("Content-Range", `bytes ${range.start}-${range.end}/${buffer.length}`)
          .header("Content-Length", partialBuffer.length)
          .send(partialBuffer);
      }

      const stream = toNodeStream(videoResponse);
      if (!stream) {
        return reply.code(502).send({ error: "Video content was empty" });
      }

      if (upstreamContentLength) {
        reply.header("Content-Length", upstreamContentLength);
      }

      return reply.send(stream);
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}
