import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createCollabTicket: vi.fn(() => "signed-ticket"),
  getCurrentOwner: vi.fn(),
  getCurrentAuthUser: vi.fn(),
  getValidSessionGrant: vi.fn(),
  getSession: vi.fn(),
  getOwnedSession: vi.fn(),
  validateSessionInvite: vi.fn(),
  recordSessionParticipant: vi.fn(),
}));

vi.mock("@/lib/server/auth/collab-ticket", () => ({ createCollabTicket: mocks.createCollabTicket }));
vi.mock("@/lib/server/auth/owner-session", () => ({ getCurrentOwner: mocks.getCurrentOwner }));
vi.mock("@/lib/server/auth/session", () => ({ getCurrentAuthUser: mocks.getCurrentAuthUser }));
vi.mock("@/lib/server/auth/session-grant", () => ({ getValidSessionGrant: mocks.getValidSessionGrant }));
vi.mock("@/lib/server/database/session-store", () => ({ getSession: mocks.getSession, getOwnedSession: mocks.getOwnedSession }));
vi.mock("@/lib/server/database/session-invite-store", () => ({
  validateSessionInvite: mocks.validateSessionInvite,
  recordSessionParticipant: mocks.recordSessionParticipant,
}));

import { POST } from "./route";

describe("socket auth token route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.createCollabTicket.mockReturnValue("signed-ticket");
    mocks.getSession.mockResolvedValue({ id: "session-1" });
    mocks.getOwnedSession.mockResolvedValue({ id: "session-1" });
  });

  it("issues owner tickets only from the local owner session", async () => {
    mocks.getCurrentOwner.mockResolvedValue({
      id: "owner-1",
      username: "admin",
      githubLogin: "mimeonline",
      githubName: "Michael",
    });

    const response = await POST(request({ sessionId: "session-1", role: "owner", clientId: "client-1" }));

    expect(response.status).toBe(200);
    expect(mocks.getOwnedSession).toHaveBeenCalledWith("session-1", "owner-1");
    expect(mocks.createCollabTicket).toHaveBeenCalledWith(expect.objectContaining({
      role: "owner",
      actor: "mimeonline",
      permission: "admin",
    }));
  });

  it("rejects owner tickets for another local user's session", async () => {
    mocks.getCurrentOwner.mockResolvedValue({ id: "other-user", username: "other" });
    mocks.getOwnedSession.mockResolvedValue(null);

    const response = await POST(request({ sessionId: "session-1", role: "owner", clientId: "client-1" }));

    expect(response.status).toBe(404);
    expect(mocks.getOwnedSession).toHaveBeenCalledWith("session-1", "other-user");
    expect(mocks.createCollabTicket).not.toHaveBeenCalled();
  });

  it("locks owner tickets until the required password change", async () => {
    mocks.getCurrentOwner.mockResolvedValue({ id: "owner-1", username: "admin", mustChangePassword: true });
    const response = await POST(request({ sessionId: "session-1", role: "owner", clientId: "client-1" }));
    expect(response.status).toBe(423);
    expect(await response.json()).toMatchObject({ code: "password_change_required" });
    expect(mocks.createCollabTicket).not.toHaveBeenCalled();
  });

  it("preserves the development owner's unowned-session exception", async () => {
    mocks.getCurrentOwner.mockResolvedValue({ id: "dev-owner", username: "dev" });

    const response = await POST(request({ sessionId: "session-1", role: "owner", clientId: "client-1" }));

    expect(response.status).toBe(200);
    expect(mocks.getOwnedSession).toHaveBeenCalledWith("session-1", null);
  });

  it("uses the server-side invite role even when the client requests collaborator", async () => {
    mocks.getCurrentAuthUser.mockResolvedValue({
      id: 42,
      login: "markus",
      name: "Markus",
      avatarUrl: null,
    });
    mocks.validateSessionInvite.mockResolvedValue({ role: "viewer" });

    const response = await POST(request({
      sessionId: "session-1",
      role: "collaborator",
      clientId: "client-1",
      inviteToken: "viewer-secret",
    }));

    expect(response.status).toBe(200);
    expect(mocks.createCollabTicket).toHaveBeenCalledWith(expect.objectContaining({
      role: "viewer",
      actor: "markus",
      permission: "read",
    }));
  });

  it("rejects a participant without a valid invite", async () => {
    mocks.getCurrentAuthUser.mockResolvedValue({ id: 42, login: "markus" });
    mocks.validateSessionInvite.mockResolvedValue(null);

    const response = await POST(request({
      sessionId: "session-1",
      role: "collaborator",
      clientId: "client-1",
      inviteToken: "invalid",
    }));

    expect(response.status).toBe(401);
    expect(mocks.createCollabTicket).not.toHaveBeenCalled();
  });

  it("issues participant tickets from a valid session grant", async () => {
    mocks.getCurrentOwner.mockResolvedValue({ id: "other-user", username: "other" });
    mocks.getCurrentAuthUser.mockResolvedValue({
      id: 42,
      login: "markus",
      name: "Markus",
      avatarUrl: null,
    });
    mocks.getValidSessionGrant.mockResolvedValue({ role: "collaborator" });

    const response = await POST(request({
      sessionId: "session-1",
      role: "collaborator",
      clientId: "client-1",
    }));

    expect(response.status).toBe(200);
    expect(mocks.getValidSessionGrant).toHaveBeenCalledWith("session-1", 42);
    expect(mocks.createCollabTicket).toHaveBeenCalledWith(expect.objectContaining({
      role: "collaborator",
      actor: "markus",
    }));
  });

  it("rejects participant tickets when the stored grant is invalid", async () => {
    mocks.getCurrentAuthUser.mockResolvedValue({ id: 42, login: "markus" });
    mocks.getValidSessionGrant.mockResolvedValue(null);

    const response = await POST(request({ sessionId: "session-1", role: "viewer", clientId: "client-1" }));

    expect(response.status).toBe(401);
    expect(mocks.createCollabTicket).not.toHaveBeenCalled();
  });

  it("refuses socket tickets for an ended session", async () => {
    mocks.getSession.mockResolvedValue({ id: "session-1", status: "closed" });

    const response = await POST(request({ sessionId: "session-1", role: "owner", clientId: "client-1" }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "session_closed" });
  });
});

function request(body: object) {
  return new NextRequest("http://localhost:4512/api/auth/socket-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
