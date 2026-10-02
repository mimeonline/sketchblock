import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getActiveUserSession: vi.fn(),
  getAppUserById: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/server/auth/auth-mode", () => ({ isDevAuthMode: () => false, isDemoAuthMode: () => false, getDevAuthUser: vi.fn() }));
vi.mock("@/lib/server/database/user-session-store", () => ({
  getActiveUserSession: mocks.getActiveUserSession,
  createUserSession: vi.fn(),
  revokeUserSession: vi.fn(),
}));
vi.mock("@/lib/server/database/user-store", () => ({
  getAppUserById: mocks.getAppUserById,
  getAppUserGitHubIdentity: async () => null,
  getInstanceOwnerAppUser: vi.fn(),
}));
vi.mock("@/lib/server/database/instance-owner-store", () => ({
  getInstanceOwnerById: async () => null,
  hasInstanceOwner: async () => true,
}));

import { signPayload } from "./crypto";
import { requireLocalApiAuth, requireOwnerApiAuth } from "./owner-session";

describe("local API password-change lock", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.APP_AUTH_SECRET = "test-secret-long-enough-for-signing";
    const value = signPayload({ sessionId: "local-session", token: "local-token", expiresAt: Date.now() + 60_000 });
    mocks.cookies.mockResolvedValue({ get: () => ({ value }) });
    mocks.getActiveUserSession.mockResolvedValue({ user_id: "local-user" });
    mocks.getAppUserById.mockResolvedValue({ id: "local-user", username: "local", role: "user", status: "active", mustChangePassword: true });
  });

  it.each([requireLocalApiAuth, requireOwnerApiAuth])("blocks API owner authority until the local password changes", async (authorize) => {
    const result = await authorize();
    expect(result.response?.status).toBe(423);
    expect(await result.response?.json()).toMatchObject({ code: "password_change_required" });
  });
});
