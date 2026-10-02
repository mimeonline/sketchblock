import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentOwner: vi.fn(),
  getCurrentAuthUser: vi.fn(),
  getValidSessionGrant: vi.fn(),
  getValidGuestGrant: vi.fn(),
  getSession: vi.fn(),
  getOwnedSession: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((destination: string) => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  }),
  requireOwnerPageAuth: vi.fn(),
  requirePageAuth: vi.fn(),
  validateSessionInvite: vi.fn(),
  isParticipantRemoved: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));

vi.mock("@/features/home/templates/HomeTemplate", () => ({
  JoinSessionTemplate: () => null,
}));

vi.mock("@/lib/server/auth/owner-session", () => ({
  getCurrentOwner: mocks.getCurrentOwner,
  requireOwnerPageAuth: mocks.requireOwnerPageAuth,
}));

vi.mock("@/lib/server/auth/session", () => ({
  getCurrentAuthUser: mocks.getCurrentAuthUser,
  requirePageAuth: mocks.requirePageAuth,
}));

vi.mock("@/lib/server/auth/guest-grant", () => ({ getValidGuestGrant: mocks.getValidGuestGrant }));
vi.mock("@/features/join/organisms/GuestJoinForm", () => ({ GuestJoinForm: () => null }));
vi.mock("@/lib/server/auth/session-grant", () => ({
  getValidSessionGrant: mocks.getValidSessionGrant,
}));

vi.mock("@/lib/server/database/session-invite-store", () => ({
  validateSessionInvite: mocks.validateSessionInvite,
  isParticipantRemoved: mocks.isParticipantRemoved,
}));

vi.mock("@/lib/server/database/session-store", () => ({
  getSession: mocks.getSession,
  getOwnedSession: mocks.getOwnedSession,
}));

import JoinSessionPage from "./page";

