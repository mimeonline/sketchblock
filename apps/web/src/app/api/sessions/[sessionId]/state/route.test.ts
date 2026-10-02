import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock("@/lib/server/auth/session-access", () => ({
  authorizeSessionRequest: async () => ({ access: { role: "collaborator", actor: "guest" }, response: null }),
}));
vi.mock("@/lib/server/database/session-store", () => ({
  getSession: async () => ({ id: "s1", drawingPath: "board.excalidraw" }),
}));
vi.mock("@/lib/server/auth/collab-ticket", () => ({ createServerCollabTicket: () => "server-ticket" }));
vi.mock("@/lib/server/database/repository-store", () => ({ requireOwnedRepositoryById: vi.fn(), requireRepositoryById: vi.fn() }));
vi.mock("@/lib/server/application/drawing-use-cases", () => ({ openDrawing: vi.fn() }));

import { PATCH } from "./route";

const context = { params: Promise.resolve({ sessionId: "s1" }) };

describe("web snapshot fallback revision contract", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("forwards revisions through the real collab client and rejects a stale fallback with the latest snapshot", async () => {
    let persisted = { sessionId: "s1", drawingPath: "board.excalidraw", revision: 5, content: { elements: ["original"] }, updatedAt: "2026-10-02T10:00:00Z", updatedBy: "owner" };
    mocks.fetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.baseRevision !== undefined && body.baseRevision !== persisted.revision) {
        return Response.json({ ok: false, error: "snapshot_conflict", snapshot: persisted }, { status: 409 });
      }
      persisted = { ...persisted, content: body.content, revision: persisted.revision + 1, updatedBy: body.updatedBy };
      return Response.json({ ok: true, snapshot: persisted });
    });

    const accepted = await PATCH(request({ baseRevision: 5, content: { elements: ["accepted"] } }), context);
    expect(accepted.status).toBe(200);
    const rejected = await PATCH(request({ baseRevision: 5, content: { elements: ["stale"] } }), context);
    expect(rejected.status).toBe(409);
    expect(await rejected.json()).toMatchObject({ code: "snapshot_conflict", error: "snapshot_conflict", snapshot: { revision: 6, content: { elements: ["accepted"] } } });
    expect(persisted).toMatchObject({ revision: 6, content: { elements: ["accepted"] } });
    expect(JSON.parse(mocks.fetch.mock.calls[1][1].body)).toMatchObject({ baseRevision: 5, updatedBy: "guest" });
  });

  it("preserves omitted revisions for legacy clients", async () => {
    mocks.fetch.mockResolvedValue(Response.json({ ok: true, snapshot: { revision: 1 } }));
    expect((await PATCH(request({ content: { elements: [] } }), context)).status).toBe(200);
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).not.toHaveProperty("baseRevision");
  });

  it.each([-1, 1.5, "5"])("rejects invalid baseRevision %s before calling collab", async (baseRevision) => {
    expect((await PATCH(request({ baseRevision, content: {} }), context)).status).toBe(400);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});

function request(body: object) {
  return new NextRequest("http://localhost:4512/api/sessions/s1/state", {
    method: "PATCH",
    body: JSON.stringify({ clientId: "guest-client", ...body }),
  });
}
