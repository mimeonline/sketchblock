import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieValue: undefined as string | undefined,
  validateSessionInviteGrant: vi.fn(),
  getSession: vi.fn(),
  getSessionGuest: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (mocks.cookieValue ? { value: mocks.cookieValue } : undefined),
    getAll: () => [],
    delete: vi.fn(),
  }),
}));
vi.mock("@/lib/server/database/session-invite-store", () => ({ validateSessionInviteGrant: mocks.validateSessionInviteGrant }));
vi.mock("@/lib/server/database/session-store", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/server/database/session-guest-store", () => ({ getSessionGuest: mocks.getSessionGuest }));

import { createGuestGrantCookie, getValidGuestGrant } from "./guest-grant";

describe("guest grant", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.APP_AUTH_SECRET = "test-secret-with-more-than-24-chars";
    const cookie = createGuestGrantCookie({
      sessionId: "s1",
      invite: { id: "i1", sessionId: "s1", role: "viewer", token: "t", expiresAt: null },
      guestId: "gabc",
    });
    mocks.cookieValue = cookie.value;
    mocks.validateSessionInviteGrant.mockResolvedValue(true);
    mocks.getSession.mockResolvedValue({ id: "s1", status: "active", allowAnonymousViewers: true });
    mocks.getSessionGuest.mockResolvedValue({ id: "gabc", displayName: "Ada", removedAt: null });
  });

  it("builds a scoped, httpOnly cookie", () => {
    const cookie = createGuestGrantCookie({
      sessionId: "s1",
      invite: { id: "i1", sessionId: "s1", role: "viewer", token: "t", expiresAt: null },
      guestId: "gabc",
    });
    expect(cookie.name).toMatch(/^sketchblock_guest_[0-9a-f]{24}$/);
    expect(cookie.options).toMatchObject({ httpOnly: true, sameSite: "lax" });
    expect(cookie.options.maxAge).toBeLessThanOrEqual(12 * 3600);
  });

  it("accepts a valid grant", async () => {
    expect(await getValidGuestGrant("s1")).toEqual({ guestId: "gabc", displayName: "Ada", inviteId: "i1" });
    expect(mocks.validateSessionInviteGrant).toHaveBeenCalledWith("s1", "i1", "viewer");
  });

  it("rejects missing, tampered or foreign-session cookies", async () => {
    expect(await getValidGuestGrant("other")).toBeNull();
    mocks.cookieValue = `${mocks.cookieValue}x`;
    expect(await getValidGuestGrant("s1")).toBeNull();
    mocks.cookieValue = undefined;
    expect(await getValidGuestGrant("s1")).toBeNull();
  });

  it("rejects when the flag is off, session closed, guest removed or invite rotated", async () => {
    mocks.getSession.mockResolvedValue({ id: "s1", status: "active", allowAnonymousViewers: false });
    expect(await getValidGuestGrant("s1")).toBeNull();
    mocks.getSession.mockResolvedValue({ id: "s1", status: "closed", allowAnonymousViewers: true });
    expect(await getValidGuestGrant("s1")).toBeNull();
    mocks.getSession.mockResolvedValue({ id: "s1", status: "active", allowAnonymousViewers: true });
    mocks.getSessionGuest.mockResolvedValue({ id: "gabc", displayName: "Ada", removedAt: "2026-01-01" });
    expect(await getValidGuestGrant("s1")).toBeNull();
    mocks.getSessionGuest.mockResolvedValue({ id: "gabc", displayName: "Ada", removedAt: null });
    mocks.validateSessionInviteGrant.mockResolvedValue(false);
    expect(await getValidGuestGrant("s1")).toBeNull();
  });
});
