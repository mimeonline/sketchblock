import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consumeAuthAttempt: vi.fn(),
  getSession: vi.fn(),
  validateSessionInvite: vi.fn(),
  createSessionGuest: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/lib/server/auth/request-security", () => ({
  rejectCrossOriginRequest: (request: Request) =>
    request.headers.get("origin") === "http://localhost:4512" ? null : Response.json({ code: "invalid_origin" }, { status: 403 }),
  consumeAuthAttempt: mocks.consumeAuthAttempt,
}));
vi.mock("@/lib/server/auth/guest-grant", () => ({
  createGuestGrantCookie: () => ({ name: "sketchblock_guest_x", value: "signed", options: { httpOnly: true, path: "/" } }),
}));
vi.mock("@/lib/server/audit/audit-service", () => ({ safeRecordAuditEvent: mocks.audit }));
vi.mock("@/lib/server/database/session-store", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/server/database/session-guest-store", () => ({ createSessionGuest: mocks.createSessionGuest }));
vi.mock("@/lib/server/database/session-invite-store", () => ({ validateSessionInvite: mocks.validateSessionInvite }));

import { POST } from "./route";

const call = (body: unknown, origin = "http://localhost:4512") =>
  POST(
    new NextRequest("http://localhost:4512/api/sessions/s1/claim-guest", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ sessionId: "s1" }) },
  );

describe("POST /api/sessions/[sessionId]/claim-guest", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.consumeAuthAttempt.mockReturnValue({ allowed: true, retryAfterSeconds: 0 });
    mocks.getSession.mockResolvedValue({ id: "s1", status: "active", allowAnonymousViewers: true });
    mocks.validateSessionInvite.mockResolvedValue({ id: "i1", role: "viewer", expiresAt: null });
    mocks.createSessionGuest.mockResolvedValue({ id: "gabc" });
  });

  it("creates a guest and sets the grant cookie", async () => {
    const response = await call({ invite: "tok", displayName: "  Ada\u0007 Lovelace " });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, redirect: "/join/s1" });
    expect(mocks.createSessionGuest).toHaveBeenCalledWith({ sessionId: "s1", inviteId: "i1", displayName: "Ada Lovelace" });
    expect(response.headers.get("set-cookie")).toContain("sketchblock_guest_x=signed");
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "session.guest.join" }));
    expect(mocks.consumeAuthAttempt).toHaveBeenCalledWith(expect.anything(), "guest:s1", 30);
  });

  it("rejects cross-origin requests", async () => {
    expect((await call({ invite: "tok", displayName: "A" }, "https://evil.example")).status).toBe(403);
  });

  it("rate limits", async () => {
    mocks.consumeAuthAttempt.mockReturnValue({ allowed: false, retryAfterSeconds: 5 });
    const response = await call({ invite: "tok", displayName: "A" });
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ code: "rate_limited" });
  });

  it.each(["", "   ", "\u0001\u0002", "x".repeat(41)])("rejects invalid name %#", async (displayName) => {
    const response = await call({ invite: "tok", displayName });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "invalid_name" });
  });

  it("rejects unknown and non-viewer invites", async () => {
    mocks.validateSessionInvite.mockResolvedValue(null);
    expect((await call({ invite: "tok", displayName: "A" })).status).toBe(404);
    mocks.validateSessionInvite.mockResolvedValue({ id: "i2", role: "collaborator" });
    const response = await call({ invite: "tok", displayName: "A" });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "invalid_invite" });
    expect(mocks.createSessionGuest).not.toHaveBeenCalled();
  });

  it("returns 410 for closed sessions and 403 when guests are disabled", async () => {
    mocks.getSession.mockResolvedValue({ id: "s1", status: "closed", allowAnonymousViewers: true });
    const closed = await call({ invite: "tok", displayName: "A" });
    expect(closed.status).toBe(410);
    expect(await closed.json()).toMatchObject({ code: "session_closed" });

    mocks.getSession.mockResolvedValue({ id: "s1", status: "active", allowAnonymousViewers: false });
    const disabled = await call({ invite: "tok", displayName: "A" });
    expect(disabled.status).toBe(403);
    expect(await disabled.json()).toMatchObject({ code: "guests_disabled" });
    expect(mocks.createSessionGuest).not.toHaveBeenCalled();
  });
});
