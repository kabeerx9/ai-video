import { env } from "@ai-video/env/server";
import { clerkPlugin } from "@clerk/fastify";
import fastifyCors from "@fastify/cors";
import Fastify from "fastify";

import { createAppContainer } from "@/container";
import { registerMeRoutes } from "@/routes/me";
import { registerVideoRoutes } from "@/routes/videos";
import { registerClerkWebhookRoutes } from "@/routes/webhooks/clerk";

export function buildApp() {
  const container = createAppContainer();
  const fastify = Fastify({
    logger: true,
  });

  fastify.register(fastifyCors, {
    origin: env.CORS_ORIGIN,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
    maxAge: 86400,
  });
  fastify.register(clerkPlugin, {
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
    secretKey: env.CLERK_SECRET_KEY,
  });

  fastify.get("/", async () => {
    return "OK";
  });

  fastify.register(registerMeRoutes);
  fastify.register((instance, _opts, done) => {
    registerVideoRoutes(instance, container);
    done();
  });
  fastify.register(registerClerkWebhookRoutes);

  return fastify;
}
