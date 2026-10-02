import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieMocks = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  getCurrentOwner: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    delete: cookieMocks.delete,
    get: cookieMocks.get,
    set: cookieMocks.set,
  })),
}));

vi.mock("@/lib/server/auth/owner-session", () => ({
  getCurrentOwner: cookieMocks.getCurrentOwner,
}));

import {
  clearAuthCookie,
  getGitHubAccessToken,
  getLoginPath,
  sanitizeReturnTo,
  setGitHubAccessTokenCookie,
} from "./session";
import { encryptSecret } from "./crypto";

describe("GitHub access token binding", () => {
  vi.stubEnv("APP_AUTH_SECRET", "test-secret-test-secret-test-secret-1234");
  beforeEach(() => {
    cookieMocks.get.mockReset();
    cookieMocks.set.mockReset();
    cookieMocks.getCurrentOwner.mockReset();
  });

  async function storeToken(token: string, userId: string) {
    await setGitHubAccessTokenCookie(token, userId);
    return cookieMocks.set.mock.calls[0][1] as string;
  }

  it("returns the token for the owner it was issued to", async () => {
    const value = await storeToken("gho_a", "user-a");
    cookieMocks.get.mockReturnValue({ value });
    cookieMocks.getCurrentOwner.mockResolvedValue({ id: "user-a" });
    expect(await getGitHubAccessToken()).toBe("gho_a");
  });

  it("ignores a token issued to a different user", async () => {
    const value = await storeToken("gho_a", "user-a");
    cookieMocks.get.mockReturnValue({ value });
    cookieMocks.getCurrentOwner.mockResolvedValue({ id: "user-b" });
    expect(await getGitHubAccessToken()).toBeNull();
  });

  it("ignores legacy unbound cookies", async () => {
    cookieMocks.get.mockReturnValue({ value: encryptSecret("gho_legacy") });
    cookieMocks.getCurrentOwner.mockResolvedValue({ id: "user-a" });
    expect(await getGitHubAccessToken()).toBeNull();
  });
});

describe("auth cookie cleanup", () => {
  beforeEach(() => {
    cookieMocks.delete.mockClear();
  });

  it("deletes the session, GitHub access and OAuth state cookies", async () => {
    await clearAuthCookie();

    expect(cookieMocks.delete).toHaveBeenCalledWith("sketchblock_auth");
    expect(cookieMocks.delete).toHaveBeenCalledWith("sketchblock_github_access");
    expect(cookieMocks.delete).toHaveBeenCalledWith("sketchblock_oauth_state");
  });
});

describe("auth redirects", () => {
  it("keeps a local return path on the login page", () => {
    expect(getLoginPath("/drawings/architecture?mode=edit")).toBe(
      "/login?returnTo=%2Fdrawings%2Farchitecture%3Fmode%3Dedit",
    );
  });

  it("includes a safe error key", () => {
    expect(getLoginPath("/sessions", "github_oauth_failed")).toBe(
      "/login?returnTo=%2Fsessions&error=github_oauth_failed",
    );
  });

  it("rejects external, protocol-relative and backslash return targets", () => {
    expect(sanitizeReturnTo("https://example.com/account")).toBe("/sessions");
    expect(sanitizeReturnTo("//example.com/account")).toBe("/sessions");
    expect(sanitizeReturnTo("/\\example.com/account")).toBe("/sessions");
  });
});
