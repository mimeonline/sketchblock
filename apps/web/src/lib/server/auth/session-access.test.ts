import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentOwner: vi.fn(),
  getCurrentAuthUser: vi.fn(),
  getValidSessionGrant: vi.fn(),
  getValidGuestGrant: vi.fn(),
  touchSessionGuest: vi.fn(),
  getOwnedSession: vi.fn(),
  getSession: vi.fn(),
  validateSessionInvite: vi.fn(),
  recordSessionParticipant: vi.fn(),
  isParticipantRemoved: vi.fn(),
}));

vi.mock("@/lib/server/auth/owner-session", () => ({ getCurrentOwner: mocks.getCurrentOwner }));
vi.mock("@/lib/server/auth/session", () => ({ getCurrentAuthUser: mocks.getCurrentAuthUser }));
vi.mock("@/lib/server/auth/guest-grant", () => ({ getValidGuestGrant: mocks.getValidGuestGrant }));
vi.mock("@/lib/server/database/session-guest-store", () => ({ touchSessionGuest: mocks.touchSessionGuest }));
vi.mock("@/lib/server/auth/session-grant", () => ({ getValidSessionGrant: mocks.getValidSessionGrant }));
vi.mock("@/lib/server/database/session-store", () => ({ getOwnedSession: mocks.getOwnedSession, getSession: mocks.getSession }));
vi.mock("@/lib/server/database/session-invite-store", () => ({
  validateSessionInvite: mocks.validateSessionInvite,
  recordSessionParticipant: mocks.recordSessionParticipant,
  isParticipantRemoved: mocks.isParticipantRemoved,
}));

import { authorizeSessionRequest } from "./session-access";