describe("join session page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isParticipantRemoved.mockResolvedValue(false);
    mocks.getSession.mockResolvedValue({ id: "session-123" });
    mocks.getOwnedSession.mockResolvedValue({ id: "session-123" });
    mocks.requireOwnerPageAuth.mockResolvedValue({ id: "owner-1", username: "admin" });
    mocks.getCurrentOwner.mockResolvedValue(null);
    mocks.getCurrentAuthUser.mockResolvedValue(null);
    mocks.getValidSessionGrant.mockResolvedValue(null);
    mocks.getValidGuestGrant.mockResolvedValue(null);
  });

  it("recovers a bare join URL as owner access for an authenticated owner", async () => {
    mocks.getCurrentOwner.mockResolvedValue({ id: "owner-1" });

    await expect(JoinSessionPage({
      params: Promise.resolve({ sessionId: "session-123" }),
      searchParams: Promise.resolve({}),
    })).rejects.toThrow("NEXT_REDIRECT:/join/session-123?owner=1");

    expect(mocks.redirect).toHaveBeenCalledWith("/join/session-123?owner=1");
    expect(mocks.getOwnedSession).toHaveBeenCalledWith("session-123", "owner-1");
    expect(mocks.validateSessionInvite).not.toHaveBeenCalled();
  });

  it("renders explicit owner access only for the session owner", async () => {
    await expect(JoinSessionPage({
      params: Promise.resolve({ sessionId: "session-123" }),
      searchParams: Promise.resolve({ owner: "1" }),
    })).resolves.toMatchObject({ props: { role: "owner" } });
    expect(mocks.getOwnedSession).toHaveBeenCalledWith("session-123", "owner-1");
  });

  it("rejects explicit owner access to another user's session", async () => {
    mocks.getOwnedSession.mockResolvedValue(null);
    await expect(JoinSessionPage({
      params: Promise.resolve({ sessionId: "session-123" }),
      searchParams: Promise.resolve({ owner: "1" }),
    })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("hides a foreign bare session from a local user without a grant", async () => {
    mocks.getCurrentOwner.mockResolvedValue({ id: "other-user" });
    mocks.getOwnedSession.mockResolvedValue(null);
    await expect(JoinSessionPage({
      params: Promise.resolve({ sessionId: "session-123" }),
      searchParams: Promise.resolve({}),
    })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("keeps hiding a bare join URL from unauthenticated visitors", async () => {
    await expect(JoinSessionPage({
      params: Promise.resolve({ sessionId: "session-123" }),
      searchParams: Promise.resolve({}),
    })).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mocks.notFound).toHaveBeenCalledOnce();
    expect(mocks.validateSessionInvite).not.toHaveBeenCalled();
  });

  it("restores participant access from a valid session grant", async () => {
    mocks.getCurrentOwner.mockResolvedValue({ id: "other-user" });
    mocks.getCurrentAuthUser.mockResolvedValue({ id: 42, login: "markus", name: "Markus" });
    mocks.getValidSessionGrant.mockResolvedValue({ role: "collaborator" });

    await expect(JoinSessionPage({
      params: Promise.resolve({ sessionId: "session-123" }),
      searchParams: Promise.resolve({}),
    })).resolves.toMatchObject({
      props: {
        identity: { login: "markus", displayName: "Markus" },
        role: "collaborator",
        sessionId: "session-123",
      },
    });

    expect(mocks.getValidSessionGrant).toHaveBeenCalledWith("session-123", 42);
    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(mocks.getOwnedSession).not.toHaveBeenCalled();
  });

  it("shows not-found to a removed participant", async () => {
    mocks.getCurrentOwner.mockResolvedValue(null);
    mocks.getCurrentAuthUser.mockResolvedValue({ id: 42, login: "markus", name: "Markus" });
    mocks.getValidSessionGrant.mockResolvedValue({ role: "viewer" });
    mocks.isParticipantRemoved.mockResolvedValue(true);

    await expect(JoinSessionPage({
      params: Promise.resolve({ sessionId: "session-123" }),
      searchParams: Promise.resolve({}),
    })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("exchanges a valid invite for a session grant after login", async () => {
    mocks.validateSessionInvite.mockResolvedValue({ id: "invite-1", role: "collaborator" });
    mocks.requirePageAuth.mockResolvedValue({ id: 42, login: "markus" });

    await expect(JoinSessionPage({
      params: Promise.resolve({ sessionId: "session-123" }),
      searchParams: Promise.resolve({ invite: "secret" }),
    })).rejects.toThrow("NEXT_REDIRECT:/api/sessions/session-123/claim?invite=secret");

    expect(mocks.requirePageAuth).toHaveBeenCalledWith("/join/session-123?invite=secret", "read");
  });

  it("returns an authenticated owner to session management when the session no longer exists", async () => {
    mocks.getSession.mockResolvedValue(null);
    mocks.getCurrentOwner.mockResolvedValue({ id: "owner-1" });

    await expect(JoinSessionPage({
      params: Promise.resolve({ sessionId: "deleted-session" }),
      searchParams: Promise.resolve({ owner: "1" }),
    })).rejects.toThrow("NEXT_REDIRECT:/sessions");

    expect(mocks.redirect).toHaveBeenCalledWith("/sessions");
    expect(mocks.requireOwnerPageAuth).not.toHaveBeenCalled();
  });

  it("keeps hiding a missing session from unauthenticated visitors", async () => {
    mocks.getSession.mockResolvedValue(null);
    mocks.getCurrentOwner.mockResolvedValue(null);

    await expect(JoinSessionPage({
      params: Promise.resolve({ sessionId: "unknown-session" }),
      searchParams: Promise.resolve({}),
    })).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it("renders the guest join form for a viewer invite when guests are enabled", async () => {
    mocks.getSession.mockResolvedValue({ id: "session-123", title: "Board", allowAnonymousViewers: true });
    mocks.validateSessionInvite.mockResolvedValue({ id: "i1", role: "viewer" });

    const result = await JoinSessionPage({
      params: Promise.resolve({ sessionId: "session-123" }),
      searchParams: Promise.resolve({ invite: "tok" }),
    });

    expect(result).toMatchObject({ props: { sessionId: "session-123", inviteToken: "tok", boardTitle: "Board" } });
    expect(mocks.requirePageAuth).not.toHaveBeenCalled();
  });

  it("keeps the GitHub login for collaborator invites or disabled guests", async () => {
    mocks.getSession.mockResolvedValue({ id: "session-123", allowAnonymousViewers: true });
    mocks.validateSessionInvite.mockResolvedValue({ id: "i1", role: "collaborator" });
    mocks.requirePageAuth.mockRejectedValue(new Error("NEXT_REDIRECT:/login"));
    await expect(JoinSessionPage({
      params: Promise.resolve({ sessionId: "session-123" }),
      searchParams: Promise.resolve({ invite: "tok" }),
    })).rejects.toThrow("NEXT_REDIRECT:/login");

    mocks.getSession.mockResolvedValue({ id: "session-123", allowAnonymousViewers: false });
    mocks.validateSessionInvite.mockResolvedValue({ id: "i1", role: "viewer" });
    await expect(JoinSessionPage({
      params: Promise.resolve({ sessionId: "session-123" }),
      searchParams: Promise.resolve({ invite: "tok" }),
    })).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("renders the session for a valid guest grant", async () => {
    mocks.getValidGuestGrant.mockResolvedValue({ guestId: "gabc", displayName: "Ada", inviteId: "i1" });
    await expect(JoinSessionPage({
      params: Promise.resolve({ sessionId: "session-123" }),
      searchParams: Promise.resolve({}),
    })).resolves.toMatchObject({ props: { identity: { login: "guest-gabc", displayName: "Ada" }, role: "viewer" } });
  });
});
