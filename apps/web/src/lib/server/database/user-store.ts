import "server-only";

import type { PoolClient, QueryResultRow } from "pg";

import { getAppPostgresPool } from "@/lib/server/database/postgres";

export type AppUserRole = "instance_owner" | "user";
export type AppUserStatus = "active" | "disabled";

export type AppUser = {
  id: string;
  username: string;
  displayName: string | null;
  passwordHash: string;
  role: AppUserRole;
  status: AppUserStatus;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

export type AppUserGitHubIdentity = {
  userId: string;
  githubUserId: number;
  login: string;
  name: string | null;
  avatarUrl: string | null;
};

type AppUserRow = QueryResultRow & {
  id: string; username: string; display_name: string | null; password_hash: string;
  role: AppUserRole; status: AppUserStatus; must_change_password: boolean;
  created_at: Date | string; updated_at: Date | string; last_login_at: Date | string | null;
};

const columns = `id, username, display_name, password_hash, role, status,
  must_change_password, created_at, updated_at, last_login_at`;

export async function createAppUser(input: {
  id: string; username: string; displayName?: string | null; passwordHash: string;
  role?: AppUserRole; mustChangePassword?: boolean; client?: PoolClient;
}) {
  const executor = input.client ?? getAppPostgresPool();
  const result = await executor.query<AppUserRow>(`
    INSERT INTO app_users (id, username, display_name, password_hash, role, must_change_password)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING ${columns}
  `, [input.id, input.username, input.displayName ?? null, input.passwordHash,
    input.role ?? "user", input.mustChangePassword ?? true]);
  return rowToAppUser(result.rows[0]);
}

export async function getAppUserById(id: string, client = getAppPostgresPool()) {
  const result = await client.query<AppUserRow>(`SELECT ${columns} FROM app_users WHERE id = $1`, [id]);
  return result.rows[0] ? rowToAppUser(result.rows[0]) : null;
}

export async function getAppUserByUsername(username: string) {
  const result = await getAppPostgresPool().query<AppUserRow>(
    `SELECT ${columns} FROM app_users WHERE lower(username) = lower($1)`, [username]);
  return result.rows[0] ? rowToAppUser(result.rows[0]) : null;
}

export async function getInstanceOwnerAppUser() {
  const result = await getAppPostgresPool().query<AppUserRow>(
    `SELECT ${columns} FROM app_users WHERE role = 'instance_owner' LIMIT 1`,
  );
  return result.rows[0] ? rowToAppUser(result.rows[0]) : null;
}

export async function listAppUsers() {
  const result = await getAppPostgresPool().query<AppUserRow>(
    `SELECT ${columns} FROM app_users ORDER BY created_at ASC`);
  return result.rows.map(rowToAppUser);
}

export async function setAppUserStatus(id: string, status: AppUserStatus, client?: PoolClient) {
  const executor = client ?? getAppPostgresPool();
  const result = await executor.query<AppUserRow>(`
    UPDATE app_users SET status = $2, updated_at = now() WHERE id = $1 RETURNING ${columns}
  `, [id, status]);
  return result.rows[0] ? rowToAppUser(result.rows[0]) : null;
}

export async function replaceAppUserPassword(input: {
  id: string; passwordHash: string; mustChangePassword: boolean; client?: PoolClient;
}) {
  const executor = input.client ?? getAppPostgresPool();
  const result = await executor.query<AppUserRow>(`
    UPDATE app_users SET password_hash = $2, must_change_password = $3, updated_at = now()
    WHERE id = $1 RETURNING ${columns}
  `, [input.id, input.passwordHash, input.mustChangePassword]);
  return result.rows[0] ? rowToAppUser(result.rows[0]) : null;
}

export async function markAppUserLogin(id: string) {
  await getAppPostgresPool().query(
    "UPDATE app_users SET last_login_at = now(), updated_at = now() WHERE id = $1", [id]);
}

export async function getAppUserGitHubIdentity(userId: string) {
  const result = await getAppPostgresPool().query<{
    user_id: string;
    github_user_id: string | number;
    login: string;
    name: string | null;
    avatar_url: string | null;
  }>("SELECT user_id, github_user_id, login, name, avatar_url FROM app_user_github_identities WHERE user_id = $1", [userId]);
  const row = result.rows[0];
  return row ? {
    userId: row.user_id,
    githubUserId: Number(row.github_user_id),
    login: row.login,
    name: row.name,
    avatarUrl: row.avatar_url,
  } satisfies AppUserGitHubIdentity : null;
}

export async function linkAppUserGitHubIdentity(
  userId: string,
  github: { id: number; login: string; name?: string | null; avatarUrl?: string | null },
) {
  const result = await getAppPostgresPool().query<{
    user_id: string;
    github_user_id: string | number;
    login: string;
    name: string | null;
    avatar_url: string | null;
  }>(`
    INSERT INTO app_user_github_identities (user_id, github_user_id, login, name, avatar_url, updated_at)
    VALUES ($1, $2, $3, $4, $5, now())
    ON CONFLICT (user_id) DO UPDATE
    SET github_user_id = EXCLUDED.github_user_id,
        login = EXCLUDED.login,
        name = EXCLUDED.name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = now()
    RETURNING user_id, github_user_id, login, name, avatar_url
  `, [userId, github.id, github.login, github.name || null, github.avatarUrl || null]);
  const row = result.rows[0];
  return {
    userId: row.user_id,
    githubUserId: Number(row.github_user_id),
    login: row.login,
    name: row.name,
    avatarUrl: row.avatar_url,
  } satisfies AppUserGitHubIdentity;
}

function rowToAppUser(row: AppUserRow): AppUser {
  return { id: row.id, username: row.username, displayName: row.display_name,
    passwordHash: row.password_hash, role: row.role, status: row.status,
    mustChangePassword: row.must_change_password, createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at), lastLoginAt: row.last_login_at ? toIso(row.last_login_at) : null };
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
