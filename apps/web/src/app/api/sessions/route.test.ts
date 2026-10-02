import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  registerCollabSession: vi.fn(),
  ensureSessionInvites: vi.fn(),
}));

vi.mock("@/lib/server/audit/audit-service", () => ({ safeRecordAuditEvent: vi.fn() }));
vi.mock("@/lib/server/logging/server-logger", () => ({ getRequestId: () => "req" }));
vi.mock("@/lib/server/auth/request-security", () => ({
  rejectCrossOriginRequest: (request: Request) =>
    request.headers.get("origin") === "http://localhost:4512"
      ? null
      : Response.json({ error: "Invalid request origin.", code: "invalid_origin" }, { status: 403 }),
}));
vi.mock("@/lib/server/auth/owner-session", () => ({
  requireOwnerApiAuth: async () => ({ owner: { id: "u1", username: "o", role: "owner" }, response: null }),
  requireLinkedOwnerGitHub: vi.fn(),
}));
vi.mock("@/lib/server/domain/validate-drawing-path", () => ({ validateDrawingPath: (p: string) => p }));
vi.mock("@/lib/server/application/drawing-use-cases", () => ({
  openDrawing: async () => ({ path: "b.excalidraw", sha: "sha1", content: {} }),
}));
vi.mock("@/lib/server/collab/collab-server-client", () => ({
  getCollabServerStatus: vi.fn(),
  inspectCollabSession: vi.fn(),
  registerCollabSession: mocks.registerCollabSession,
}));
vi.mock("@/lib/server/database/repository-store", () => ({
  getActiveRepository: vi.fn(),
  requireActiveRepository: async () => ({ id: "r1" }),
}));
vi.mock("@/lib/server/database/session-store", () => ({
  createSession: mocks.createSession,
  deleteSession: mocks.deleteSession,
  listSessions: vi.fn(),
}));
vi.mock("@/lib/server/database/session-invite-store", () => ({
  ensureSessionInvites: mocks.ensureSessionInvites,
  listSessionParticipants: vi.fn(),
}));

import { POST } from "./route";

const req = (origin = "http://localhost:4512") =>
  new NextRequest("http://localhost:4512/api/sessions", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ path: "b.excalidraw" }),
  });

describe("POST /api/sessions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.createSession.mockResolvedValue({ id: "s1", repositoryId: "r1", drawingPath: "b.excalidraw" });
    mocks.ensureSessionInvites.mockResolvedValue({ collaborator: { token: "c" }, viewer: { token: "v" } });
  });

  it("stores the opened sha as base sha", async () => {
    mocks.registerCollabSession.mockResolvedValue({ status: "registered", serverUrl: "x" });
    const response = await POST(req());
    expect(response.status).toBe(200);
    expect(mocks.createSession).toHaveBeenCalledWith("r1", "b.excalidraw", "u1", "sha1");
  });

  it.each(["error", "unreachable"])("rolls back and returns 503 when collab status is %s", async (status) => {
    mocks.registerCollabSession.mockResolvedValue({ status, serverUrl: "x" });
    const response = await POST(req());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "collab_unavailable" });
    expect(mocks.deleteSession).toHaveBeenCalledWith("s1", "u1");
  });

  it("rejects cross-origin requests", async () => {
    const response = await POST(req("https://evil.example"));
    expect(response.status).toBe(403);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });
});
