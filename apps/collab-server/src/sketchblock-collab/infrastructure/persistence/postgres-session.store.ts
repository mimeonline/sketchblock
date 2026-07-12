import { Injectable } from "@nestjs/common";
import type { Pool, PoolClient, QueryResultRow } from "pg";

import type {
  CanvasUpdatePayload,
  JoinSessionPayload,
  SessionAuditEvent,
  SessionSnapshot,
  StoredSession,
} from "../../application/dtos/collab-schemas.js";
import { SessionStorePort } from "../../application/ports/session-store.port.js";
import type { SessionLifecycleStatus } from "../../domain/types/session-lifecycle-status.js";
import { CollabConfigService } from "../../../shared/infrastructure/config/collab-config.service.js";
import { createCollabPostgresPool } from "../../../shared/infrastructure/database/postgres.js";
import { StructuredLoggerService } from "../../../shared/infrastructure/logging/structured-logger.service.js";

type SessionRow = QueryResultRow & {
  session_id: string;
  drawing_path: string | null;
  status: SessionLifecycleStatus;
  created_at: Date | string;
  updated_at: Date | string;
  snapshot_revision: number | null;
  snapshot_content: unknown | null;
  snapshot_updated_at: Date | string | null;
  snapshot_updated_by: string | null;
  yjs_state_base64: string | null;
  yjs_revision: number;
  yjs_updated_at: Date | string | null;
  yjs_updated_by: string | null;
};

type AuditRow = QueryResultRow & {
  id: string;
  event_type: SessionAuditEvent["type"];
  at: Date | string;
  actor: string;
  message: string;
  metadata: Record<string, unknown> | null;
};

@Injectable()
export class PostgresSessionStore extends SessionStorePort {
  private readonly pool: Pool;

  constructor(
    config: CollabConfigService,
    private readonly logger: StructuredLoggerService,
  ) {
    super();
    this.pool = createCollabPostgresPool(config);
  }

  async getOrCreateSession(input: JoinSessionPayload): Promise<StoredSession> {
    return this.withTransaction(async (client) => {
      const existing = await this.getSessionWithClient(client, input.sessionId);
      const now = new Date().toISOString();

      if (existing) {
        const shouldInitializeSnapshot = !existing.snapshot && input.initialContent !== undefined;
        const snapshot = shouldInitializeSnapshot
          ? {
              revision: 1,
              content: input.initialContent,
              updatedAt: now,
              updatedBy: "github",
            }
          : null;

        const result = await client.query<SessionRow>(
          `
            UPDATE collab_sessions
            SET drawing_path = COALESCE(drawing_path, $2),
                status = COALESCE(status, 'active'),
                updated_at = $3,
                snapshot_revision = COALESCE(snapshot_revision, $4),
                snapshot_content = COALESCE(snapshot_content, $5::jsonb),
                snapshot_updated_at = COALESCE(snapshot_updated_at, $6),
                snapshot_updated_by = COALESCE(snapshot_updated_by, $7)
            WHERE session_id = $1
            RETURNING *
          `,
          [
            input.sessionId,
            input.drawingPath || null,
            now,
            snapshot?.revision || null,
            snapshot ? JSON.stringify(snapshot.content) : null,
            snapshot?.updatedAt || null,
            snapshot?.updatedBy || null,
          ],
        );

        await this.insertAudit(client, input.sessionId, existing.audit.length, {
          type: "session_joined",
          actor: input.userId,
          message: `${input.displayName || input.userId} joined the session.`,
          metadata: {
            displayName: input.displayName || input.userId,
          },
        });

        return this.rowToStoredSession(result.rows[0], await this.listAudit(client, input.sessionId));
      }

      const snapshotRevision = input.initialContent === undefined ? null : 1;
      await client.query(
        `
          INSERT INTO collab_sessions (
            session_id,
            drawing_path,
            status,
            created_at,
            updated_at,
            snapshot_revision,
            snapshot_content,
            snapshot_updated_at,
            snapshot_updated_by
          )
          VALUES ($1, $2, 'active', $3, $3, $4, $5::jsonb, $6, $7)
        `,
        [
          input.sessionId,
          input.drawingPath || null,
          now,
          snapshotRevision,
          input.initialContent === undefined ? null : JSON.stringify(input.initialContent),
          snapshotRevision ? now : null,
          snapshotRevision ? "github" : null,
        ],
      );

      await this.insertAudit(client, input.sessionId, 0, {
        type: "session_created",
        actor: input.userId,
        message: `Session created for ${input.drawingPath || "unknown drawing"}.`,
      });

      const created = await this.selectSession(client, input.sessionId);
      return this.rowToStoredSession(created, await this.listAudit(client, input.sessionId));
    });
  }

