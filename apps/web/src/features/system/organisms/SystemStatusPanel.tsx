"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Boxes, Database, LoaderCircle, RefreshCcw, ServerCog } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type ServiceState = "operational" | "degraded" | "unconfigured";

type Diagnostics = {
  checkedAt: string;
  webApp: { status: string; version: string; deploymentEnvironment: string; persistenceDriver: string; authMode: string; lastError?: string | null };
  databases: Record<"app" | "collab", { reachable: boolean | null; schemaVersion?: string | null; migrationStatus: string; errorCode?: string | null }>;
  collabServer: { reachable: boolean; service?: string | null; version?: string | null; transport?: string | null; websocketCapable?: boolean; activeSessions?: number | null; connectedClients?: number | null; lastSuccessfulCheck?: string | null; errorCode?: string | null };
};

type AuditEvent = {
  id: string; occurredAt: string; actorUsername: string; actorRole: string; action: string;
  targetType: string | null; targetId: string | null; outcome: "success" | "failure"; requestId: string | null;
};

export function SystemStatusPanel() {
  const t = useTranslations("System");
  const locale = useLocale();
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSystemData = useCallback(async function loadSystemData() {
    setLoading(true);
    setError(null);
    try {
      const [diagnosticsResponse, auditResponse] = await Promise.all([
        fetch("/api/admin/diagnostics", { cache: "no-store" }),
        fetch("/api/admin/audit?limit=50&offset=0", { cache: "no-store" }),
      ]);
      const diagnosticsPayload = (await diagnosticsResponse.json()) as { diagnostics?: Diagnostics; error?: string };
      const auditPayload = (await auditResponse.json()) as { events?: AuditEvent[]; error?: string };
      if (!diagnosticsResponse.ok) throw new Error(diagnosticsPayload.error || t("loadStatusFailed"));
      if (!auditResponse.ok) throw new Error(auditPayload.error || t("loadAuditFailed"));
      setDiagnostics(diagnosticsPayload.diagnostics || null);
      setEvents(auditPayload.events || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSystemData();
  }, [loadSystemData]);

  return (
    <div className="grid gap-8">
      <section className="grid gap-5" aria-labelledby="system-overview-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold" id="system-overview-heading">{t("state")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("stateDescription")}</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => void loadSystemData()} disabled={loading}>
            {loading ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <RefreshCcw data-icon="inline-start" />}
            {t("refresh")}
          </Button>
        </div>

        {error ? <Alert variant="destructive"><AlertTitle>{t("unavailable")}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}

        {diagnostics ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatusCard icon={Boxes} title="Web-App" state={diagnostics.webApp.status === "ok" ? "operational" : "degraded"} metric={diagnostics.webApp.version} description={t("webDescription")} rows={[[t("environment"), diagnostics.webApp.deploymentEnvironment], [t("authMode"), diagnostics.webApp.authMode], [t("lastError"), diagnostics.webApp.lastError || t("none")]]} />
            <StatusCard icon={Database} title={t("appDatabase")} state={databaseState(diagnostics.databases.app)} metric={reachableLabel(diagnostics.databases.app.reachable, t)} description={t("appDatabaseDescription")} rows={[[t("schema"), diagnostics.databases.app.schemaVersion || t("unknown")], [t("migration"), humanMigration(diagnostics.databases.app.migrationStatus, t)], [t("persistence"), diagnostics.webApp.persistenceDriver]]} />
            <StatusCard icon={Database} title={t("collabDatabase")} state={databaseState(diagnostics.databases.collab)} metric={reachableLabel(diagnostics.databases.collab.reachable, t)} description={t("collabDatabaseDescription")} rows={[[t("schema"), diagnostics.databases.collab.schemaVersion || t("unknown")], [t("migration"), humanMigration(diagnostics.databases.collab.migrationStatus, t)], [t("error"), diagnostics.databases.collab.errorCode || t("none")]]} />
            <StatusCard icon={ServerCog} title={t("collaboration")} state={diagnostics.collabServer.reachable ? "operational" : "degraded"} metric={diagnostics.collabServer.reachable ? t("reachable") : t("unreachable")} description={t("collaborationDescription")} rows={[[t("transport"), diagnostics.collabServer.transport || t("unknown")], [t("sessions"), String(diagnostics.collabServer.activeSessions ?? 0)], [t("clients"), String(diagnostics.collabServer.connectedClients ?? 0)]]} />
          </div>
        ) : !loading && !error ? <p className="text-sm text-muted-foreground">{t("noDiagnostics")}</p> : null}

        {diagnostics ? <p className="text-xs text-muted-foreground">{t("lastChecked", { time: formatDateTime(diagnostics.checkedAt, locale) })}</p> : null}
      </section>

      <section className="min-w-0" aria-labelledby="activity-heading">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground"><Activity className="size-4" aria-hidden="true" /></span>
          <div><h2 className="text-lg font-semibold" id="activity-heading">{t("activity")}</h2><p className="text-sm text-muted-foreground">{t("activityDescription")}</p></div>
        </div>
        <div className="overflow-x-auto rounded-xl border bg-background">
          <Table>
            <TableHeader><TableRow><TableHead>{t("time")}</TableHead><TableHead>{t("user")}</TableHead><TableHead>{t("activity")}</TableHead><TableHead>{t("target")}</TableHead><TableHead>{t("result")}</TableHead><TableHead>{t("requestId")}</TableHead></TableRow></TableHeader>
            <TableBody>
              {events.map((event) => <TableRow key={event.id}><TableCell className="whitespace-nowrap text-xs">{formatDateTime(event.occurredAt, locale)}</TableCell><TableCell><div className="font-medium">{event.actorUsername}</div><div className="text-xs text-muted-foreground">{roleLabel(event.actorRole, t)}</div></TableCell><TableCell><div className="font-medium">{event.action}</div></TableCell><TableCell className="max-w-64 truncate text-xs">{event.targetType || "–"}{event.targetId ? ` · ${event.targetId}` : ""}</TableCell><TableCell><Badge variant={event.outcome === "success" ? "outline" : "destructive"}>{event.outcome === "success" ? t("success") : t("failure")}</Badge></TableCell><TableCell className="font-mono text-xs text-muted-foreground">{event.requestId || "–"}</TableCell></TableRow>)}
              {!loading && events.length === 0 ? <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">{t("noActivity")}</TableCell></TableRow> : null}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

function StatusCard({ icon: Icon, title, state, metric, description, rows }: { icon: typeof Boxes; title: string; state: ServiceState; metric: string; description: string; rows: Array<[string, string]> }) {
  const t = useTranslations("System");
  const stateLabel = state === "operational" ? t("operational") : state === "unconfigured" ? t("unconfigured") : t("degraded");
  return <Card size="sm"><CardHeader><div className="mb-2 flex items-center justify-between gap-3"><span className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground"><Icon className="size-4" aria-hidden="true" /></span><Badge variant={state === "degraded" ? "destructive" : "outline"}><span className={cn("size-1.5 rounded-full", state === "operational" ? "bg-success" : state === "unconfigured" ? "bg-muted-foreground" : "bg-destructive")} />{stateLabel}</Badge></div><CardTitle as="h3">{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent><p className="mb-4 text-2xl font-semibold tracking-tight">{metric}</p><dl className="grid gap-2 border-t pt-3">{rows.map(([label, value]) => <div className="flex items-start justify-between gap-3 text-xs" key={label}><dt className="text-muted-foreground">{label}</dt><dd className="max-w-[60%] break-words text-right font-medium">{value}</dd></div>)}</dl></CardContent></Card>;
}

function databaseState(database: Diagnostics["databases"]["app"]): ServiceState {
  if (database.reachable === null) return "unconfigured";
  return database.reachable && database.migrationStatus === "aktuell" ? "operational" : "degraded";
}
function reachableLabel(reachable: boolean | null, t: ReturnType<typeof useTranslations>) { return reachable === null ? t("unconfigured") : reachable ? t("reachable") : t("unreachable"); }
function humanMigration(value: string, t: ReturnType<typeof useTranslations>) { return value === "aktuell" ? t("current") : value === "nicht_konfiguriert" ? t("unconfigured") : value === "ausstehend" ? t("pending") : t("faulty"); }
function roleLabel(value: string, t: ReturnType<typeof useTranslations>) { return value === "instance_owner" ? "Instance Owner" : value === "user" ? t("user") : value; }
function formatDateTime(value: string, locale: string) { return new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "medium" }).format(new Date(value)); }
