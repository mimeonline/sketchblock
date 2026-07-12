import { afterEach, describe, expect, it, vi } from "vitest";

import { getGitHubAuthorizeUrl } from "./github-oauth";

describe("GitHub OAuth repository access", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("requests identity and repository scopes", () => {
    vi.stubEnv("GITHUB_OAUTH_CLIENT_ID", "client-id");
    vi.stubEnv("GITHUB_OAUTH_CLIENT_SECRET", "client-secret");

    const url = getGitHubAuthorizeUrl({
      state: "oauth-state",
      redirectUri: "http://localhost:4512/api/auth/github/callback",
      scope: "read:user repo",
    });

    expect(url.searchParams.get("scope")?.split(" ")).toEqual(["read:user", "repo"]);
  });

  it("can request identity-only scope for invited participants", () => {
    vi.stubEnv("GITHUB_OAUTH_CLIENT_ID", "client-id");
    vi.stubEnv("GITHUB_OAUTH_CLIENT_SECRET", "client-secret");

    const url = getGitHubAuthorizeUrl({
      state: "oauth-state",
      redirectUri: "http://localhost:4512/api/auth/github/callback",
      scope: "read:user",
    });

    expect(url.searchParams.get("scope")).toBe("read:user");
  });
});
