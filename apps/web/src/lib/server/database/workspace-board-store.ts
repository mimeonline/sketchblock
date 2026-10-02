import "server-only";

import type { QueryResultRow } from "pg";

import { StorageConflictError } from "@/lib/server/application/storage-errors";
import { getAppPostgresPool } from "@/lib/server/database/postgres";

/**
 * Postgres store for instance-workspace boards. Every query is scoped by
 * owner_user_id: boards are private per local user.
 */

export class WorkspaceBoardNotFoundError extends Error {
  readonly status = 404;

  constructor(message = "Board not found.") {
    super(message);
    this.name = "WorkspaceBoardNotFoundError";
  }
}

export class WorkspaceBoardExistsError extends Error {
  readonly status = 409;

  constructor(message = "A board with this name already exists.") {
    super(message);
    this.name = "WorkspaceBoardExistsError";
  }
}

export type WorkspaceBoard = {
  id: string;
  path: string;
  title: string;
  revision: number;
  content: unknown;
  updatedAt: string;
  updatedBy: string | null;
};

export type WorkspaceBoardSummary = Omit<WorkspaceBoard, "content">;

export type WorkspaceBoardVersion = {
  revision: number;
  createdAt: string;
  createdBy: string | null;
  message: string | null;
};

type BoardRow = QueryResultRow & {
  id: string;
  path: string;
  title: string;
  revision: number;
  content?: unknown;
  updated_at: Date | string;
  updated_by: string | null;
};

type VersionRow = QueryResultRow & {
  revision: number;
  created_at: Date | string;
  created_by: string | null;
  message: string | null;
};

const DEFAULT_MAX_VERSIONS = 50;

export function getWorkspaceMaxVersions(): number {
  const value = Number.parseInt(process.env.SKETCHBLOCK_WORKSPACE_MAX_VERSIONS || "", 10);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_MAX_VERSIONS;
}

export function revisionToSha(revision: number): string {
  return `rev-${revision}`;
}

export function shaToRevision(sha: string): number | null {
  const match = /^rev-(\d+)$/.exec(sha);
  return match ? Number(match[1]) : null;
}

