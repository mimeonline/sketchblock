import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  inspectCollabSession: vi.fn(),
  kickCollabClient: vi.fn(),
  findParticipantUserIdByLogin: vi.fn(),
  markParticipantRemoved: vi.fn(),
}));

vi.mock("@/lib/server/auth/owner-session", () => ({
  requireOwnerApiAuth: async () => ({ owner: { id: "owner-1" }, response: null }),
}));
vi.mock("@/lib/server/auth/request-security", () => ({ rejectCrossOriginRequest: () => null }));
vi.mock("@/lib/server/collab/collab-server-client", () => ({
  inspectCollabSession: mocks.inspectCollabSession,
  kickCollabClient: mocks.kickCollabClient,
}));
vi.mock("@/lib/server/database/session-invite-store", () => ({
  findParticipantUserIdByLogin: mocks.findParticipantUserIdByLogin,
  markParticipantRemoved: mocks.markParticipantRemoved,
}));
vi.mock("@/lib/server/database/session-store", () => ({ getOwnedSession: async () => ({ id: "s1" }) }));

import { DELETE } from "./route";

const call = (socketId: string) =>
  DELETE(new Request(`http://localhost:4512/api/sessions/s1/clients/${socketId}`, { method: "DELETE" }), {
    params: Promise.resolve({ sessionId: "s1", socketId }),
  });

describe("remove session client", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.kickCollabClient.mockResolvedValue({ status: "registered" });
    mocks.findParticipantUserIdByLogin.mockResolvedValue(42);
    mocks.inspectCollabSession.mockResolvedValue({
      presence: [
        { socketId: "owner-socket", userId: "owner-login", role: "owner" },
        { socketId: "guest-socket", userId: "guest-login", role: "collaborator" },
      ],
    });
  });

  it("excludes a participant from the session", async () => {
    const response = await call("guest-socket");
    expect(response.status).toBe(200);
    expect(mocks.markParticipantRemoved).toHaveBeenCalledWith("s1", 42, "owner-1");
    expect(mocks.kickCollabClient).toHaveBeenCalledWith("s1", "guest-socket", { excludeActor: true });
  });

  it("only disconnects owner sockets without excluding anyone", async () => {
    await call("owner-socket");
    expect(mocks.markParticipantRemoved).not.toHaveBeenCalled();
    expect(mocks.kickCollabClient).toHaveBeenCalledWith("s1", "owner-socket", { excludeActor: false });
  });
});
