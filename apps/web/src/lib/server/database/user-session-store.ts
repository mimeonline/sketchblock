import "server-only";

import { createHash } from "node:crypto";
import type { PoolClient, QueryResultRow } from "pg";
import { getAppPostgresPool } from "@/lib/server/database/postgres";

type SessionRow = QueryResultRow & { id: string; user_id: string; expires_at: Date | string; revoked_at: Date | string | null };

export function hashUserSessionToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

export async function createUserSession(input: { id: string; userId: string; token: string; expiresAt: Date }) {
  await getAppPostgresPool().query(`
    INSERT INTO app_user_sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)
  `, [input.id, input.userId, hashUserSessionToken(input.token), input.expiresAt]);
}

export async function getActiveUserSession(id: string, token: string) {
  const result = await getAppPostgresPool().query<SessionRow>(`
    SELECT id, user_id, expires_at, revoked_at FROM app_user_sessions
    WHERE id = $1 AND token_hash = $2 AND revoked_at IS NULL AND expires_at > now()
  `, [id, hashUserSessionToken(token)]);
  return result.rows[0] ?? null;
}

export async function revokeUserSession(id: string) {
  await getAppPostgresPool().query(
    "UPDATE app_user_sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE id = $1", [id]);
}

export async function revokeAllUserSessions(userId: string, client?: PoolClient) {
  const executor = client ?? getAppPostgresPool();
  await executor.query(
    "UPDATE app_user_sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE user_id = $1 AND revoked_at IS NULL",
    [userId]);
}
