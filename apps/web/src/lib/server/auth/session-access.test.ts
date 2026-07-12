import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentOwner: vi.fn(),
  getCurrentAuthUser: vi.fn(),
  getOwnedSession: vi.fn(),
  validateSessionInvite: vi.fn(),
  recordSessionParticipant: vi.fn(),
}));

vi.mock("@/lib/server/auth/owner-session", () => ({ getCurrentOwner: mocks.getCurrentOwner }));
vi.mock("@/lib/server/auth/session", () => ({ getCurrentAuthUser: mocks.getCurrentAuthUser }));
vi.mock("@/lib/server/database/session-store", () => ({ getOwnedSession: mocks.getOwnedSession }));
vi.mock("@/lib/server/database/session-invite-store", () => ({
  validateSessionInvite: mocks.validateSessionInvite,
  recordSessionParticipant: mocks.recordSessionParticipant,
}));

import { authorizeSessionRequest } from "./session-access";

describe("session access", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getOwnedSession.mockResolvedValue({ id: "s1" });
  });

  it("grants owner access only from the local owner session", async () => {
    mocks.getCurrentOwner.mockResolvedValue({
      id: "owner-1",
      username: "admin",
      role: "instance_owner",
      githubLogin: "mimeonline",
      githubName: "Michael",
    });

    const result = await authorizeSessionRequest(
      new NextRequest("http://localhost:4512/api/sessions/s1/state"),
      "s1",
      "owner",
    );

    expect(result.response).toBeNull();
    expect(result.access).toMatchObject({ role: "owner", actor: "mimeonline", permission: "admin" });
  });

  it("derives participant role from the invite and rejects viewer edits", async () => {
    mocks.getCurrentAuthUser.mockResolvedValue({
      id: 42,
      login: "markus",
      name: "Markus",
      avatarUrl: null,
    });
    mocks.validateSessionInvite.mockResolvedValue({ role: "viewer" });

    const result = await authorizeSessionRequest(
      new NextRequest("http://localhost:4512/api/sessions/s1/state?invite=secret"),
      "s1",
      "edit",
    );

    expect(result.access).toBeNull();
    expect(result.response?.status).toBe(403);
    expect(mocks.recordSessionParticipant).not.toHaveBeenCalled();
  });

  it("allows collaborator edits and records the GitHub identity", async () => {
    mocks.getCurrentAuthUser.mockResolvedValue({
      id: 42,
      login: "markus",
      name: "Markus",
      avatarUrl: "https://avatars.example/42",
    });
    mocks.validateSessionInvite.mockResolvedValue({ role: "collaborator" });

    const result = await authorizeSessionRequest(
      new NextRequest("http://localhost:4512/api/sessions/s1/state?invite=secret"),
      "s1",
      "edit",
    );

    expect(result.response).toBeNull();
    expect(result.access).toMatchObject({ role: "collaborator", actor: "markus" });
    expect(mocks.recordSessionParticipant).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: "s1",
      githubUserId: 42,
      role: "collaborator",
    }));
  });
});
