import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { QueryResultRow } from "pg";

import { decryptSecret, encryptSecret } from "@/lib/server/auth/crypto";
import { getAppPostgresPool } from "@/lib/server/database/postgres";
import type { SessionRole } from "@/types/sketchblock";

type InviteRole = Exclude<SessionRole, "owner">;

type InviteRow = QueryResultRow & {
  id: string;
  session_id: string;
  role: InviteRole;
  token_hash: string;
  token_ciphertext: string;
  expires_at: Date | string | null;
  revoked_at: Date | string | null;
  created_at: Date | string;
};

export type SessionInvite = {
  id: string;
  sessionId: string;
  role: InviteRole;
  token: string;
  expiresAt: string | null;
};

export type SessionParticipant = {
  sessionId: string;
  githubUserId: number;
  githubLogin: string;
  displayName: string;
  avatarUrl: string | null;
  assignedRole: InviteRole;
  firstJoinedAt: string;
  lastJoinedAt: string;
};

type ParticipantRow = QueryResultRow & {
  session_id: string;
  github_user_id: string | number;
  github_login: string;
  display_name: string;
  avatar_url: string | null;
  assigned_role: InviteRole;
  first_joined_at: Date | string;
  last_joined_at: Date | string;
};

export async function ensureSessionInvites(sessionId: string, ownerId: string | null) {
  await getAppPostgresPool().query(
    `
      UPDATE app_session_invites
      SET revoked_at = now()
      WHERE session_id = $1
        AND revoked_at IS NULL
        AND expires_at IS NOT NULL
        AND expires_at <= now()
    `,
    [sessionId],
  );
  const existing = await listActiveInvites(sessionId);
  const roles: InviteRole[] = ["collaborator", "viewer"];
  const invites = [...existing];

  for (const role of roles) {
    if (!invites.some((invite) => invite.role === role)) {
      const created = await createInvite(sessionId, role, ownerId);
      if (created) invites.push(created);
    }
  }

  const collaborator = invites.find((invite) => invite.role === "collaborator");
  const viewer = invites.find((invite) => invite.role === "viewer");
  if (!collaborator || !viewer) {
    throw new Error("Could not provision both session invitation roles.");
  }
  return { collaborator, viewer };
}

export async function validateSessionInvite(sessionId: string, token: string) {
  if (!token || token.length > 256) return null;
  const result = await getAppPostgresPool().query<InviteRow>(
    `
      SELECT *
      FROM app_session_invites
      WHERE session_id = $1
        AND token_hash = $2
        AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > now())
      LIMIT 1
    `,
    [sessionId, hashToken(token)],
  );
  return result.rows[0] ? rowToInvite(result.rows[0]) : null;
}

export async function recordSessionParticipant(input: {
  sessionId: string;
  role: InviteRole;
  githubUserId: number;
  githubLogin: string;
  displayName: string;
  avatarUrl?: string | null;
}) {
  await getAppPostgresPool().query(
    `
      INSERT INTO app_session_participants (
        session_id, github_user_id, github_login, display_name, avatar_url, assigned_role
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (session_id, github_user_id) DO UPDATE
      SET github_login = EXCLUDED.github_login,
          display_name = EXCLUDED.display_name,
          avatar_url = EXCLUDED.avatar_url,
          assigned_role = EXCLUDED.assigned_role,
          last_joined_at = now()
    `,
    [input.sessionId, input.githubUserId, input.githubLogin, input.displayName, input.avatarUrl || null, input.role],
  );
}

export async function listSessionParticipants(sessionIds?: string[]) {
  const result = sessionIds?.length
    ? await getAppPostgresPool().query<ParticipantRow>(
        "SELECT * FROM app_session_participants WHERE session_id = ANY($1::text[]) ORDER BY last_joined_at DESC",
        [sessionIds],
      )
    : await getAppPostgresPool().query<ParticipantRow>(
        "SELECT * FROM app_session_participants ORDER BY last_joined_at DESC",
      );
  return result.rows.map(rowToParticipant);
}

async function listActiveInvites(sessionId: string) {
  const result = await getAppPostgresPool().query<InviteRow>(
    `
      SELECT *
      FROM app_session_invites
      WHERE session_id = $1
        AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > now())
      ORDER BY created_at ASC
    `,
    [sessionId],
  );
  return result.rows.map(rowToInvite).filter((invite): invite is SessionInvite => Boolean(invite));
}

async function createInvite(sessionId: string, role: InviteRole, ownerId: string | null) {
  const token = randomBytes(32).toString("base64url");
  const ttlHours = Number.parseInt(process.env.SKETCHBLOCK_SESSION_INVITE_TTL_HOURS || "168", 10);
  const expiresAt = Number.isFinite(ttlHours) && ttlHours > 0
    ? new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString()
    : null;
  const result = await getAppPostgresPool().query<InviteRow>(
    `
      INSERT INTO app_session_invites (
        id, session_id, role, token_hash, token_ciphertext, expires_at, created_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT DO NOTHING
      RETURNING *
    `,
    [randomUUID(), sessionId, role, hashToken(token), encryptSecret(token), expiresAt, ownerId],
  );

  if (!result.rows[0]) {
    return (await listActiveInvites(sessionId)).find((invite) => invite.role === role) || null;
  }
  return rowToInvite(result.rows[0]);
}

function rowToInvite(row: InviteRow): SessionInvite | null {
  const token = decryptSecret(row.token_ciphertext);
  if (!token) return null;
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    token,
    expiresAt: row.expires_at ? toIso(row.expires_at) : null,
  };
}

function rowToParticipant(row: ParticipantRow): SessionParticipant {
  return {
    sessionId: row.session_id,
    githubUserId: Number(row.github_user_id),
    githubLogin: row.github_login,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    assignedRole: row.assigned_role,
    firstJoinedAt: toIso(row.first_joined_at),
    lastJoinedAt: toIso(row.last_joined_at),
  };
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
