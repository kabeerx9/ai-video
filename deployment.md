# Deployment

The Fastify backend deploys as its own Vercel project from this monorepo.

## Vercel project

Current production deployment:

```txt
Project: ai-video-server
URL: https://ai-video-server.vercel.app
```

Create or link a Vercel project with:

```txt
Root Directory: apps/server
Framework Preset: Fastify
```

Run the Vercel CLI from the monorepo root:

```bash
vercel link
vercel --prod
```

When linking a new project, select this Git repository and set the code directory
to `apps/server`. Vercel installs dependencies from the workspace root and builds
the `server` workspace through Turborepo.

The server deployment uses:

- `apps/server/src/create-app.ts` to construct the Fastify app
- `apps/server/src/main.ts` for local Node development
- `apps/server/dist/main.mjs` as the bundled production server
- `apps/server/index.mjs` as Vercel's detected Fastify entrypoint

Do not commit the generated `.vercel` directory.

## Backend environment

Configure these variables in the backend Vercel project for Production and
Preview:

```txt
DATABASE_URL=your-pooled-production-postgres-url
DIRECT_URL=your-direct-production-postgres-url
CLERK_SECRET_KEY=your-clerk-secret-key
CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
CLERK_WEBHOOK_SIGNING_SECRET=your-clerk-webhook-signing-secret
CORS_ORIGIN=https://your-web-app.example.com
OPENROUTER_API_KEY=your-openrouter-api-key
```

`DATABASE_URL` should use the Supabase transaction pooler. `DIRECT_URL` is used
by Prisma CLI operations and should use the direct or session-pooler connection.
Do not manually set `NODE_ENV`.

The native app does not require a CORS origin. `CORS_ORIGIN` is the deployed web
frontend URL because browsers enforce CORS.

## Clerk webhook

After the backend has a production URL, configure the Clerk webhook endpoint:

```txt
https://ai-video-server.vercel.app/webhooks/clerk
```

Subscribe to:

- `user.created`
- `user.updated`
- `user.deleted`

Store the endpoint signing secret as `CLERK_WEBHOOK_SIGNING_SECRET` in Vercel.

## Mobile preview

Point the EAS preview environment at the deployed backend:

```bash
cd apps/native
eas env:create --environment preview \
  --name EXPO_PUBLIC_SERVER_URL \
  --value https://ai-video-server.vercel.app \
  --visibility plaintext \
  --force
```

Then create the shareable Android build:

```bash
cd ../..
pnpm run build:native:preview:android
```

## Verification

Build locally:

```bash
pnpm --filter server build
pnpm --filter server check-types
```

Check the deployed API:

```bash
curl -i https://ai-video-server.vercel.app/
```

Expected response:

```txt
HTTP/2 200

OK
```

If the client reports a CORS error, inspect the backend function logs first. A
function startup failure returns no CORS headers and is commonly presented by
the browser as a CORS failure.
