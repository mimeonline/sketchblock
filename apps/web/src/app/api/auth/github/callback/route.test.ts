import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consumeOAuthStateCookie: vi.fn(),
  exchangeGitHubCode: vi.fn(),
  getCurrentOwner: vi.fn(),
  getGitHubUser: vi.fn(),
  linkAppUserGitHubIdentity: vi.fn(),
  linkInstanceOwnerGitHub: vi.fn(),
  safeRecordAuditEvent: vi.fn(),
  setAuthCookie: vi.fn(),
  setGitHubAccessTokenCookie: vi.fn(),
}));

vi.mock("@/lib/server/auth/github-oauth", () => ({
  exchangeGitHubCode: mocks.exchangeGitHubCode,
  getGitHubUser: mocks.getGitHubUser,
}));

vi.mock("@/lib/server/auth/owner-session", () => ({
  getCurrentOwner: mocks.getCurrentOwner,
}));

vi.mock("@/lib/server/database/instance-owner-store", () => ({
  linkInstanceOwnerGitHub: mocks.linkInstanceOwnerGitHub,
}));

vi.mock("@/lib/server/database/user-store", () => ({
  linkAppUserGitHubIdentity: mocks.linkAppUserGitHubIdentity,
}));

vi.mock("@/lib/server/audit/audit-service", () => ({
  safeRecordAuditEvent: mocks.safeRecordAuditEvent,
}));

vi.mock("@/lib/server/auth/session", () => ({
  consumeOAuthStateCookie: mocks.consumeOAuthStateCookie,
  getAppBaseUrl: () => "http://localhost:4512",
  getLoginPath: () => "/login?returnTo=%2Frepositories",
  sanitizeReturnTo: (value?: string | null) => value || "/sessions",
  setAuthCookie: mocks.setAuthCookie,
  setGitHubAccessTokenCookie: mocks.setGitHubAccessTokenCookie,
}));

import { GET } from "./route";

describe("GitHub OAuth callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumeOAuthStateCookie.mockResolvedValue({
      state: "valid-state",
      returnTo: "/repositories",
      intent: "owner_connect",
      expiresAt: Date.now() + 60_000,
    });
    mocks.exchangeGitHubCode.mockResolvedValue("oauth-token");
    mocks.getGitHubUser.mockResolvedValue({
      id: 42,
      login: "micha",
      name: "Micha",
      avatarUrl: null,
    });
  });

  it("stores the connected GitHub identity for the virtual dev owner", async () => {
    mocks.getCurrentOwner.mockResolvedValue({
      id: "dev-owner",
      username: "local-dev",
      role: "instance_owner",
    });

    const response = await GET(
      new NextRequest("http://localhost:4512/api/auth/github/callback?code=valid-code&state=valid-state"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:4512/repositories");
    expect(mocks.linkInstanceOwnerGitHub).not.toHaveBeenCalled();
    expect(mocks.linkAppUserGitHubIdentity).not.toHaveBeenCalled();
    expect(mocks.setAuthCookie).toHaveBeenCalledWith({
      id: 42,
      login: "micha",
      name: "Micha",
      avatarUrl: null,
      permission: "admin",
    });
    expect(mocks.setGitHubAccessTokenCookie).toHaveBeenCalledWith("oauth-token");
  });

  it("keeps linking a persisted production owner in Postgres", async () => {
    mocks.getCurrentOwner.mockResolvedValue({
      id: "owner-1",
      username: "admin",
      role: "instance_owner",
    });

    await GET(
      new NextRequest("http://localhost:4512/api/auth/github/callback?code=valid-code&state=valid-state"),
    );

    expect(mocks.linkAppUserGitHubIdentity).toHaveBeenCalledWith("owner-1", {
      id: 42,
      login: "micha",
      name: "Micha",
      avatarUrl: null,
    });
    expect(mocks.linkInstanceOwnerGitHub).toHaveBeenCalledWith("owner-1", {
      id: 42,
      login: "micha",
      name: "Micha",
      avatarUrl: null,
    });
    expect(mocks.setAuthCookie).not.toHaveBeenCalled();
  });
});
