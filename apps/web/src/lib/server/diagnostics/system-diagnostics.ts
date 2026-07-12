import "server-only";

import { type Pool, type QueryResult } from "pg";

import { getCollabDatabaseDiagnostics, getCollabServerUrl } from "@/lib/server/collab/collab-server-client";
import { getAppPostgresPool } from "@/lib/server/database/postgres";
import { getLastDiagnosticError } from "./error-registry";

const REQUEST_TIMEOUT_MS = 2_000;
const EXPECTED_APP_SCHEMA_VERSION = 8;

type MigrationRow = { version: string | null; description: string | null; installed_on: Date | string | null };

export async function getSystemDiagnostics() {
  const checkedAt = new Date().toISOString();
  const [appDatabase, collabDatabase, collabServer] = await Promise.all([
    inspectDatabase(getAppPostgresPool(), EXPECTED_APP_SCHEMA_VERSION),
    inspectCollabDatabase(),
    inspectCollabServer(),
  ]);

  return {
    checkedAt,
    webApp: {
      status: "ok" as const,
      version: process.env.NEXT_PUBLIC_SKETCHBLOCK_VERSION?.trim() || process.env.npm_package_version || "unknown",
      deploymentEnvironment: safeDeploymentEnvironment(),
      persistenceDriver: "postgres",
      authMode: process.env.SKETCHBLOCK_AUTH_MODE === "demo" ? "demo" : process.env.SKETCHBLOCK_AUTH_MODE === "dev" ? "dev" : "github",
      lastError: getLastDiagnosticError(),
    },
    databases: { app: appDatabase, collab: collabDatabase },
    collabServer,
  };
}

async function inspectDatabase(pool: Pick<Pool, "query">, expectedVersion: number) {
  try {
    await pool.query("SELECT 1 AS ok");
    const history = await queryMigrationHistory(pool);
    return migrationSummary(history, expectedVersion);
  } catch {
    return { reachable: false, migrationStatus: "fehlerhaft" as const, errorCode: "database_unavailable" };
  }
}

async function inspectCollabDatabase() {
  try {
    return await getCollabDatabaseDiagnostics();
  } catch {
    return {
      reachable: false,
      schemaVersion: null,
      migrationStatus: "fehlerhaft" as const,
      latestSuccessfulMigration: null,
      errorCode: "collab_diagnostics_unavailable",
    };
  }
}

async function queryMigrationHistory(pool: Pick<Pool, "query">): Promise<QueryResult<MigrationRow>> {
  return pool.query<MigrationRow>(
    `SELECT version, description, installed_on
     FROM flyway_schema_history
     WHERE success = true AND version IS NOT NULL
     ORDER BY installed_rank DESC LIMIT 1`,
  );
}

function migrationSummary(history: QueryResult<MigrationRow>, expectedVersion: number) {
  const latest = history.rows[0];
  const installedVersion = Number.parseInt(latest?.version || "0", 10);
  return {
    reachable: true,
    schemaVersion: latest?.version ?? null,
    migrationStatus: installedVersion >= expectedVersion ? "aktuell" as const : "ausstehend" as const,
    latestSuccessfulMigration: latest ? {
      version: latest.version,
      description: latest.description,
      installedAt: latest.installed_on ? new Date(latest.installed_on).toISOString() : null,
    } : null,
  };
}

async function inspectCollabServer() {
  const checkedAt = new Date().toISOString();
  try {
    const [healthResponse, metricsResponse] = await Promise.all([
      fetch(`${getCollabServerUrl()}/health`, { cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }),
      fetch(`${getCollabServerUrl()}/metrics`, { cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }),
    ]);
    const health = await healthResponse.json() as { service?: string; status?: string; transport?: string; version?: string };
    const metrics = metricsResponse.ok ? await metricsResponse.json() as {
      sessions?: { activePresenceSessions?: number; connectedClients?: number };
    } : {};
    return {
      reachable: healthResponse.ok && health.status === "ok",
      service: health.service ?? "unknown",
      version: health.version ?? "unknown",
      transport: health.transport ?? "unknown",
      websocketCapable: health.transport === "socket.io",
      activeSessions: metrics.sessions?.activePresenceSessions ?? null,
      connectedClients: metrics.sessions?.connectedClients ?? null,
      lastSuccessfulCheck: healthResponse.ok ? checkedAt : null,
    };
  } catch {
    return {
      reachable: false,
      service: "sketchblock-collab-server",
      version: "unknown",
      transport: "unknown",
      websocketCapable: false,
      activeSessions: null,
      connectedClients: null,
      lastSuccessfulCheck: null,
      errorCode: "collab_server_unavailable",
    };
  }
}

function safeDeploymentEnvironment() {
  return process.env.SKETCHBLOCK_DEPLOYMENT_ENV === "production" ? "production" : "local";
}
