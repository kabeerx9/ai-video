# ai-video

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Router, Fastify, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Router** - File-based routing with full type safety
- **React Native** - Build mobile apps using React
- **Expo** - Tools for React Native development
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **Fastify** - Fast, low-overhead web framework
- **Node.js** - Runtime environment
- **Prisma** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Authentication** - Clerk
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
pnpm install
```

## Database Setup

This project uses PostgreSQL with Prisma and is configured for Supabase.

1. Update `apps/server/.env` with your Supabase connection strings:

```bash
# Pooled — used by the server at runtime (transaction pooler, port 6543)
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct — used by Prisma CLI for db push / migrate (session pooler, port 5432)
DIRECT_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"
```

For local Postgres, set both `DATABASE_URL` and `DIRECT_URL` to the same connection string.

2. Apply the schema:

```bash
pnpm run db:push
```

## Clerk Authentication Setup

- Follow the guide: [Clerk Quickstart](https://clerk.com/docs/react/getting-started/quickstart)
- Set `VITE_CLERK_PUBLISHABLE_KEY` in `apps/web/.env`
- Set `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` in `apps/native/.env`
- Set `CLERK_SECRET_KEY` in `apps/server/.env` for server-side Clerk auth
- Set `CLERK_PUBLISHABLE_KEY` in `apps/server/.env` for Clerk backend middleware

### Clerk webhook (user sync)

The server exposes `POST /webhooks/clerk` to keep the `User` table in sync with Clerk.

1. In the [Clerk Dashboard](https://dashboard.clerk.com) → **Webhooks** → **Add Endpoint**
2. Set the URL to your server, e.g. `https://your-domain.com/webhooks/clerk`
   - For local dev, use [ngrok](https://ngrok.com) or similar: `ngrok http 3000`
3. Subscribe to: `user.created`, `user.updated`, `user.deleted`
4. Copy the **Signing Secret** into `CLERK_WEBHOOK_SIGNING_SECRET` in `apps/server/.env`

If the webhook is not configured yet, signed-in users are still created on first `GET /api/me` (JIT fallback).

### Google OAuth (web)

Google sign-in redirects back to `/sso-callback`. Add this in the Clerk Dashboard:

1. **Configure** → **Paths** → ensure sign-in URL is `/` and sign-up URL is `/sign-up`
2. **Configure** → **Allowed redirect URLs** → add `http://localhost:3001/sso-callback`
3. **User & Authentication** → **Social connections** → enable **Google**

Then, run the development server:

```bash
pnpm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.
Use the Expo Go app to run the mobile application.
The API is running at [http://localhost:3000](http://localhost:3000).

## EAS development and preview builds

The native app is linked to the EAS project
[`@kabeerx9/ai-video`](https://expo.dev/accounts/kabeerx9/projects/ai-video).

Build profiles:

- `development`: includes Expo Dev Client and developer tools
- `development-simulator`: development client for the iOS Simulator
- `preview`: production-like internal build with an EAS installation URL
- `production`: store build

Before creating a preview build, deploy the API to a public HTTPS URL and configure it:

```bash
cd apps/native
eas env:create --environment preview \
  --name EXPO_PUBLIC_SERVER_URL \
  --value https://api.example.com \
  --visibility plaintext
```

Create and share an Android preview:

```bash
pnpm run build:native:preview:android
```

EAS returns a URL that testers can open to install the APK. For iOS internal
distribution, testers' devices must be registered with `eas device:create` and
the build requires an Apple Developer account.

Create a development client:

```bash
pnpm run build:native:development:android
pnpm run dev:native:client
```

After a preview build is installed, publish JavaScript and asset changes without
rebuilding native code:

```bash
pnpm run update:native:preview -- --message "Describe the update"
```

## Video generation (OpenRouter)

Set `OPENROUTER_API_KEY` in `apps/server/.env`.

Each generation costs **10 credits**. Grant yourself credits in Supabase (`User.credits`) or via Prisma Studio while testing.

API routes:

- `GET /api/videos/models` — list video models from OpenRouter
- `POST /api/videos/generate` — start a generation job
- `GET /api/videos/jobs/:id` — poll job status
- `GET /api/videos/jobs/:id/content` — stream the temporary generated video

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@ai-video/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Project Structure

```
ai-video/
├── apps/
│   ├── web/         # Frontend application (React + TanStack Router)
│   ├── native/      # Mobile application (React Native, Expo)
│   └── server/      # Backend API (Fastify)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   └── db/          # Database schema & queries
```

## Available Scripts

- `pnpm run dev`: Start all applications in development mode
- `pnpm run build`: Build all applications
- `pnpm run dev:web`: Start only the web application
- `pnpm run dev:server`: Start only the server
- `pnpm run check-types`: Check TypeScript types across all apps
- `pnpm run dev:native`: Start the React Native/Expo development server
- `pnpm run db:push`: Push schema changes to database
- `pnpm run db:generate`: Generate database client/types
- `pnpm run db:migrate`: Run database migrations
- `pnpm run db:studio`: Open database studio UI
