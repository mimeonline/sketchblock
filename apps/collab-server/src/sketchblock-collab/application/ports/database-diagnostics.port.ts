export type DatabaseDiagnostics = {
  reachable: boolean;
  schemaVersion: string | null;
  migrationStatus: "aktuell" | "ausstehend" | "fehlerhaft";
  latestSuccessfulMigration: {
    version: string | null;
    description: string | null;
    installedAt: string | null;
  } | null;
  errorCode?: "database_unavailable";
};

export abstract class DatabaseDiagnosticsPort {
  abstract inspect(): Promise<DatabaseDiagnostics>;
}
