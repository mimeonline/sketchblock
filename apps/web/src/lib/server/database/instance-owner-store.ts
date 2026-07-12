import "server-only";

import type { QueryResultRow } from "pg";

import { getAppPostgresPool } from "@/lib/server/database/postgres";
import { createAppUser } from "@/lib/server/database/user-store";

export type InstanceOwner = {
  id: string;
  username: string;
  passwordHash: string;
  githubUserId: number | null;
  githubLogin: string | null;
  githubName: string | null;
  githubAvatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

type InstanceOwnerRow = QueryResultRow & {
  id: string;
  username: string;
  password_hash: string;
  github_user_id: string | number | null;
  github_login: string | null;
  github_name: string | null;
  github_avatar_url: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  last_login_at: Date | string | null;
};

export async function hasInstanceOwner() {
  const result = await getAppPostgresPool().query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM app_instance_owners) AS exists",
  );
  return Boolean(result.rows[0]?.exists);
}

export async function createInstanceOwner(input: { id: string; username: string; passwordHash: string }) {
  const client = await getAppPostgresPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<InstanceOwnerRow>(
    `
      INSERT INTO app_instance_owners (id, username, password_hash)
      SELECT $1, $2, $3
      WHERE NOT EXISTS (SELECT 1 FROM app_instance_owners)
      RETURNING *
    `,
      [input.id, input.username, input.passwordHash],
    );
    if (!result.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }
    await createAppUser({ ...input, role: "instance_owner", mustChangePassword: false, client });
    await client.query("COMMIT");
    return rowToInstanceOwner(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getInstanceOwnerById(ownerId: string) {
  const result = await getAppPostgresPool().query<InstanceOwnerRow>(
    "SELECT * FROM app_instance_owners WHERE id = $1",
    [ownerId],
  );
  return result.rows[0] ? rowToInstanceOwner(result.rows[0]) : null;
}

export async function getInstanceOwnerByUsername(username: string) {
  const result = await getAppPostgresPool().query<InstanceOwnerRow>(
    "SELECT * FROM app_instance_owners WHERE lower(username) = lower($1)",
    [username],
  );
  return result.rows[0] ? rowToInstanceOwner(result.rows[0]) : null;
}

export async function markInstanceOwnerLogin(ownerId: string) {
  await getAppPostgresPool().query(
    "UPDATE app_instance_owners SET last_login_at = now(), updated_at = now() WHERE id = $1",
    [ownerId],
  );
}

export async function linkInstanceOwnerGitHub(
  ownerId: string,
  github: { id: number; login: string; name?: string | null; avatarUrl?: string | null },
) {
  const client = await getAppPostgresPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<InstanceOwnerRow>(
    `
      UPDATE app_instance_owners
      SET github_user_id = $2,
          github_login = $3,
          github_name = $4,
          github_avatar_url = $5,
          updated_at = now()
      WHERE id = $1
      RETURNING *
    `,
      [ownerId, github.id, github.login, github.name || null, github.avatarUrl || null],
    );
    if (result.rows[0]) {
      await client.query(`
        INSERT INTO app_user_github_identities (user_id, github_user_id, login, name, avatar_url, updated_at)
        VALUES ($1, $2, $3, $4, $5, now())
        ON CONFLICT (user_id) DO UPDATE SET
          github_user_id = EXCLUDED.github_user_id,
          login = EXCLUDED.login,
          name = EXCLUDED.name,
          avatar_url = EXCLUDED.avatar_url,
          updated_at = now()
      `, [ownerId, github.id, github.login, github.name || null, github.avatarUrl || null]);
    }
    await client.query("COMMIT");
    return result.rows[0] ? rowToInstanceOwner(result.rows[0]) : null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function rowToInstanceOwner(row: InstanceOwnerRow): InstanceOwner {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    githubUserId: row.github_user_id === null ? null : Number(row.github_user_id),
    githubLogin: row.github_login,
    githubName: row.github_name,
    githubAvatarUrl: row.github_avatar_url,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    lastLoginAt: row.last_login_at ? toIso(row.last_login_at) : null,
  };
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
