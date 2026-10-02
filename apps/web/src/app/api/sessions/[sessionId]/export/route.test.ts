import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  getSession: vi.fn(),
  snapshot: vi.fn(),
}));

vi.mock("@/lib/server/auth/session-access", () => ({ authorizeSessionRequest: mocks.authorize }));
vi.mock("@/lib/server/database/session-store", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/server/collab/collab-server-client", () => ({ getCollabSessionSnapshot: mocks.snapshot }));

import { GET } from "./route";

const call = () =>
  GET(new NextRequest("http://localhost:4512/api/sessions/s1/export"), { params: Promise.resolve({ sessionId: "s1" }) });

describe("GET /api/sessions/[sessionId]/export", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getSession.mockResolvedValue({ id: "s1", title: "My Board", drawingPath: "adhoc/x.excalidraw", participantDownload: false });
    mocks.snapshot.mockResolvedValue({ snapshot: null, materializedContent: { elements: [] } });
  });

  it("lets the owner download with a content disposition", async () => {
    mocks.authorize.mockResolvedValue({ access: { role: "owner" }, response: null });
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain('filename="My Board.excalidraw"');
    expect(response.headers.get("Content-Disposition")).toContain("filename*=UTF-8''My%20Board.excalidraw");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ elements: [] });
  });

  it("forbids participants when downloads are disabled", async () => {
    mocks.authorize.mockResolvedValue({ access: { role: "viewer" }, response: null });
    const response = await call();
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "download_disabled" });
  });

  it("allows participants when downloads are enabled", async () => {
    mocks.authorize.mockResolvedValue({ access: { role: "viewer" }, response: null });
    mocks.getSession.mockResolvedValue({ id: "s1", title: null, drawingPath: "a/b.excalidraw", participantDownload: true });
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain('filename="b.excalidraw"');
  });

  it("passes through authorization failures", async () => {
    mocks.authorize.mockResolvedValue({ access: null, response: NextResponse.json({}, { status: 410 }) });
    expect((await call()).status).toBe(410);
  });
});
