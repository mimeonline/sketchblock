import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();
const end = vi.fn();

vi.mock("../../../shared/infrastructure/database/postgres.js", () => ({
  createCollabPostgresPool: () => ({ query, end }),
}));

import { PostgresDatabaseDiagnosticsAdapter } from "./postgres-database-diagnostics.adapter.js";

describe("PostgresDatabaseDiagnosticsAdapter", () => {
  beforeEach(() => {
    query.mockReset();
    end.mockReset();
  });

  it("liefert ausschließlich sichere Schema- und Migrationsdaten", async () => {
    query.mockResolvedValueOnce({ rows: [{ ok: 1 }] });
    query.mockResolvedValueOnce({ rows: [{ version: "1", description: "collab persistence base", installed_on: new Date("2026-07-12T08:00:00Z") }] });
    const adapter = new PostgresDatabaseDiagnosticsAdapter({} as never);

    await expect(adapter.inspect()).resolves.toEqual({
      reachable: true,
      schemaVersion: "1",
      migrationStatus: "aktuell",
      latestSuccessfulMigration: {
        version: "1",
        description: "collab persistence base",
        installedAt: "2026-07-12T08:00:00.000Z",
      },
    });
  });

  it("reduziert Datenbankfehler auf einen sicheren Fehlercode", async () => {
    query.mockRejectedValueOnce(new Error("connection string must not leak"));
    const adapter = new PostgresDatabaseDiagnosticsAdapter({} as never);

    await expect(adapter.inspect()).resolves.toEqual({
      reachable: false,
      schemaVersion: null,
      migrationStatus: "fehlerhaft",
      latestSuccessfulMigration: null,
      errorCode: "database_unavailable",
    });
  });
});
