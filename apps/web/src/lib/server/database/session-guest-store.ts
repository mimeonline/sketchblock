import "server-only";

import { randomBytes } from "node:crypto";

import type { QueryResultRow } from "pg";

import { getAppPostgresPool } from "@/lib/server/database/postgres";

export type SessionGuest = {
  id: string;
  sessionId: string;
  inviteId: string;
  displayName: string;
  createdAt: string;
  lastSeenAt: string;
  removedAt: string | null;
};

type GuestRow = QueryResultRow & {
  id: string;
  session_id: string;
  invite_id: string;
  display_name: string;
  created_at: Date | string;
  last_seen_at: Date | string;
  removed_at: Date | string | null;
};

const toIso = (value: Date | string) => (value instanceof Date ? value.toISOString() : new Date(value).toISOString());

function rowToGuest(row: GuestRow): SessionGuest {
  return {
    id: row.id,
    sessionId: row.session_id,
    inviteId: row.invite_id,
    displayName: row.display_name,
    createdAt: toIso(row.created_at),
    lastSeenAt: toIso(row.last_seen_at),
    removedAt: row.removed_at ? toIso(row.removed_at) : null,
  };
}

export async function createSessionGuest(input: { sessionId: string; inviteId: string; displayName: string }) {
  const id = `g${randomBytes(9).toString("base64url")}`;
  const result = await getAppPostgresPool().query<GuestRow>(
    `
      INSERT INTO app_session_guests (id, session_id, invite_id, display_name)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [id, input.sessionId, input.inviteId, input.displayName],
  );
  return rowToGuest(result.rows[0]);
}

export async function getSessionGuest(sessionId: string, guestId: string) {
  const result = await getAppPostgresPool().query<GuestRow>(
    "SELECT * FROM app_session_guests WHERE session_id = $1 AND id = $2 LIMIT 1",
    [sessionId, guestId],
  );
  return result.rows[0] ? rowToGuest(result.rows[0]) : null;
}

export async function markGuestRemoved(sessionId: string, guestId: string) {
  const result = await getAppPostgresPool().query(
    "UPDATE app_session_guests SET removed_at = COALESCE(removed_at, now()) WHERE session_id = $1 AND id = $2",
    [sessionId, guestId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function touchSessionGuest(sessionId: string, guestId: string) {
  await getAppPostgresPool().query(
    "UPDATE app_session_guests SET last_seen_at = now() WHERE session_id = $1 AND id = $2",
    [sessionId, guestId],
  );
}
