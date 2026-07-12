import "server-only";

import type { PoolClient, QueryResultRow } from "pg";

import { getAppPostgresPool } from "@/lib/server/database/postgres";
import type { RepositoryRecord } from "@/types/sketchblock";

type RepositoryUserIdentity = {
  userId: string;
  githubUserId: number;
  login: string;
  name?: string | null;
  avatarUrl?: string | null;
};

type RepositoryRow = QueryResultRow & {
  id: string;
  github_repository_id: string | number;
  owner: string;
  name: string;
  branch: string;
  html_url: string;
  api_url: string;
  private: boolean;
  status: RepositoryRecord["status"];
  last_scan_at: Date | string | null;
  drawing_count: number | null;
  error: string | null;
};

export async function getActiveRepository(userId: string): Promise<RepositoryRecord | null> {
  const result = await getAppPostgresPool().query<RepositoryRow>(
    `
      SELECT repository.*
      FROM app_repositories repository
      INNER JOIN app_user_repositories selection
        ON selection.repository_id = repository.id
      WHERE selection.user_id = $1
        AND selection.is_active = true
      LIMIT 1
    `,
    [userId],
  );

  return result.rows[0] ? rowToRepository(result.rows[0]) : null;
}

export async function listOwnedRepositories(userId: string): Promise<RepositoryRecord[]> {
  const result = await getAppPostgresPool().query<RepositoryRow>(
    `
      SELECT repository.*
      FROM app_repositories repository
      INNER JOIN app_user_repositories selection
        ON selection.repository_id = repository.id
      WHERE selection.user_id = $1
        AND repository.connected_by_user_id = $1
      ORDER BY selection.is_active DESC, selection.selected_at DESC, repository.owner, repository.name
    `,
    [userId],
  );

  return result.rows.map(rowToRepository);
}

export async function getRepositoryById(repositoryId: string): Promise<RepositoryRecord | null> {
  const result = await getAppPostgresPool().query<RepositoryRow>(
    "SELECT * FROM app_repositories WHERE id = $1",
    [repositoryId],
  );
  return result.rows[0] ? rowToRepository(result.rows[0]) : null;
}

export async function requireActiveRepository(userId: string): Promise<RepositoryRecord> {
  const repository = await getActiveRepository(userId);
  if (!repository) {
    throw new Error("Select a writable GitHub repository first.");
  }
  return repository;
}

export async function requireRepositoryById(repositoryId: string): Promise<RepositoryRecord> {
  const repository = await getRepositoryById(repositoryId);
  if (!repository) {
    throw new Error("Repository configuration not found.");
  }
  return repository;
}

export async function requireOwnedRepositoryById(repositoryId: string, userId: string) {
  const result = await getAppPostgresPool().query<RepositoryRow>(
    "SELECT * FROM app_repositories WHERE id = $1 AND connected_by_user_id = $2",
    [repositoryId, userId],
  );
  if (!result.rows[0]) {
    throw new Error("Repository configuration not found for the authenticated user.");
  }
  return rowToRepository(result.rows[0]);
}

