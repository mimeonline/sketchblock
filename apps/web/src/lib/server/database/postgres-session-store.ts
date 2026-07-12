import "server-only";

import type { QueryResultRow } from "pg";

import type { CollaborationSession, CollaborationSessionSnapshot, SessionLifecycleStatus } from "@/types/sketchblock";
import { getAppPostgresPool } from "@/lib/server/database/postgres";

type SessionRow = QueryResultRow & {
  id: string;
  repository_id: string;
  drawing_path: string;
  status: SessionLifecycleStatus;
  created_at: Date | string;
  updated_at: Date | string;
  created_by_user_id: string | null;
};

type SnapshotRow = QueryResultRow & {
  session_id: string;
  drawing_path: string;
  revision: number;
  content: unknown;
  updated_at: Date | string;
  updated_by: string;
};

export async function listPostgresSessions(userId: string | null, repositoryId?: string): Promise<CollaborationSession[]> {
  const conditions: string[] = [];
  const values: string[] = [];
  if (userId) {
    values.push(userId);
    conditions.push(`created_by_user_id = $${values.length}`);
  }
  if (repositoryId) {
    values.push(repositoryId);
    conditions.push(`repository_id = $${values.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await getAppPostgresPool().query<SessionRow>(
    `SELECT * FROM app_sessions ${where} ORDER BY updated_at DESC, created_at DESC`,
    values,
  );
  return result.rows.map(rowToSession);
}

export async function createPostgresSession(
  repositoryId: string,
  drawingPath: string,
  ownerId: string | null,
): Promise<CollaborationSession> {
  const now = new Date().toISOString();
  const session: CollaborationSession = {
    id: Math.random().toString(36).slice(2, 12),
    repositoryId,
    drawingPath,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  await getAppPostgresPool().query(
    `
      INSERT INTO app_sessions (id, repository_id, drawing_path, status, created_at, updated_at, created_by_user_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [session.id, session.repositoryId, session.drawingPath, session.status, session.createdAt, session.updatedAt, ownerId],
  );

  return session;
}

export async function getPostgresSession(sessionId: string): Promise<CollaborationSession | null> {
  const result = await getAppPostgresPool().query<SessionRow>("SELECT * FROM app_sessions WHERE id = $1", [sessionId]);
  return result.rows[0] ? rowToSession(result.rows[0]) : null;
}

export async function getOwnedPostgresSession(sessionId: string, userId: string | null) {
  const result = userId
    ? await getAppPostgresPool().query<SessionRow>(
        "SELECT * FROM app_sessions WHERE id = $1 AND created_by_user_id = $2",
        [sessionId, userId],
      )
    : await getAppPostgresPool().query<SessionRow>("SELECT * FROM app_sessions WHERE id = $1", [sessionId]);
  return result.rows[0] ? rowToSession(result.rows[0]) : null;
}

export async function deletePostgresSession(sessionId: string, userId: string | null): Promise<CollaborationSession | null> {
  const pool = getAppPostgresPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = userId
      ? await client.query<SessionRow>("DELETE FROM app_sessions WHERE id = $1 AND created_by_user_id = $2 RETURNING *", [sessionId, userId])
      : await client.query<SessionRow>("DELETE FROM app_sessions WHERE id = $1 RETURNING *", [sessionId]);
    await client.query("COMMIT");
    return result.rows[0] ? rowToSession(result.rows[0]) : null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updatePostgresSessionStatus(
  sessionId: string,
  status: SessionLifecycleStatus,
  userId: string | null,
): Promise<CollaborationSession | null> {
  const result = userId ? await getAppPostgresPool().query<SessionRow>(
    `
      UPDATE app_sessions
      SET status = $2,
          updated_at = $3
      WHERE id = $1 AND created_by_user_id = $4
      RETURNING *
    `,
    [sessionId, status, new Date().toISOString(), userId],
  ) : await getAppPostgresPool().query<SessionRow>(
    "UPDATE app_sessions SET status = $2, updated_at = $3 WHERE id = $1 RETURNING *",
    [sessionId, status, new Date().toISOString()],
  );

  return result.rows[0] ? rowToSession(result.rows[0]) : null;
}

export async function getPostgresSessionSnapshot(sessionId: string): Promise<CollaborationSessionSnapshot | null> {
  const result = await getAppPostgresPool().query<SnapshotRow>(
    "SELECT * FROM app_session_snapshots WHERE session_id = $1",
    [sessionId],
  );
  return result.rows[0] ? rowToSnapshot(result.rows[0]) : null;
}

export async function upsertPostgresSessionSnapshot(input: {
  sessionId: string;
  drawingPath: string;
  content: unknown;
  updatedBy: string;
  revision?: number;
}): Promise<CollaborationSessionSnapshot> {
  const current = await getPostgresSessionSnapshot(input.sessionId);
  const snapshot: CollaborationSessionSnapshot = {
    sessionId: input.sessionId,
    drawingPath: input.drawingPath,
    revision: input.revision ?? (current?.revision || 0) + 1,
    content: input.content,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy,
  };

  await getAppPostgresPool().query(
    `
      INSERT INTO app_session_snapshots (session_id, drawing_path, revision, content, updated_at, updated_by)
      VALUES ($1, $2, $3, $4::jsonb, $5, $6)
      ON CONFLICT (session_id) DO UPDATE
      SET drawing_path = EXCLUDED.drawing_path,
          revision = EXCLUDED.revision,
          content = EXCLUDED.content,
          updated_at = EXCLUDED.updated_at,
          updated_by = EXCLUDED.updated_by
    `,
    [
      snapshot.sessionId,
      snapshot.drawingPath,
      snapshot.revision,
      JSON.stringify(snapshot.content),
      snapshot.updatedAt,
      snapshot.updatedBy,
    ],
  );

  return snapshot;
}

function rowToSession(row: SessionRow): CollaborationSession {
  return {
    id: row.id,
    repositoryId: row.repository_id,
    drawingPath: row.drawing_path,
    status: row.status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function rowToSnapshot(row: SnapshotRow): CollaborationSessionSnapshot {
  return {
    sessionId: row.session_id,
    drawingPath: row.drawing_path,
    revision: row.revision,
    content: row.content,
    updatedAt: toIso(row.updated_at),
    updatedBy: row.updated_by,
  };
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
