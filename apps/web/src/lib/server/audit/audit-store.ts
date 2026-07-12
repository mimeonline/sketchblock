import "server-only";

import { randomUUID } from "node:crypto";

import { getAppPostgresPool } from "@/lib/server/database/postgres";
import type { AuditEvent, AuditEventFilter, AuditEventInput } from "./audit-types";

type AuditRow = {
  id: string;
  occurred_at: Date | string;
  actor_id: string | null;
  actor_username: string;
  actor_role: AuditEvent["actorRole"];
  action: string;
  target_type: string;
  target_id: string | null;
  outcome: AuditEvent["outcome"];
  metadata: Record<string, unknown>;
  request_id: string | null;
  session_id: string | null;
};

export async function insertAuditEvent(input: AuditEventInput): Promise<AuditEvent> {
  const id = randomUUID();
  const result = await getAppPostgresPool().query<AuditRow>(
    `INSERT INTO app_audit_events (
       id, actor_id, actor_username, actor_role, action, target_type, target_id,
       outcome, metadata, request_id, session_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
     RETURNING *`,
    [id, input.actorId ?? null, input.actorUsername, input.actorRole, input.action,
      input.targetType, input.targetId ?? null, input.outcome, JSON.stringify(input.metadata ?? {}),
      input.requestId ?? null, input.sessionId ?? null],
  );
  return mapRow(result.rows[0]);
}

export async function findAuditEvents(filter: AuditEventFilter): Promise<{ events: AuditEvent[]; total: number }> {
  const clauses: string[] = [];
  const values: unknown[] = [];
  const add = (clause: string, value: unknown) => {
    values.push(value);
    clauses.push(clause.replace("?", `$${values.length}`));
  };
  if (filter.actorId) add("actor_id = ?", filter.actorId);
  if (filter.action) add("action = ?", filter.action);
  if (filter.outcome) add("outcome = ?", filter.outcome);
  if (filter.from) add("occurred_at >= ?", filter.from);
  if (filter.to) add("occurred_at <= ?", filter.to);
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const count = await getAppPostgresPool().query<{ count: string }>(
    `SELECT count(*)::text AS count FROM app_audit_events ${where}`,
    values,
  );
  values.push(filter.limit, filter.offset);
  const rows = await getAppPostgresPool().query<AuditRow>(
    `SELECT * FROM app_audit_events ${where}
     ORDER BY occurred_at DESC, id DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  return { events: rows.rows.map(mapRow), total: Number(count.rows[0]?.count ?? 0) };
}

function mapRow(row: AuditRow): AuditEvent {
  return {
    id: row.id,
    occurredAt: new Date(row.occurred_at).toISOString(),
    actorId: row.actor_id,
    actorUsername: row.actor_username,
    actorRole: row.actor_role,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    outcome: row.outcome,
    metadata: row.metadata ?? {},
    requestId: row.request_id,
    sessionId: row.session_id,
  };
}
