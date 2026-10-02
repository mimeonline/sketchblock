import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdhocSession: vi.fn(),
  deleteSession: vi.fn(),
  registerCollabSession: vi.fn(),
  ensureSessionInvites: vi.fn(),
  consumeAuthAttempt: vi.fn(),
  purge: vi.fn(),
}));

vi.mock("@/lib/server/audit/audit-service", () => ({ safeRecordAuditEvent: vi.fn() }));
vi.mock("@/lib/server/logging/server-logger", () => ({ getRequestId: () => "req" }));
vi.mock("@/lib/server/auth/request-security", () => ({
  rejectCrossOriginRequest: (request: Request) =>
    request.headers.get("origin") === "http://localhost:4512"
      ? null
      : Response.json({ error: "Invalid request origin.", code: "invalid_origin" }, { status: 403 }),
  consumeAuthAttempt: mocks.consumeAuthAttempt,
}));
vi.mock("@/lib/server/auth/owner-session", () => ({
  requireOwnerApiAuth: async () => ({ owner: { id: "u1", username: "o", role: "owner" }, response: null }),
}));
vi.mock("@/lib/server/application/purge-adhoc-sessions", () => ({ purgeExpiredAdhocSessions: mocks.purge }));
vi.mock("@/lib/server/collab/collab-server-client", () => ({ registerCollabSession: mocks.registerCollabSession }));
vi.mock("@/lib/server/database/session-store", () => ({
  createAdhocSession: mocks.createAdhocSession,
  deleteSession: mocks.deleteSession,
}));
vi.mock("@/lib/server/database/session-invite-store", () => ({ ensureSessionInvites: mocks.ensureSessionInvites }));

import { POST } from "./route";

const board = JSON.stringify({ type: "excalidraw", version: 2, elements: [] });
const req = (body: unknown = { fileName: "My Board.excalidraw", board }, origin = "http://localhost:4512") =>
  new NextRequest("http://localhost:4512/api/adhoc-sessions", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/adhoc-sessions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.purge.mockResolvedValue(undefined);
    mocks.consumeAuthAttempt.mockReturnValue({ allowed: true, retryAfterSeconds: 0 });
    mocks.createAdhocSession.mockResolvedValue({ id: "s1", sourceKind: "adhoc", repositoryId: null });
    mocks.ensureSessionInvites.mockResolvedValue({
      collaborator: { token: "c", expiresAt: null },
      viewer: { token: "v", expiresAt: null },
    });
  });

  it("creates an ad-hoc session", async () => {
    mocks.registerCollabSession.mockResolvedValue({ status: "registered", serverUrl: "x" });
    const response = await POST(req());
    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.url).toBe("/join/s1?owner=1");
    expect(json.session.shareLinks.viewer).toContain("invite=v");
    expect(mocks.createAdhocSession).toHaveBeenCalledWith(expect.objectContaining({ title: "My Board", ownerId: "u1" }));
    expect(mocks.consumeAuthAttempt).toHaveBeenCalledWith(expect.anything(), "adhoc:u1", 20);
  });

  it.each(["error", "unreachable"])("rolls back and returns 503 when collab is %s", async (status) => {
    mocks.registerCollabSession.mockResolvedValue({ status, serverUrl: "x" });
    const response = await POST(req());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "collab_unavailable" });
    expect(mocks.deleteSession).toHaveBeenCalledWith("s1", "u1");
  });

  it("returns 400 with the upload error code for invalid boards", async () => {
    const response = await POST(req({ fileName: "a.excalidraw", board: "not json" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "invalid_json" });
    expect(mocks.createAdhocSession).not.toHaveBeenCalled();
  });

  it("rejects cross-origin requests", async () => {
    const response = await POST(req(undefined, "https://evil.example"));
    expect(response.status).toBe(403);
    expect(mocks.createAdhocSession).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limited", async () => {
    mocks.consumeAuthAttempt.mockReturnValue({ allowed: false, retryAfterSeconds: 30 });
    const response = await POST(req());
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ code: "rate_limited" });
  });
});
