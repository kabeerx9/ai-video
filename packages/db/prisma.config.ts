import path from "node:path";

import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

dotenv.config({
  path: "../../apps/server/.env",
});

export default defineConfig({
  schema: path.join("prisma", "schema"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    // Use direct connection for CLI (db push, migrate, studio).
    // Runtime Prisma Client uses the pooled DATABASE_URL via the pg adapter.
    // `prisma generate` does not connect to the database, so allow installs in
    // build environments that intentionally do not have database credentials.
    url:
      process.env.DIRECT_URL ||
      "postgresql://prisma:prisma@localhost:5432/prisma",
  },
});