export async function saveActiveRepository(
  user: RepositoryUserIdentity,
  repository: RepositoryRecord,
): Promise<RepositoryRecord> {
  const pool = getAppPostgresPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await upsertUser(client, user);
    await upsertRepository(client, user.userId, repository);
    await client.query(
      "UPDATE app_user_repositories SET is_active = false WHERE user_id = $1",
      [user.userId],
    );
    await client.query(
      `
        INSERT INTO app_user_repositories (github_user_id, user_id, repository_id, is_active, selected_at)
        VALUES ($1, $2, $3, true, now())
        ON CONFLICT (github_user_id, repository_id) DO UPDATE
        SET is_active = true,
            user_id = EXCLUDED.user_id,
            selected_at = now()
      `,
      [user.githubUserId, user.userId, repository.id],
    );
    await client.query("COMMIT");
    return repository;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function activateOwnedRepository(userId: string, repositoryId: string): Promise<RepositoryRecord> {
  const pool = getAppPostgresPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const repository = await client.query<RepositoryRow>(
      "SELECT * FROM app_repositories WHERE id = $1 AND connected_by_user_id = $2 FOR UPDATE",
      [repositoryId, userId],
    );
    if (!repository.rows[0]) {
      throw new Error("Repository configuration not found for the authenticated user.");
    }
    await client.query("UPDATE app_user_repositories SET is_active = false WHERE user_id = $1", [userId]);
    const selection = await client.query(
      `
        UPDATE app_user_repositories
        SET is_active = true, selected_at = now()
        WHERE user_id = $1 AND repository_id = $2
      `,
      [userId, repositoryId],
    );
    if (selection.rowCount !== 1) {
      throw new Error("Repository selection not found for the authenticated user.");
    }
    await client.query("COMMIT");
    return rowToRepository(repository.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function disconnectOwnedRepository(userId: string, repositoryId: string): Promise<void> {
  const pool = getAppPostgresPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const dependentSessions = await client.query<{ count: string } & QueryResultRow>(
      "SELECT count(*)::text AS count FROM app_sessions WHERE repository_id = $1 AND created_by_user_id = $2",
      [repositoryId, userId],
    );
    if (Number(dependentSessions.rows[0]?.count || 0) > 0) {
      throw new Error("Das Repository besitzt noch Sessions und kann deshalb nicht getrennt werden.");
    }
    const selection = await client.query<{ is_active: boolean } & QueryResultRow>(
      `
        DELETE FROM app_user_repositories
        WHERE user_id = $1 AND repository_id = $2
        RETURNING is_active
      `,
      [userId, repositoryId],
    );
    if (!selection.rows[0]) {
      throw new Error("Repository selection not found for the authenticated user.");
    }
    await client.query(
      "DELETE FROM app_repositories WHERE id = $1 AND connected_by_user_id = $2",
      [repositoryId, userId],
    );
    if (selection.rows[0].is_active) {
      await client.query(
        `
          UPDATE app_user_repositories
          SET is_active = true, selected_at = now()
          WHERE repository_id = (
            SELECT repository_id
            FROM app_user_repositories
            WHERE user_id = $1
            ORDER BY selected_at DESC
            LIMIT 1
          )
        `,
        [userId],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateOwnedRepositoryScan(
  userId: string,
  repository: RepositoryRecord,
): Promise<RepositoryRecord> {
  const result = await getAppPostgresPool().query<RepositoryRow>(
    `
      UPDATE app_repositories
      SET branch = $3,
          status = $4,
          last_scan_at = $5,
          drawing_count = $6,
          error = $7,
          updated_at = now()
      WHERE id = $1 AND connected_by_user_id = $2
      RETURNING *
    `,
    [
      repository.id,
      userId,
      repository.branch,
      repository.status,
      repository.lastScanAt || null,
      repository.drawingCount ?? null,
      repository.error || null,
    ],
  );
  if (!result.rows[0]) {
    throw new Error("Repository configuration not found for the authenticated user.");
  }
  return rowToRepository(result.rows[0]);
}

async function upsertUser(client: PoolClient, user: RepositoryUserIdentity) {
  await client.query(
    `
      INSERT INTO app_legacy_github_users (github_user_id, login, name, avatar_url, updated_at)
      VALUES ($1, $2, $3, $4, now())
      ON CONFLICT (github_user_id) DO UPDATE
      SET login = EXCLUDED.login,
          name = EXCLUDED.name,
          avatar_url = EXCLUDED.avatar_url,
          updated_at = now()
    `,
    [user.githubUserId, user.login, user.name || null, user.avatarUrl || null],
  );
}

async function upsertRepository(client: PoolClient, userId: string, repository: RepositoryRecord) {
  await client.query(
    `
      INSERT INTO app_repositories (
        id, github_repository_id, owner, name, branch, html_url, api_url, private,
        status, last_scan_at, drawing_count, error, connected_by_user_id, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
      ON CONFLICT (id) DO UPDATE
      SET github_repository_id = EXCLUDED.github_repository_id,
          owner = EXCLUDED.owner,
          name = EXCLUDED.name,
          branch = EXCLUDED.branch,
          html_url = EXCLUDED.html_url,
          api_url = EXCLUDED.api_url,
          private = EXCLUDED.private,
          status = EXCLUDED.status,
          last_scan_at = EXCLUDED.last_scan_at,
          drawing_count = EXCLUDED.drawing_count,
          error = EXCLUDED.error,
          connected_by_user_id = EXCLUDED.connected_by_user_id,
          updated_at = now()
    `,
    [
      repository.id,
      repository.githubRepositoryId,
      repository.owner,
      repository.name,
      repository.branch,
      repository.htmlUrl,
      repository.apiUrl,
      repository.private,
      repository.status,
      repository.lastScanAt || null,
      repository.drawingCount ?? null,
      repository.error || null,
      userId,
    ],
  );
}

function rowToRepository(row: RepositoryRow): RepositoryRecord {
  return {
    id: row.id,
    githubRepositoryId: Number(row.github_repository_id),
    owner: row.owner,
    name: row.name,
    branch: row.branch,
    htmlUrl: row.html_url,
    apiUrl: row.api_url,
    private: row.private,
    status: row.status,
    lastScanAt: row.last_scan_at ? toIso(row.last_scan_at) : undefined,
    drawingCount: row.drawing_count ?? undefined,
    error: row.error || undefined,
  };
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
