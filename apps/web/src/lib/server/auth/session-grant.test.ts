import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  validateSessionInviteGrant: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/server/database/session-invite-store", () => ({
  validateSessionInviteGrant: mocks.validateSessionInviteGrant,
}));

import { createSessionGrantCookie, getValidSessionGrant } from "./session-grant";

describe("session grants", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.APP_AUTH_SECRET = "test-secret-that-is-long-enough-for-signing";
    process.env.APP_BASE_URL = "https://sketchblock.example.test";
  });

  it("creates a secure HttpOnly cookie without storing the invite token", () => {
    const cookie = createSessionGrantCookie({
      sessionId: "session-1",
      githubUserId: 42,
      invite: {
        id: "invite-1",
        sessionId: "session-1",
        role: "collaborator",
        token: "raw-invite-token",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    });

    expect(cookie.value).not.toContain("raw-invite-token");
    expect(cookie.options).toMatchObject({ httpOnly: true, sameSite: "lax", secure: true, path: "/" });
    expect(cookie.options.maxAge).toBeGreaterThan(0);
  });

  it("restores a grant only for the bound GitHub user and an active invite", async () => {
    const cookie = createSessionGrantCookie({
      sessionId: "session-1",
      githubUserId: 42,
      invite: {
        id: "invite-1",
        sessionId: "session-1",
        role: "viewer",
        token: "raw-invite-token",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    });
    mocks.cookies.mockResolvedValue({ get: (name: string) => name === cookie.name ? { value: cookie.value } : undefined });
    mocks.validateSessionInviteGrant.mockResolvedValue(true);

    await expect(getValidSessionGrant("session-1", 42)).resolves.toMatchObject({
      sessionId: "session-1",
      inviteId: "invite-1",
      role: "viewer",
      githubUserId: 42,
    });
    await expect(getValidSessionGrant("session-1", 7)).resolves.toBeNull();
    expect(mocks.validateSessionInviteGrant).toHaveBeenCalledOnce();
  });

  it("rejects a signed grant after its invite is revoked", async () => {
    const cookie = createSessionGrantCookie({
      sessionId: "session-1",
      githubUserId: 42,
      invite: {
        id: "invite-1",
        sessionId: "session-1",
        role: "collaborator",
        token: "raw-invite-token",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    });
    mocks.cookies.mockResolvedValue({ get: () => ({ value: cookie.value }) });
    mocks.validateSessionInviteGrant.mockResolvedValue(false);

    await expect(getValidSessionGrant("session-1", 42)).resolves.toBeNull();
  });

  it("rejects an expired signed grant before querying its invite", async () => {
    const cookie = createSessionGrantCookie({
      sessionId: "session-1",
      githubUserId: 42,
      invite: {
        id: "invite-1",
        sessionId: "session-1",
        role: "viewer",
        token: "raw-invite-token",
        expiresAt: new Date(Date.now() - 1_000).toISOString(),
      },
    });
    mocks.cookies.mockResolvedValue({ get: () => ({ value: cookie.value }) });

    await expect(getValidSessionGrant("session-1", 42)).resolves.toBeNull();
    expect(mocks.validateSessionInviteGrant).not.toHaveBeenCalled();
  });
});
