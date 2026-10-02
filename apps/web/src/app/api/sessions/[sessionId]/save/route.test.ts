import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  openDrawing: vi.fn(),
  saveDrawing: vi.fn(),
  getOwnedSession: vi.fn(),
  updateSessionBaseSha: vi.fn(),
}));

vi.mock("@/lib/server/audit/audit-service", () => ({ safeRecordAuditEvent: vi.fn() }));
vi.mock("@/lib/server/logging/server-logger", () => ({ getRequestId: () => "req" }));
vi.mock("@/lib/server/auth/request-security", () => ({
  rejectCrossOriginRequest: (request: Request) =>
    request.headers.get("origin") === "http://localhost:4512"
      ? null
      : Response.json({ error: "Invalid request origin.", code: "invalid_origin" }, { status: 403 }),
}));
vi.mock("@/lib/server/application/drawing-use-cases", () => ({ openDrawing: mocks.openDrawing, saveDrawing: mocks.saveDrawing }));
vi.mock("@/lib/server/auth/owner-session", () => ({
  requireOwnerApiAuth: async () => ({ owner: { id: "u1", username: "o", role: "owner" }, response: null }),
  requireLinkedOwnerGitHub: vi.fn(),
}));
vi.mock("@/lib/server/collab/collab-server-client", () => ({
  getCollabSessionSnapshot: async () => ({ snapshot: { content: { elements: [] }, revision: 3 } }),
  updateCollabSessionStatus: vi.fn(),
}));
vi.mock("@/lib/server/database/session-store", () => ({
  getOwnedSession: mocks.getOwnedSession,
  updateSessionStatus: vi.fn(),
  updateSessionBaseSha: mocks.updateSessionBaseSha,
  upsertSessionSnapshot: vi.fn(),
}));
vi.mock("@/lib/server/database/repository-store", () => ({
  requireOwnedRepositoryById: async () => ({ id: "r1" }),
  requireRepositoryById: async () => ({ id: "r1" }),
}));

import { GitHubApiError } from "@/lib/server/github/github-repository-adapter";
import { POST } from "./route";

const context = { params: Promise.resolve({ sessionId: "s1" }) };
const req = (origin: string | null = "http://localhost:4512") =>
  new Request("http://localhost:4512/api/sessions/s1/save", { method: "POST", headers: origin ? { origin } : {} });

describe("session save route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getOwnedSession.mockResolvedValue({ id: "s1", repositoryId: "r1", drawingPath: "b.excalidraw", baseSha: "base-sha" });
    mocks.openDrawing.mockResolvedValue({ sha: "fresh-sha" });
    mocks.saveDrawing.mockResolvedValue({ path: "b.excalidraw", commitSha: "c1", contentSha: "new-sha" });
  });

  it("saves with the session base sha, not the fresh GitHub sha, and records the new sha", async () => {
    const response = await POST(req(), context);
    expect(response.status).toBe(200);
    expect(mocks.saveDrawing.mock.calls[0][1]).toMatchObject({ sha: "base-sha" });
    expect(mocks.openDrawing).not.toHaveBeenCalled();
    expect(mocks.updateSessionBaseSha).toHaveBeenCalledWith("s1", "new-sha", "u1");
  });

  it("falls back to the fresh sha for legacy sessions", async () => {
    mocks.getOwnedSession.mockResolvedValue({ id: "s1", repositoryId: "r1", drawingPath: "b.excalidraw", baseSha: null });
    await POST(req(), context);
    expect(mocks.saveDrawing.mock.calls[0][1]).toMatchObject({ sha: "fresh-sha" });
  });

  it.each([409, 422])("maps GitHub %s to 409 github_conflict", async (status) => {
    mocks.saveDrawing.mockRejectedValue(new GitHubApiError(status, "conflict"));
    const response = await POST(req(), context);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "github_conflict" });
    expect(mocks.updateSessionBaseSha).not.toHaveBeenCalled();
  });

  it("rejects cross-origin requests", async () => {
    const response = await POST(req("https://evil.example"), context);
    expect(response.status).toBe(403);
    expect(mocks.saveDrawing).not.toHaveBeenCalled();
  });
});
