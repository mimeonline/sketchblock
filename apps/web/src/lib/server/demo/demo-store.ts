import "server-only";

import type { QueryResultRow } from "pg";

import { getAppPostgresPool } from "@/lib/server/database/postgres";
import type { DrawingContent, DrawingFile, RepositoryRecord, SaveDrawingInput, SaveDrawingResult } from "@/types/sketchblock";

export const DEMO_REPOSITORY: RepositoryRecord = {
  id: "demo-repository",
  githubRepositoryId: -1,
  owner: "sketchblock",
  name: "demo-workspace",
  branch: "demo",
  htmlUrl: "",
  apiUrl: "",
  private: false,
  status: "ready",
  drawingCount: 1,
};

const DEMO_PATH = "demo/getting-started.excalidraw";
const DEMO_CONTENT = {
  type: "excalidraw",
  version: 2,
  source: "https://sketchblock.dev",
  elements: [
    {
      id: "welcome-title", type: "text", x: 120, y: 100, width: 520, height: 45,
      angle: 0, strokeColor: "#0f172a", backgroundColor: "transparent", fillStyle: "solid",
      strokeWidth: 1, strokeStyle: "solid", roughness: 1, opacity: 100, groupIds: [], frameId: null,
      index: "a0", roundness: null, seed: 1001, version: 1, versionNonce: 1001, isDeleted: false,
      boundElements: null, updated: 1, link: null, locked: false, text: "Welcome to Sketchblock",
      fontSize: 36, fontFamily: 1, textAlign: "left", verticalAlign: "top", containerId: null,
      originalText: "Welcome to Sketchblock", autoResize: true, lineHeight: 1.25,
    },
    {
      id: "welcome-body", type: "text", x: 124, y: 180, width: 650, height: 75,
      angle: 0, strokeColor: "#475569", backgroundColor: "transparent", fillStyle: "solid",
      strokeWidth: 1, strokeStyle: "solid", roughness: 1, opacity: 100, groupIds: [], frameId: null,
      index: "a1", roundness: null, seed: 1002, version: 1, versionNonce: 1002, isDeleted: false,
      boundElements: null, updated: 1, link: null, locked: false,
      text: "Edit this board, start a live session, and invite a second browser.\nConnect GitHub when you are ready to use your own repositories.",
      fontSize: 22, fontFamily: 1, textAlign: "left", verticalAlign: "top", containerId: null,
      originalText: "Edit this board, start a live session, and invite a second browser.\nConnect GitHub when you are ready to use your own repositories.",
      autoResize: true, lineHeight: 1.25,
    },
  ],
  appState: { gridSize: 20, viewBackgroundColor: "#f8fafc" },
  files: {},
};

type DemoDrawingRow = QueryResultRow & {
  path: string;
  revision: number;
  content: unknown;
  updated_at: Date | string;
};

export async function listDemoDrawings(): Promise<DrawingFile[]> {
  await ensureDemoWorkspace();
  const drawing = await getDemoDrawing(DEMO_PATH);
  return [{
    path: drawing.path,
    sha: drawing.sha,
    lastCommit: "Local demo workspace",
    status: "saved",
    repositoryId: DEMO_REPOSITORY.id,
  }];
}

export async function getDemoDrawing(path: string): Promise<DrawingContent> {
  await ensureDemoWorkspace();
  const result = await getAppPostgresPool().query<DemoDrawingRow>(
    "SELECT path, revision, content, updated_at FROM app_demo_drawings WHERE path = $1",
    [path],
  );
  if (!result.rows[0]) {
    throw new Error("Demo board not found.");
  }
  return rowToDrawing(result.rows[0]);
}

export async function saveDemoDrawing(input: SaveDrawingInput): Promise<SaveDrawingResult> {
  await ensureDemoWorkspace();
  const result = await getAppPostgresPool().query<DemoDrawingRow>(
    `
      UPDATE app_demo_drawings
      SET revision = revision + 1, content = $2, updated_at = now()
      WHERE path = $1
      RETURNING path, revision, content, updated_at
    `,
    [input.path, input.content],
  );
  if (!result.rows[0]) {
    throw new Error("Demo board not found.");
  }
  const sha = revisionSha(result.rows[0].revision);
  return { path: result.rows[0].path, commitSha: `demo-${sha}`, contentSha: sha };
}

export async function resetDemoDrawing(): Promise<void> {
  await ensureDemoWorkspace();
  await getAppPostgresPool().query(
    "UPDATE app_demo_drawings SET revision = 1, content = demo_content, updated_at = now() WHERE path = $1",
    [DEMO_PATH],
  );
}

export async function ensureDemoWorkspace(): Promise<void> {
  const pool = getAppPostgresPool();
  await pool.query(`
    INSERT INTO app_users (id, username, display_name, password_hash, role, status, must_change_password)
    VALUES ('demo-owner', 'demo', 'Demo User', 'demo-mode-no-password-login', 'user', 'active', false)
    ON CONFLICT (id) DO NOTHING
  `);
  await pool.query(`
    INSERT INTO app_legacy_github_users (github_user_id, login, name)
    VALUES (-1, 'demo', 'Demo User') ON CONFLICT (github_user_id) DO NOTHING
  `);
  await pool.query(`
    INSERT INTO app_repositories (
      id, github_repository_id, owner, name, branch, html_url, api_url, private,
      status, drawing_count, connected_by_user_id
    ) VALUES ('demo-repository', -1, 'sketchblock', 'demo-workspace', 'demo', '', '', false, 'ready', 1, 'demo-owner')
    ON CONFLICT (id) DO NOTHING
  `);
  await pool.query(`
    INSERT INTO app_user_repositories (github_user_id, user_id, repository_id, is_active)
    VALUES (-1, 'demo-owner', 'demo-repository', true)
    ON CONFLICT (github_user_id, repository_id) DO UPDATE
    SET user_id = EXCLUDED.user_id, is_active = true, selected_at = now()
  `);
  await pool.query(`
    INSERT INTO app_demo_drawings (path, content, demo_content)
    VALUES ($1, $2, $2) ON CONFLICT (path) DO NOTHING
  `, [DEMO_PATH, DEMO_CONTENT]);
}

function rowToDrawing(row: DemoDrawingRow): DrawingContent {
  return { path: row.path, sha: revisionSha(row.revision), content: row.content };
}

function revisionSha(revision: number) {
  return `demo-revision-${revision}`;
}
