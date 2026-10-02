import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createWorkspaceBoard: vi.fn(),
  renameWorkspaceBoard: vi.fn(),
  deleteWorkspaceBoard: vi.fn(),
  getWorkspaceBoardById: vi.fn(),
  restoreWorkspaceBoardVersion: vi.fn(),
  listWorkspaceBoardVersions: vi.fn(),
  listSessions: vi.fn(),
  deleteSession: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/audit/audit-service", () => ({ safeRecordAuditEvent: mocks.audit }));
vi.mock("@/lib/server/logging/server-logger", () => ({ getRequestId: () => "req" }));
vi.mock("@/lib/server/auth/request-security", () => ({
  rejectCrossOriginRequest: (request: Request) =>
    request.headers.get("origin") === "http://localhost:4512"
      ? null
      : Response.json({ error: "Invalid request origin.", code: "invalid_origin" }, { status: 403 }),
}));
vi.mock("@/lib/server/auth/owner-session", () => ({
  requireOwnerApiAuth: async () => ({ owner: { id: "u1", username: "anna", role: "user" }, response: null }),
}));
vi.mock("@/lib/server/collab/collab-server-client", () => ({ updateCollabSessionStatus: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/server/database/session-store", () => ({
  listSessions: mocks.listSessions,
  deleteSession: mocks.deleteSession,
}));
vi.mock("@/lib/server/database/workspace-board-store", async () => {
  class WorkspaceBoardNotFoundError extends Error {}
  class WorkspaceBoardExistsError extends Error {}
  return {
    WorkspaceBoardNotFoundError,
    WorkspaceBoardExistsError,
    revisionToSha: (revision: number) => `rev-${revision}`,
    createWorkspaceBoard: mocks.createWorkspaceBoard,
    renameWorkspaceBoard: mocks.renameWorkspaceBoard,
    deleteWorkspaceBoard: mocks.deleteWorkspaceBoard,
    getWorkspaceBoardById: mocks.getWorkspaceBoardById,
    restoreWorkspaceBoardVersion: mocks.restoreWorkspaceBoardVersion,
    listWorkspaceBoardVersions: mocks.listWorkspaceBoardVersions,
  };
});

import { POST as create } from "./route";
import { DELETE, PATCH } from "./[boardId]/route";
import { GET as listVersions } from "./[boardId]/versions/route";
import { POST as restore } from "./[boardId]/versions/[revision]/restore/route";

