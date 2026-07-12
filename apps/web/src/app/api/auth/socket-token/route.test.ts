import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createCollabTicket: vi.fn(() => "signed-ticket"),
  getCurrentOwner: vi.fn(),
  getCurrentAuthUser: vi.fn(),
  getSession: vi.fn(),
  validateSessionInvite: vi.fn(),
  recordSessionParticipant: vi.fn(),
}));

vi.mock("@/lib/server/auth/collab-ticket", () => ({ createCollabTicket: mocks.createCollabTicket }));
vi.mock("@/lib/server/auth/owner-session", () => ({ getCurrentOwner: mocks.getCurrentOwner }));
vi.mock("@/lib/server/auth/session", () => ({ getCurrentAuthUser: mocks.getCurrentAuthUser }));
vi.mock("@/lib/server/database/session-store", () => ({ getSession: mocks.getSession }));
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
  });

  it("issues owner tickets only from the local owner session", async () => {
    mocks.getCurrentOwner.mockResolvedValue({
      username: "admin",
      githubLogin: "mimeonline",
      githubName: "Michael",
    });

    const response = await POST(request({ sessionId: "session-1", role: "owner", clientId: "client-1" }));

    expect(response.status).toBe(200);
    expect(mocks.createCollabTicket).toHaveBeenCalledWith(expect.objectContaining({
      role: "owner",
      actor: "mimeonline",
      permission: "admin",
    }));
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
});

function request(body: object) {
  return new NextRequest("http://localhost:4512/api/auth/socket-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
