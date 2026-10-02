import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getOwnedSession: vi.fn(), setParticipantDownload: vi.fn(), setAllowAnonymousViewers: vi.fn(), audit: vi.fn() }));

vi.mock("@/lib/server/auth/request-security", () => ({
  rejectCrossOriginRequest: (request: Request) =>
    request.headers.get("origin") === "http://localhost:4512"
      ? null
      : Response.json({ code: "invalid_origin" }, { status: 403 }),
}));
vi.mock("@/lib/server/auth/owner-session", () => ({
  requireOwnerApiAuth: async () => ({ owner: { id: "u1", username: "o", role: "owner" }, response: null }),
}));
vi.mock("@/lib/server/database/session-store", () => ({
  getOwnedSession: mocks.getOwnedSession,
  setParticipantDownload: mocks.setParticipantDownload,
  setAllowAnonymousViewers: mocks.setAllowAnonymousViewers,
}));
vi.mock("@/lib/server/audit/audit-service", () => ({ safeRecordAuditEvent: mocks.audit }));

import { PATCH } from "./route";

const call = (origin = "http://localhost:4512", body: unknown = { participantDownload: false }) =>
  PATCH(
    new NextRequest("http://localhost:4512/api/sessions/s1/settings", {
      method: "PATCH",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ sessionId: "s1" }) },
  );

describe("PATCH /api/sessions/[sessionId]/settings", () => {
  beforeEach(() => vi.resetAllMocks());

  it("updates the flag for the owner", async () => {
    mocks.getOwnedSession.mockResolvedValue({ id: "s1" });
    mocks.setParticipantDownload.mockResolvedValue({ id: "s1", participantDownload: false });
    const response = await call();
    expect(response.status).toBe(200);
    expect(mocks.getOwnedSession).toHaveBeenCalledWith("s1", "u1");
    expect(mocks.setParticipantDownload).toHaveBeenCalledWith("s1", false, "u1");
    expect(await response.json()).toEqual({ session: { id: "s1", participantDownload: false } });
  });

  it("returns 404 for non-owners", async () => {
    mocks.getOwnedSession.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
    expect(mocks.setParticipantDownload).not.toHaveBeenCalled();
  });

  it("rejects cross-origin and invalid bodies", async () => {
    expect((await call("https://evil.example")).status).toBe(403);
    mocks.getOwnedSession.mockResolvedValue({ id: "s1" });
    expect((await call(undefined, { participantDownload: "x" })).status).toBe(400);
  });

  it("toggles guest viewers and audits the change", async () => {
    mocks.getOwnedSession.mockResolvedValue({ id: "s1" });
    mocks.setAllowAnonymousViewers.mockResolvedValue({ id: "s1", allowAnonymousViewers: true });
    const response = await call(undefined, { allowAnonymousViewers: true });
    expect(response.status).toBe(200);
    expect(mocks.setAllowAnonymousViewers).toHaveBeenCalledWith("s1", true, "u1");
    expect(mocks.setParticipantDownload).not.toHaveBeenCalled();
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "session.guests.enable" }));
    await call(undefined, { allowAnonymousViewers: false });
    expect(mocks.audit).toHaveBeenLastCalledWith(expect.objectContaining({ action: "session.guests.disable" }));
  });

  it("rejects an empty body", async () => {
    mocks.getOwnedSession.mockResolvedValue({ id: "s1" });
    expect((await call(undefined, {})).status).toBe(400);
  });
});