const ID = "11111111-2222-3333-4444-555555555555";
const ORIGIN = "http://localhost:4512";
const req = (method: string, body?: unknown, origin = ORIGIN) =>
  new NextRequest(`${ORIGIN}/api/workspace/boards`, {
    method,
    headers: { origin, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const boardCtx = { params: Promise.resolve({ boardId: ID }) };
const summary = { id: ID, path: "plan.excalidraw", title: "Plan", revision: 1, updatedAt: "", updatedBy: "u1" };

describe("workspace board routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.listSessions.mockResolvedValue([]);
  });

  it("creates an empty board", async () => {
    mocks.createWorkspaceBoard.mockResolvedValue({ ...summary, content: {} });
    const response = await create(req("POST", { title: "Plan" }));
    expect(response.status).toBe(201);
    expect((await response.json()).board).toMatchObject({ id: ID, path: "plan.excalidraw", sha: "rev-1" });
    const [userId, input] = mocks.createWorkspaceBoard.mock.calls[0];
    expect(userId).toBe("u1");
    expect(input.content).toMatchObject({ type: "excalidraw", elements: [] });
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "workspace.board.create" }));
  });

  it("creates a board from an upload and rejects invalid boards", async () => {
    mocks.createWorkspaceBoard.mockResolvedValue({ ...summary, content: {} });
    const board = JSON.stringify({ type: "excalidraw", elements: [] });
    expect((await create(req("POST", { title: "Up", board }))).status).toBe(201);
    const bad = await create(req("POST", { title: "Up", board: "{nope" }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).code).toBe("invalid_json");
    expect((await create(req("POST", {}))).status).toBe(400);
  });

  it("renames a board", async () => {
    mocks.getWorkspaceBoardById.mockResolvedValue(summary);
    mocks.renameWorkspaceBoard.mockResolvedValue({ ...summary, title: "New", path: "new.excalidraw" });
    const response = await PATCH(req("PATCH", { title: "New" }), boardCtx);
    expect(response.status).toBe(200);
    expect(mocks.renameWorkspaceBoard).toHaveBeenCalledWith("u1", ID, { title: "New" });
    expect((await response.json()).board.path).toBe("new.excalidraw");
  });

  it("refuses to rename a board with sessions", async () => {
    mocks.getWorkspaceBoardById.mockResolvedValue(summary);
    mocks.listSessions.mockResolvedValue([{ id: "s1", drawingPath: "plan.excalidraw" }]);
    const response = await PATCH(req("PATCH", { title: "New" }), boardCtx);
    expect(response.status).toBe(409);
    expect(mocks.renameWorkspaceBoard).not.toHaveBeenCalled();
  });

  it("deletes a board and ends its sessions first", async () => {
    mocks.getWorkspaceBoardById.mockResolvedValue(summary);
    mocks.listSessions.mockResolvedValue([
      { id: "s1", drawingPath: "plan.excalidraw" },
      { id: "s2", drawingPath: "other.excalidraw" },
    ]);
    const response = await DELETE(req("DELETE"), boardCtx);
    expect(response.status).toBe(200);
    expect(mocks.listSessions).toHaveBeenCalledWith("u1", "instance-u1");
    expect(mocks.deleteSession).toHaveBeenCalledTimes(1);
    expect(mocks.deleteSession).toHaveBeenCalledWith("s1", "u1");
    expect(mocks.deleteWorkspaceBoard).toHaveBeenCalledWith("u1", ID);
  });

  it("lists versions and restores one as a new revision", async () => {
    mocks.getWorkspaceBoardById.mockResolvedValue({ ...summary, revision: 3 });
    mocks.listWorkspaceBoardVersions.mockResolvedValue([{ revision: 3 }, { revision: 2 }]);
    const list = await listVersions(req("GET"), boardCtx);
    expect((await list.json()).versions).toHaveLength(2);

    mocks.restoreWorkspaceBoardVersion.mockResolvedValue({ path: "plan.excalidraw", revision: 4 });
    const response = await restore(req("POST"), { params: Promise.resolve({ boardId: ID, revision: "2" }) });
    expect(response.status).toBe(200);
    expect(mocks.restoreWorkspaceBoardVersion).toHaveBeenCalledWith("u1", ID, 2, "u1");
    expect((await response.json()).board).toMatchObject({ revision: 4, sha: "rev-4" });
  });

  it("returns 404 for unknown boards and malformed ids", async () => {
    const { WorkspaceBoardNotFoundError } = await import("@/lib/server/database/workspace-board-store");
    mocks.getWorkspaceBoardById.mockRejectedValue(new WorkspaceBoardNotFoundError());
    expect((await DELETE(req("DELETE"), boardCtx)).status).toBe(404);
    expect((await DELETE(req("DELETE"), { params: Promise.resolve({ boardId: "x" }) })).status).toBe(404);
    expect((await restore(req("POST"), { params: Promise.resolve({ boardId: ID, revision: "abc" }) })).status).toBe(404);
  });

  it("rejects cross-origin mutations", async () => {
    const evil = "https://evil.example";
    expect((await create(req("POST", { title: "x" }, evil))).status).toBe(403);
    expect((await PATCH(req("PATCH", { title: "x" }, evil), boardCtx)).status).toBe(403);
    expect((await DELETE(req("DELETE", undefined, evil), boardCtx)).status).toBe(403);
    expect((await restore(req("POST", undefined, evil), { params: Promise.resolve({ boardId: ID, revision: "1" }) })).status).toBe(403);
    expect(mocks.createWorkspaceBoard).not.toHaveBeenCalled();
    expect(mocks.deleteWorkspaceBoard).not.toHaveBeenCalled();
  });
});
