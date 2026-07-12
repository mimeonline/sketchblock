import "server-only";

import { Pool } from "pg";

let pool: Pool | null = null;

export function getAppPersistenceDriver() {
  const value = process.env.SKETCHBLOCK_APP_PERSISTENCE_DRIVER?.trim().toLowerCase() || "postgres";
  if (value !== "postgres") {
    throw new Error("SKETCHBLOCK_APP_PERSISTENCE_DRIVER must be postgres");
  }

  return value;
}

export function getAppPostgresPool() {
  if (pool) {
    return pool;
  }

  const connectionString = process.env.SKETCHBLOCK_APP_DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("SKETCHBLOCK_APP_DATABASE_URL is required");
  }

  pool = new Pool({
    connectionString,
    max: Number.parseInt(process.env.SKETCHBLOCK_APP_DATABASE_POOL_MAX || "5", 10),
  });

  return pool;
}