/** Derives a `<slug>.excalidraw` path from a board title. */
export function pathFromTitle(title: string, suffix = 0): string {
  const slug =
    title
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "board";
  return `${suffix > 0 ? `${slug}-${suffix + 1}` : slug}.excalidraw`;
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function rowToBoard(row: BoardRow): WorkspaceBoard {
  return {
    id: row.id,
    path: row.path,
    title: row.title,
    revision: row.revision,
    content: row.content,
    updatedAt: toIso(row.updated_at),
    updatedBy: row.updated_by,
  };
}

function rowToSummary(row: BoardRow): WorkspaceBoardSummary {
  const { content: _content, ...summary } = rowToBoard(row);
  void _content;
  return summary;
}

async function withTransaction<T>(
  work: (client: {
    query: <R extends QueryResultRow = QueryResultRow>(
      text: string,
      values?: unknown[],
    ) => Promise<{ rows: R[]; rowCount: number | null }>;
  }) => Promise<T>,
): Promise<T> {
  const client = await getAppPostgresPool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listWorkspaceBoards(userId: string): Promise<WorkspaceBoardSummary[]> {
  const result = await getAppPostgresPool().query<BoardRow>(
    `
      SELECT id, path, title, revision, updated_at, updated_by
      FROM app_workspace_boards
      WHERE owner_user_id = $1
      ORDER BY updated_at DESC, path
    `,
    [userId],
  );
  return result.rows.map(rowToSummary);
}

export async function getWorkspaceBoardByPath(userId: string, path: string): Promise<WorkspaceBoard> {
  const result = await getAppPostgresPool().query<BoardRow>(
    `
      SELECT id, path, title, revision, content, updated_at, updated_by
      FROM app_workspace_boards
      WHERE owner_user_id = $1 AND path = $2
    `,
    [userId, path],
  );
  if (!result.rows[0]) throw new WorkspaceBoardNotFoundError();
  return rowToBoard(result.rows[0]);
}

export async function getWorkspaceBoardById(userId: string, boardId: string): Promise<WorkspaceBoardSummary> {
  const result = await getAppPostgresPool().query<BoardRow>(
    `
      SELECT id, path, title, revision, updated_at, updated_by
      FROM app_workspace_boards
      WHERE owner_user_id = $1 AND id = $2
    `,
    [userId, boardId],
  );
  if (!result.rows[0]) throw new WorkspaceBoardNotFoundError();
  return rowToSummary(result.rows[0]);
}

async function pruneVersions(
  client: { query: (text: string, values?: unknown[]) => Promise<unknown> },
  boardId: string,
  newRevision: number,
) {
  const cutoff = newRevision - getWorkspaceMaxVersions();
  if (cutoff > 0) {
    await client.query("DELETE FROM app_workspace_board_versions WHERE board_id = $1 AND revision <= $2", [
      boardId,
      cutoff,
    ]);
  }
}

export async function createWorkspaceBoard(
  userId: string,
  input: { title: string; content: unknown; createdBy?: string | null; message?: string },
): Promise<WorkspaceBoard> {
  return withTransaction(async (client) => {
    // Pick the first free path; the UNIQUE(owner_user_id, path) constraint is the final guard.
    const existing = await client.query<{ path: string } & QueryResultRow>(
      "SELECT path FROM app_workspace_boards WHERE owner_user_id = $1",
      [userId],
    );
    const taken = new Set(existing.rows.map((row) => row.path));
    let suffix = 0;
    while (taken.has(pathFromTitle(input.title, suffix))) suffix += 1;
    const path = pathFromTitle(input.title, suffix);
    const content = JSON.stringify(input.content);
    const inserted = await client.query<BoardRow>(
      `
        INSERT INTO app_workspace_boards (owner_user_id, path, title, revision, content, updated_by)
        VALUES ($1, $2, $3, 1, $4::jsonb, $5)
        RETURNING id, path, title, revision, content, updated_at, updated_by
      `,
      [userId, path, input.title, content, input.createdBy ?? null],
    );
    const board = inserted.rows[0];
    await client.query(
      `
        INSERT INTO app_workspace_board_versions (board_id, revision, content, created_by, message)
        VALUES ($1, 1, $2::jsonb, $3, $4)
      `,
      [board.id, content, input.createdBy ?? null, input.message ?? "Created"],
    );
    return rowToBoard(board);
  });
}

export async function saveWorkspaceBoard(
  userId: string,
  input: { path: string; sha: string; content: unknown; updatedBy?: string | null; message?: string },
): Promise<{ boardId: string; revision: number }> {
  const expected = shaToRevision(input.sha);
  return withTransaction(async (client) => {
    const current = await client.query<BoardRow>(
      "SELECT id, revision FROM app_workspace_boards WHERE owner_user_id = $1 AND path = $2 FOR UPDATE",
      [userId, input.path],
    );
    const row = current.rows[0];
    if (!row) throw new WorkspaceBoardNotFoundError();
    if (expected === null || row.revision !== expected) {
      throw new StorageConflictError("The board was changed after it was opened.");
    }
    const revision = row.revision + 1;
    const content = JSON.stringify(input.content);
    await client.query(
      `
        UPDATE app_workspace_boards
        SET revision = $3, content = $4::jsonb, updated_at = now(), updated_by = $5
        WHERE id = $1 AND owner_user_id = $2
      `,
      [row.id, userId, revision, content, input.updatedBy ?? null],
    );
    await client.query(
      `
        INSERT INTO app_workspace_board_versions (board_id, revision, content, created_by, message)
        VALUES ($1, $2, $3::jsonb, $4, $5)
      `,
      [row.id, revision, content, input.updatedBy ?? null, input.message ?? null],
    );
    await pruneVersions(client, row.id, revision);
    return { boardId: row.id, revision };
  });
}

export async function renameWorkspaceBoard(
  userId: string,
  boardId: string,
  input: { title: string; newPath?: string },
): Promise<WorkspaceBoardSummary> {
  return withTransaction(async (client) => {
    const current = await client.query<BoardRow>(
      "SELECT id, path FROM app_workspace_boards WHERE owner_user_id = $1 AND id = $2 FOR UPDATE",
      [userId, boardId],
    );
    if (!current.rows[0]) throw new WorkspaceBoardNotFoundError();
    let path = input.newPath;
    if (!path) {
      const existing = await client.query<{ path: string } & QueryResultRow>(
        "SELECT path FROM app_workspace_boards WHERE owner_user_id = $1 AND id <> $2",
        [userId, boardId],
      );
      const taken = new Set(existing.rows.map((row) => row.path));
      let suffix = 0;
      while (taken.has(pathFromTitle(input.title, suffix))) suffix += 1;
      path = pathFromTitle(input.title, suffix);
    }
    try {
      const updated = await client.query<BoardRow>(
        `
          UPDATE app_workspace_boards
          SET title = $3, path = $4, updated_at = now()
          WHERE id = $1 AND owner_user_id = $2
          RETURNING id, path, title, revision, updated_at, updated_by
        `,
        [boardId, userId, input.title, path],
      );
      return rowToSummary(updated.rows[0]);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new WorkspaceBoardExistsError();
      throw error;
    }
  });
}

export async function deleteWorkspaceBoard(userId: string, boardId: string): Promise<WorkspaceBoardSummary> {
  const result = await getAppPostgresPool().query<BoardRow>(
    `
      DELETE FROM app_workspace_boards
      WHERE owner_user_id = $1 AND id = $2
      RETURNING id, path, title, revision, updated_at, updated_by
    `,
    [userId, boardId],
  );
  if (!result.rows[0]) throw new WorkspaceBoardNotFoundError();
  return rowToSummary(result.rows[0]);
}

export async function listWorkspaceBoardVersions(
  userId: string,
  boardId: string,
): Promise<WorkspaceBoardVersion[]> {
  const result = await getAppPostgresPool().query<VersionRow>(
    `
      SELECT version.revision, version.created_at, version.created_by, version.message
      FROM app_workspace_board_versions version
      INNER JOIN app_workspace_boards board ON board.id = version.board_id
      WHERE board.owner_user_id = $1 AND board.id = $2
      ORDER BY version.revision DESC
    `,
    [userId, boardId],
  );
  return result.rows.map((row) => ({
    revision: row.revision,
    createdAt: toIso(row.created_at),
    createdBy: row.created_by,
    message: row.message,
  }));
}

/** Restores an older version as a new revision (history is never rewritten). */
export async function restoreWorkspaceBoardVersion(
  userId: string,
  boardId: string,
  revision: number,
  restoredBy?: string | null,
): Promise<{ path: string; revision: number }> {
  return withTransaction(async (client) => {
    const current = await client.query<BoardRow>(
      "SELECT id, path, revision FROM app_workspace_boards WHERE owner_user_id = $1 AND id = $2 FOR UPDATE",
      [userId, boardId],
    );
    const board = current.rows[0];
    if (!board) throw new WorkspaceBoardNotFoundError();
    const version = await client.query<{ content: unknown } & QueryResultRow>(
      "SELECT content FROM app_workspace_board_versions WHERE board_id = $1 AND revision = $2",
      [boardId, revision],
    );
    if (!version.rows[0]) throw new WorkspaceBoardNotFoundError("Version not found.");
    const next = board.revision + 1;
    const content = JSON.stringify(version.rows[0].content);
    await client.query(
      `
        UPDATE app_workspace_boards
        SET revision = $3, content = $4::jsonb, updated_at = now(), updated_by = $5
        WHERE id = $1 AND owner_user_id = $2
      `,
      [boardId, userId, next, content, restoredBy ?? null],
    );
    await client.query(
      `
        INSERT INTO app_workspace_board_versions (board_id, revision, content, created_by, message)
        VALUES ($1, $2, $3::jsonb, $4, $5)
      `,
      [boardId, next, content, restoredBy ?? null, `Restored revision ${revision}`],
    );
    await pruneVersions(client, boardId, next);
    return { path: board.path, revision: next };
  });
}