  async upsertSnapshot(input: CanvasUpdatePayload, drawingPath: string | null): Promise<SessionSnapshot> {
    return this.withTransaction(async (client) => {
      const current = await this.getSessionWithClient(client, input.sessionId);
      const now = new Date().toISOString();
      const revision = (current?.snapshot?.revision || 0) + 1;

      await client.query(
        `
          INSERT INTO collab_sessions (
            session_id,
            drawing_path,
            status,
            created_at,
            updated_at,
            snapshot_revision,
            snapshot_content,
            snapshot_updated_at,
            snapshot_updated_by,
            yjs_state_base64,
            yjs_revision,
            yjs_updated_at,
            yjs_updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $5, $8, $9, $10, $11, $12)
          ON CONFLICT (session_id) DO UPDATE
          SET drawing_path = EXCLUDED.drawing_path,
              updated_at = EXCLUDED.updated_at,
              snapshot_revision = EXCLUDED.snapshot_revision,
              snapshot_content = EXCLUDED.snapshot_content,
              snapshot_updated_at = EXCLUDED.snapshot_updated_at,
              snapshot_updated_by = EXCLUDED.snapshot_updated_by
        `,
        [
          input.sessionId,
          drawingPath,
          current?.status || "active",
          current?.createdAt || now,
          now,
          revision,
          JSON.stringify(input.content),
          input.updatedBy,
          current?.yjsStateBase64 || null,
          current?.yjsRevision || 0,
          current?.yjsUpdatedAt || null,
          current?.yjsUpdatedBy || null,
        ],
      );

      await this.insertAudit(client, input.sessionId, current?.audit.length || 0, {
        type: "snapshot_updated",
        actor: input.updatedBy,
        message: `Snapshot revision ${revision} updated.`,
        metadata: { revision },
      });

      return {
        sessionId: input.sessionId,
        drawingPath,
        revision,
        content: input.content,
        updatedAt: now,
        updatedBy: input.updatedBy,
      };
    });
  }

  async upsertYjsState(input: { sessionId: string; stateBase64: string; updatedBy: string }): Promise<StoredSession> {
    return this.withTransaction(async (client) => {
      const current = await this.getSessionWithClient(client, input.sessionId);
      const now = new Date().toISOString();
      const revision = (current?.yjsRevision || 0) + 1;

      await client.query(
        `
          INSERT INTO collab_sessions (
            session_id,
            drawing_path,
            status,
            created_at,
            updated_at,
            snapshot_revision,
            snapshot_content,
            snapshot_updated_at,
            snapshot_updated_by,
            yjs_state_base64,
            yjs_revision,
            yjs_updated_at,
            yjs_updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $5, $12)
          ON CONFLICT (session_id) DO UPDATE
          SET updated_at = EXCLUDED.updated_at,
              yjs_state_base64 = EXCLUDED.yjs_state_base64,
              yjs_revision = EXCLUDED.yjs_revision,
              yjs_updated_at = EXCLUDED.yjs_updated_at,
              yjs_updated_by = EXCLUDED.yjs_updated_by
        `,
        [
          input.sessionId,
          current?.drawingPath || null,
          current?.status || "active",
          current?.createdAt || now,
          now,
          current?.snapshot?.revision || null,
          current?.snapshot ? JSON.stringify(current.snapshot.content) : null,
          current?.snapshot?.updatedAt || null,
          current?.snapshot?.updatedBy || null,
          input.stateBase64,
          revision,
          input.updatedBy,
        ],
      );

      await this.insertAudit(client, input.sessionId, current?.audit.length || 0, {
        type: "yjs_updated",
        actor: input.updatedBy,
        message: `Yjs state revision ${revision} updated.`,
        metadata: { revision },
      });

      const session = await this.selectSession(client, input.sessionId);
      return this.rowToStoredSession(session, await this.listAudit(client, input.sessionId));
    });
  }

  async updateSessionStatus(input: {
    sessionId: string;
    status: SessionLifecycleStatus;
    updatedBy: string;
    message?: string;
  }): Promise<StoredSession | null> {
    return this.withTransaction(async (client) => {
      const current = await this.getSessionWithClient(client, input.sessionId);
      if (!current) {
        return null;
      }

      const now = new Date().toISOString();
      const result = await client.query<SessionRow>(
        "UPDATE collab_sessions SET status = $2, updated_at = $3 WHERE session_id = $1 RETURNING *",
        [input.sessionId, input.status, now],
      );

      await this.insertAudit(client, input.sessionId, current.audit.length, {
        type: input.status === "closed" ? "session_closed" : "session_status_changed",
        actor: input.updatedBy,
        message: input.message || `Session status changed to ${input.status}.`,
        metadata: { status: input.status },
      });

      return this.rowToStoredSession(result.rows[0], await this.listAudit(client, input.sessionId));
    });
  }

