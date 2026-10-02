import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), poolQuery: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/database/postgres", () => ({
  getAppPostgresPool: () => ({
    query: mocks.poolQuery,
    connect: async () => ({ query: mocks.query, release: vi.fn() }),
  }),
}));

import { StorageConflictError } from "@/lib/server/application/storage-errors";
import {
  WorkspaceBoardNotFoundError,
  createWorkspaceBoard,
  deleteWorkspaceBoard,
  getWorkspaceBoardById,
  getWorkspaceBoardByPath,
  listWorkspaceBoardVersions,
  listWorkspaceBoards,
  pathFromTitle,
  restoreWorkspaceBoardVersion,
  saveWorkspaceBoard,
} from "./workspace-board-store";

const sqlOf = () => mocks.query.mock.calls.map((call) => String(call[0]));

describe("workspace board store", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.SKETCHBLOCK_WORKSPACE_MAX_VERSIONS;
  });

  it("derives safe paths from titles", () => {
    expect(pathFromTitle("Mein Büro Plan!")).toBe("mein-buro-plan.excalidraw");
    expect(pathFromTitle("../../x")).toBe("x.excalidraw");
    expect(pathFromTitle("???")).toBe("board.excalidraw");
    expect(pathFromTitle("a", 1)).toBe("a-2.excalidraw");
  });

  it("rejects a save with a stale revision and writes nothing", async () => {
    mocks.query.mockImplementation(async (sql: string) =>
      String(sql).includes("FOR UPDATE") ? { rows: [{ id: "b1", revision: 3 }] } : { rows: [] },
    );
    await expect(
      saveWorkspaceBoard("u1", { path: "a.excalidraw", sha: "rev-2", content: {} }),
    ).rejects.toBeInstanceOf(StorageConflictError);
    expect(sqlOf().some((sql) => sql.includes("UPDATE app_workspace_boards"))).toBe(false);
    expect(sqlOf()).toContain("ROLLBACK");
  });

  it("saves with the current revision, adds a version and prunes the oldest", async () => {
    process.env.SKETCHBLOCK_WORKSPACE_MAX_VERSIONS = "3";
    mocks.query.mockImplementation(async (sql: string) =>
      String(sql).includes("FOR UPDATE") ? { rows: [{ id: "b1", revision: 5 }] } : { rows: [] },
    );
    const result = await saveWorkspaceBoard("u1", { path: "a.excalidraw", sha: "rev-5", content: { a: 1 } });
    expect(result.revision).toBe(6);
    expect(sqlOf().some((sql) => sql.includes("INSERT INTO app_workspace_board_versions"))).toBe(true);
    const prune = mocks.query.mock.calls.find((call) => String(call[0]).includes("DELETE FROM app_workspace_board_versions"));
    // Keeps revisions 4, 5, 6.
    expect(prune?.[1]).toEqual(["b1", 3]);
    expect(sqlOf()).toContain("COMMIT");
  });

  it("does not prune while under the version limit", async () => {
    mocks.query.mockImplementation(async (sql: string) =>
      String(sql).includes("FOR UPDATE") ? { rows: [{ id: "b1", revision: 1 }] } : { rows: [] },
    );
    await saveWorkspaceBoard("u1", { path: "a.excalidraw", sha: "rev-1", content: {} });
    expect(sqlOf().some((sql) => sql.includes("DELETE FROM app_workspace_board_versions"))).toBe(false);
  });

  it("creates a board with a first version and a free path", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (String(sql).includes("SELECT path")) return { rows: [{ path: "plan.excalidraw" }] };
      if (String(sql).includes("INSERT INTO app_workspace_boards")) {
        return { rows: [{ id: "b9", path: "plan-2.excalidraw", title: "Plan", revision: 1, content: {}, updated_at: new Date(), updated_by: "u1" }] };
      }
      return { rows: [] };
    });
    const board = await createWorkspaceBoard("u1", { title: "Plan", content: {}, createdBy: "u1" });
    expect(board.path).toBe("plan-2.excalidraw");
    const insert = mocks.query.mock.calls.find((call) => String(call[0]).includes("INSERT INTO app_workspace_boards"));
    expect(insert?.[1][1]).toBe("plan-2.excalidraw");
  });

  it("restores a version as a new revision", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (String(sql).includes("FROM app_workspace_boards")) return { rows: [{ id: "b1", path: "a.excalidraw", revision: 4 }] };
      if (String(sql).includes("SELECT content")) return { rows: [{ content: { old: true } }] };
      return { rows: [] };
    });
    const result = await restoreWorkspaceBoardVersion("u1", "b1", 2, "u1");
    expect(result).toEqual({ path: "a.excalidraw", revision: 5 });
    const version = mocks.query.mock.calls.find((call) => String(call[0]).includes("INSERT INTO app_workspace_board_versions"));
    expect(version?.[1]).toEqual(["b1", 5, JSON.stringify({ old: true }), "u1", "Restored revision 2"]);
  });

  it("reports unknown versions as not found", async () => {
    mocks.query.mockImplementation(async (sql: string) =>
      String(sql).includes("FROM app_workspace_boards") ? { rows: [{ id: "b1", path: "a", revision: 1 }] } : { rows: [] },
    );
    await expect(restoreWorkspaceBoardVersion("u1", "b1", 9)).rejects.toBeInstanceOf(WorkspaceBoardNotFoundError);
  });

  it("scopes every read and delete by owner_user_id", async () => {
    mocks.poolQuery.mockResolvedValue({ rows: [] });
    await listWorkspaceBoards("u1");
    await getWorkspaceBoardByPath("u1", "a.excalidraw").catch(() => undefined);
    await getWorkspaceBoardById("u1", "b1").catch(() => undefined);
    await deleteWorkspaceBoard("u1", "b1").catch(() => undefined);
    await listWorkspaceBoardVersions("u1", "b1");
    expect(mocks.poolQuery).toHaveBeenCalledTimes(5);
    for (const [sql, params] of mocks.poolQuery.mock.calls) {
      expect(String(sql)).toContain("owner_user_id = $1");
      expect(params[0]).toBe("u1");
    }
  });

  it("returns not found for another user's board", async () => {
    mocks.poolQuery.mockResolvedValue({ rows: [] });
    await expect(getWorkspaceBoardById("other", "b1")).rejects.toBeInstanceOf(WorkspaceBoardNotFoundError);
  });

  it("scopes writes by owner_user_id", async () => {
    mocks.query.mockImplementation(async (sql: string) =>
      String(sql).includes("FOR UPDATE") ? { rows: [{ id: "b1", revision: 1 }] } : { rows: [] },
    );
    await saveWorkspaceBoard("u1", { path: "a.excalidraw", sha: "rev-1", content: {} });
    const locks = mocks.query.mock.calls.filter((call) => String(call[0]).includes("app_workspace_boards"));
    for (const [sql, params] of locks) {
      expect(String(sql)).toContain("owner_user_id = $");
      expect(params).toContain("u1");
    }
  });
});