describe("session access", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getOwnedSession.mockResolvedValue({ id: "s1" });
    mocks.getSession.mockResolvedValue({ id: "s1", status: "active" });
    mocks.getCurrentOwner.mockResolvedValue(null);
    mocks.getCurrentAuthUser.mockResolvedValue(null);
    mocks.getValidSessionGrant.mockResolvedValue(null);
    mocks.getValidGuestGrant.mockResolvedValue(null);
    mocks.touchSessionGuest.mockResolvedValue(undefined);
  });

  it("restores collaborator API access from the session grant cookie", async () => {
    mocks.getCurrentOwner.mockResolvedValue({ id: "other-user" });
    mocks.getOwnedSession.mockResolvedValue(null);
    mocks.getCurrentAuthUser.mockResolvedValue({ id: 42, login: "markus", name: "Markus" });
    mocks.getValidSessionGrant.mockResolvedValue({ role: "collaborator" });

    const result = await authorizeSessionRequest(
      new NextRequest("http://localhost:4512/api/sessions/s1/state"),
      "s1",
      "edit",
    );

    expect(result.response).toBeNull();
    expect(result.access).toMatchObject({ role: "collaborator", actor: "markus" });
  });

  it("rejects a foreign local user requesting owner access even with a guest grant", async () => {
    mocks.getCurrentOwner.mockResolvedValue({ id: "other-user" });
    mocks.getOwnedSession.mockResolvedValue(null);
    mocks.getCurrentAuthUser.mockResolvedValue({ id: 42, login: "markus" });
    mocks.getValidSessionGrant.mockResolvedValue({ role: "collaborator" });

    const result = await authorizeSessionRequest(new NextRequest("http://localhost:4512/api/sessions/s1/state"), "s1", "owner");

    expect(result.access).toBeNull();
    expect(result.response?.status).toBe(404);
  });

  it("rejects a foreign local user with an expired or revoked grant", async () => {
    mocks.getCurrentOwner.mockResolvedValue({ id: "other-user" });
    mocks.getOwnedSession.mockResolvedValue(null);
    mocks.getCurrentAuthUser.mockResolvedValue({ id: 42, login: "markus" });

    const result = await authorizeSessionRequest(new NextRequest("http://localhost:4512/api/sessions/s1/state"), "s1", "edit");

    expect(result.access).toBeNull();
    expect(result.response?.status).toBe(401);
  });

  it.each(["view", "edit", "owner"] as const)("locks %s access from a local owner awaiting a password change", async (required) => {
    mocks.getCurrentOwner.mockResolvedValue({ id: "owner-1", mustChangePassword: true });
    const result = await authorizeSessionRequest(new NextRequest("http://localhost:4512/api/sessions/s1/state"), "s1", required);
    expect(result.access).toBeNull();
    expect(result.response?.status).toBe(423);
  });

  it("preserves independently authenticated guest access while local owner access is locked", async () => {
    mocks.getCurrentOwner.mockResolvedValue({ id: "owner-1", mustChangePassword: true });
    mocks.getCurrentAuthUser.mockResolvedValue({ id: 42, login: "markus" });
    mocks.getValidSessionGrant.mockResolvedValue({ role: "collaborator" });
    const result = await authorizeSessionRequest(new NextRequest("http://localhost:4512/api/sessions/s1/state"), "s1", "edit");
    expect(result.response).toBeNull();
    expect(result.access).toMatchObject({ role: "collaborator", actor: "markus", permission: "read" });
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

  it("rejects participant access to an ended session even with a valid grant", async () => {
    mocks.getSession.mockResolvedValue({ id: "s1", status: "closed" });
    mocks.getCurrentAuthUser.mockResolvedValue({ id: 42, login: "markus" });
    mocks.getValidSessionGrant.mockResolvedValue({ role: "collaborator" });

    const viewResult = await authorizeSessionRequest(new NextRequest("http://localhost:4512/api/sessions/s1/state"), "s1", "view");
    const inviteResult = await authorizeSessionRequest(new NextRequest("http://localhost:4512/api/sessions/s1/state?invite=token"), "s1", "edit");

    expect(viewResult.response?.status).toBe(410);
    expect(inviteResult.response?.status).toBe(410);
    expect(mocks.recordSessionParticipant).not.toHaveBeenCalled();
  });

  it("lets the owner read but not edit an ended session", async () => {
    mocks.getSession.mockResolvedValue({ id: "s1", status: "closed" });
    mocks.getCurrentOwner.mockResolvedValue({ id: "owner-1", username: "owner", mustChangePassword: false });

    const view = await authorizeSessionRequest(new NextRequest("http://localhost:4512/api/sessions/s1/state"), "s1", "view");
    const edit = await authorizeSessionRequest(new NextRequest("http://localhost:4512/api/sessions/s1/state"), "s1", "edit");

    expect(view.access).toMatchObject({ role: "owner" });
    expect(edit.response?.status).toBe(410);
  });

  it("grants view access to a valid guest as a viewer without recording a participant", async () => {
    mocks.getOwnedSession.mockResolvedValue(null);
    mocks.getValidGuestGrant.mockResolvedValue({ guestId: "gabc", displayName: "Ada", inviteId: "i1" });

    const result = await authorizeSessionRequest(new NextRequest("http://localhost:4512/api/sessions/s1/state"), "s1", "view");

    expect(result.response).toBeNull();
    expect(result.access).toEqual({ role: "viewer", actor: "guest-gabc", displayName: "Ada", permission: "read" });
    expect(mocks.recordSessionParticipant).not.toHaveBeenCalled();
    expect(mocks.touchSessionGuest).toHaveBeenCalledWith("s1", "gabc");
  });

  it.each(["edit", "owner"] as const)("rejects %s access for guests with 403", async (required) => {
    mocks.getOwnedSession.mockResolvedValue(null);
    mocks.getValidGuestGrant.mockResolvedValue({ guestId: "gabc", displayName: "Ada", inviteId: "i1" });

    const result = await authorizeSessionRequest(new NextRequest("http://localhost:4512/api/sessions/s1/state"), "s1", required);

    expect(result.access).toBeNull();
    expect(result.response?.status).toBe(403);
  });
});