  async appendSessionAudit(sessionId: string, event: Omit<SessionAuditEvent, "id" | "at">): Promise<StoredSession | null> {
    return this.withTransaction(async (client) => {
      const current = await this.getSessionWithClient(client, sessionId);
      if (!current) {
        return null;
      }

      await client.query("UPDATE collab_sessions SET updated_at = $2 WHERE session_id = $1", [
        sessionId,
        new Date().toISOString(),
      ]);
      await this.insertAudit(client, sessionId, current.audit.length, event);

      const session = await this.selectSession(client, sessionId);
      return this.rowToStoredSession(session, await this.listAudit(client, sessionId));
    });
  }

  async getSession(sessionId: string): Promise<StoredSession | null> {
    return this.withClient(async (client) => this.getSessionWithClient(client, sessionId));
  }

  async countSessions(): Promise<number> {
    const result = await this.pool.query<{ count: string }>("SELECT count(*) AS count FROM collab_sessions");
    return Number.parseInt(result.rows[0]?.count || "0", 10);
  }

  async deleteSession(sessionId: string): Promise<StoredSession | null> {
    return this.withTransaction(async (client) => {
      const current = await this.getSessionWithClient(client, sessionId);
      if (!current) {
        return null;
      }

      await client.query("DELETE FROM collab_sessions WHERE session_id = $1", [sessionId]);
      return current;
    });
  }

  private async getSessionWithClient(client: PoolClient, sessionId: string): Promise<StoredSession | null> {
    const result = await client.query<SessionRow>("SELECT * FROM collab_sessions WHERE session_id = $1", [sessionId]);
    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return this.rowToStoredSession(row, await this.listAudit(client, sessionId));
  }

  private async selectSession(client: PoolClient, sessionId: string): Promise<SessionRow> {
    const result = await client.query<SessionRow>("SELECT * FROM collab_sessions WHERE session_id = $1", [sessionId]);
    if (!result.rows[0]) {
      throw new Error(`Session ${sessionId} was not persisted`);
    }

    return result.rows[0];
  }

  private async listAudit(client: PoolClient, sessionId: string): Promise<SessionAuditEvent[]> {
    const result = await client.query<AuditRow>(
      `
        SELECT id, event_type, at, actor, message, metadata
        FROM collab_session_audit_events
        WHERE session_id = $1
        ORDER BY at ASC, id ASC
      `,
      [sessionId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      type: row.event_type,
      at: this.toIso(row.at),
      actor: row.actor,
      message: row.message,
      metadata: row.metadata || undefined,
    }));
  }

  private async insertAudit(
    client: PoolClient,
    sessionId: string,
    currentLength: number,
    event: Omit<SessionAuditEvent, "id" | "at">,
  ) {
    const at = new Date().toISOString();
    await client.query(
      `
        INSERT INTO collab_session_audit_events (id, session_id, event_type, at, actor, message, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      `,
      [
        `${Date.now()}-${currentLength + 1}`,
        sessionId,
        event.type,
        at,
        event.actor,
        event.message,
        event.metadata ? JSON.stringify(event.metadata) : null,
      ],
    );
  }

  private rowToStoredSession(row: SessionRow, audit: SessionAuditEvent[]): StoredSession {
    return {
      sessionId: row.session_id,
      drawingPath: row.drawing_path,
      status: row.status,
      createdAt: this.toIso(row.created_at),
      updatedAt: this.toIso(row.updated_at),
      snapshot:
        row.snapshot_revision === null
          ? null
          : {
              sessionId: row.session_id,
              drawingPath: row.drawing_path,
              revision: row.snapshot_revision,
              content: row.snapshot_content,
              updatedAt: this.toIso(row.snapshot_updated_at),
              updatedBy: row.snapshot_updated_by || "unknown",
            },
      yjsStateBase64: row.yjs_state_base64,
      yjsRevision: row.yjs_revision,
      yjsUpdatedAt: row.yjs_updated_at ? this.toIso(row.yjs_updated_at) : null,
      yjsUpdatedBy: row.yjs_updated_by,
      audit,
    };
  }

  private toIso(value: Date | string | null): string {
    if (!value) {
      return new Date(0).toISOString();
    }

    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  }

  private async withClient<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      return await callback(client);
    } catch (error) {
      this.logger.errorEvent("collab.persistence.postgres.failed", { error });
      throw error;
    } finally {
      client.release();
    }
  }

  private async withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    return this.withClient(async (client) => {
      await client.query("BEGIN");
      try {
        const result = await callback(client);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    });
  }
}
