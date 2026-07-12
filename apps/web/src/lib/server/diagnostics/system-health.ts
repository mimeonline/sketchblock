import "server-only";

export type SystemHealthStatus = "operational" | "degraded" | "unknown";

type DiagnosticsInput = {
  webApp: { status: string };
  databases: Record<"app" | "collab", { reachable: boolean | null; migrationStatus: string }>;
  collabServer: { reachable: boolean };
};

export function summarizeSystemHealth(diagnostics: DiagnosticsInput) {
  const appReady = diagnostics.webApp.status === "ok"
    && diagnostics.databases.app.reachable === true
    && diagnostics.databases.app.migrationStatus === "aktuell";
  const collabDatabaseReady = diagnostics.databases.collab.reachable !== false
    && !["fehlerhaft", "ausstehend"].includes(diagnostics.databases.collab.migrationStatus);
  const collaborationReady = diagnostics.collabServer.reachable;

  if (appReady && collabDatabaseReady && collaborationReady) {
    return { status: "operational" as const, label: "System betriebsbereit", affectedServices: 0 };
  }

  const affectedServices = [appReady, collabDatabaseReady, collaborationReady].filter((ready) => !ready).length;
  return {
    status: affectedServices > 0 ? "degraded" as const : "unknown" as const,
    label: affectedServices === 1 ? "1 Dienst eingeschränkt" : `${affectedServices} Dienste eingeschränkt`,
    affectedServices,
  };
}
