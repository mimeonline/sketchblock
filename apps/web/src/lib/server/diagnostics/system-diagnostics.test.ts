import { beforeEach, describe, expect, it, vi } from "vitest";

const { appQuery, getCollabDatabaseDiagnostics } = vi.hoisted(() => ({
  appQuery: vi.fn(),
  getCollabDatabaseDiagnostics: vi.fn(),
}));
vi.mock("@/lib/server/database/postgres", () => ({ getAppPostgresPool: () => ({ query: appQuery }) }));
vi.mock("@/lib/server/collab/collab-server-client", () => ({ getCollabServerUrl: () => "http://collab.test", getCollabDatabaseDiagnostics }));

import { getSystemDiagnostics } from "./system-diagnostics";

describe("getSystemDiagnostics", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("SKETCHBLOCK_DEPLOYMENT_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SKETCHBLOCK_VERSION", "1.2.3");
    appQuery.mockReset();
    appQuery.mockResolvedValueOnce({ rows: [{ ok: 1 }] });
    appQuery.mockResolvedValueOnce({ rows: [{ version: "8", description: "public demo workspace", installed_on: new Date("2026-07-12T10:00:00Z") }] });
    getCollabDatabaseDiagnostics.mockReset();
    getCollabDatabaseDiagnostics.mockResolvedValue({ reachable: true, schemaVersion: "1", migrationStatus: "aktuell", latestSuccessfulMigration: { version: "1", description: "collab persistence base", installedAt: "2026-07-12T08:00:00.000Z" } });
  });

  it("returns a secret-free database and collab summary", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ service: "sketchblock-collab-server", status: "ok", transport: "socket.io" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sessions: { activePresenceSessions: 2, connectedClients: 4 }, config: { authSecret: "must-not-leak" } }) }));

    const result = await getSystemDiagnostics();
    expect(result.webApp).toMatchObject({ version: "1.2.3", deploymentEnvironment: "production" });
    expect(result.databases.app).toMatchObject({ reachable: true, schemaVersion: "8", migrationStatus: "aktuell" });
    expect(result.databases.collab).toMatchObject({ reachable: true, schemaVersion: "1", migrationStatus: "aktuell" });
    expect(result.collabServer).toMatchObject({ reachable: true, activeSessions: 2, connectedClients: 4 });
    expect(JSON.stringify(result)).not.toContain("must-not-leak");
    expect(JSON.stringify(result)).not.toContain("http://collab.test");
  });
});
