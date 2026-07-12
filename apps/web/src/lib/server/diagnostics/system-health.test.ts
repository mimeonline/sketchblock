import { describe, expect, it } from "vitest";

import { summarizeSystemHealth } from "./system-health";

describe("summarizeSystemHealth", () => {
  it("meldet eine betriebsbereite Instanz, wenn alle erforderlichen Dienste gesund sind", () => {
    expect(summarizeSystemHealth({
      webApp: { status: "ok" },
      databases: {
        app: { reachable: true, migrationStatus: "aktuell" },
        collab: { reachable: null, migrationStatus: "nicht_konfiguriert" },
      },
      collabServer: { reachable: true },
    })).toEqual({ status: "operational", label: "System betriebsbereit", affectedServices: 0 });
  });

  it("zählt eingeschränkte Dienste", () => {
    expect(summarizeSystemHealth({
      webApp: { status: "ok" },
      databases: {
        app: { reachable: false, migrationStatus: "fehlerhaft" },
        collab: { reachable: true, migrationStatus: "aktuell" },
      },
      collabServer: { reachable: false },
    })).toEqual({ status: "degraded", label: "2 Dienste eingeschränkt", affectedServices: 2 });
  });
});
