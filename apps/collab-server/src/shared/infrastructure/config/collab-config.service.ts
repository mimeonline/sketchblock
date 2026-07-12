import { Injectable } from "@nestjs/common";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

@Injectable()
export class CollabConfigService {
  readonly port = this.readNumberEnv("COLLAB_SERVER_PORT", 4513);
  readonly allowedOrigins = this.readOrigins();
  readonly maxSnapshotBytes = this.readNumberEnv("COLLAB_MAX_SNAPSHOT_BYTES", 25_000_000);
  readonly authSecret = process.env.COLLAB_AUTH_SECRET?.trim() || process.env.APP_AUTH_SECRET?.trim() || null;
  readonly logLevel = this.readLogLevel();
  readonly logFormat = this.readLogFormat();
  readonly persistenceDriver = this.readPersistenceDriver();
  readonly databaseUrl = process.env.COLLAB_DATABASE_URL?.trim() || "";
  readonly databasePoolMax = this.readNumberEnv("COLLAB_DATABASE_POOL_MAX", 5);
  readonly maxClientsPerSession = this.readNumberEnv("COLLAB_MAX_CLIENTS_PER_SESSION", 24);
  readonly maxActiveSessions = this.readNumberEnv("COLLAB_MAX_ACTIVE_SESSIONS", 200);
  readonly httpRequestsPerIpPerMinute = this.readNumberEnv("COLLAB_HTTP_REQUESTS_PER_IP_PER_MINUTE", 240);
  readonly socketConnectsPerIpPerMinute = this.readNumberEnv("COLLAB_SOCKET_CONNECTS_PER_IP_PER_MINUTE", 60);
  readonly socketEventsPerSocketPerMinute = this.readNumberEnv("COLLAB_SOCKET_EVENTS_PER_SOCKET_PER_MINUTE", 300);
  readonly yjsUpdatesPerSocketPerMinute = this.readNumberEnv("COLLAB_YJS_UPDATES_PER_SOCKET_PER_MINUTE", 1_800);

  private readNumberEnv(name: string, fallback: number): number {
    const value = process.env[name];
    if (!value) {
      return fallback;
    }

    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      throw new Error(`${name} must be a positive integer`);
    }

    return parsed;
  }

  private readOrigins(): string[] {
    const raw = process.env.COLLAB_ALLOWED_ORIGINS || "http://localhost:4512";
    const origins = raw
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);

    if (origins.length === 0) {
      throw new Error("COLLAB_ALLOWED_ORIGINS must contain at least one origin");
    }

    if (process.env.NODE_ENV === "production" && origins.includes("*")) {
      throw new Error("COLLAB_ALLOWED_ORIGINS must not contain * in production");
    }

    return origins;
  }

  private readLogLevel() {
    const value = process.env.COLLAB_LOG_LEVEL?.trim().toLowerCase() || "info";
    const allowed = ["silent", "fatal", "error", "warn", "info", "debug", "verbose"] as const;

    if (!allowed.includes(value as (typeof allowed)[number])) {
      throw new Error(`COLLAB_LOG_LEVEL must be one of: ${allowed.join(", ")}`);
    }

    return value as (typeof allowed)[number];
  }

  private readLogFormat() {
    const value = process.env.COLLAB_LOG_FORMAT?.trim().toLowerCase() || "auto";
    const allowed = ["auto", "json", "pretty"] as const;

    if (!allowed.includes(value as (typeof allowed)[number])) {
      throw new Error(`COLLAB_LOG_FORMAT must be one of: ${allowed.join(", ")}`);
    }

    return value as (typeof allowed)[number];
  }

  private readPersistenceDriver() {
    const value = process.env.COLLAB_PERSISTENCE_DRIVER?.trim().toLowerCase() || "postgres";
    const allowed = ["postgres"] as const;

    if (!allowed.includes(value as (typeof allowed)[number])) {
      throw new Error("COLLAB_PERSISTENCE_DRIVER must be postgres");
    }

    return value as (typeof allowed)[number];
  }
}
