import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { Pool, type QueryResultRow } from "pg";

import { DatabaseDiagnosticsPort, type DatabaseDiagnostics } from "../../application/ports/database-diagnostics.port.js";
import { CollabConfigService } from "../../../shared/infrastructure/config/collab-config.service.js";
import { createCollabPostgresPool } from "../../../shared/infrastructure/database/postgres.js";

const EXPECTED_SCHEMA_VERSION = 1;

type MigrationRow = QueryResultRow & {
  version: string | null;
  description: string | null;
  installed_on: Date | string | null;
};

@Injectable()
export class PostgresDatabaseDiagnosticsAdapter extends DatabaseDiagnosticsPort implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(config: CollabConfigService) {
    super();
    this.pool = createCollabPostgresPool(config);
  }

  async inspect(): Promise<DatabaseDiagnostics> {
    try {
      await this.pool.query("SELECT 1 AS ok");
      const result = await this.pool.query<MigrationRow>(`
        SELECT version, description, installed_on
        FROM flyway_schema_history
        WHERE success = true AND version IS NOT NULL
        ORDER BY installed_rank DESC
        LIMIT 1
      `);
      const latest = result.rows[0];
      const installedVersion = Number.parseInt(latest?.version || "0", 10);
      return {
        reachable: true,
        schemaVersion: latest?.version ?? null,
        migrationStatus: installedVersion >= EXPECTED_SCHEMA_VERSION ? "aktuell" : "ausstehend",
        latestSuccessfulMigration: latest ? {
          version: latest.version,
          description: latest.description,
          installedAt: latest.installed_on ? new Date(latest.installed_on).toISOString() : null,
        } : null,
      };
    } catch {
      return {
        reachable: false,
        schemaVersion: null,
        migrationStatus: "fehlerhaft",
        latestSuccessfulMigration: null,
        errorCode: "database_unavailable",
      };
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
