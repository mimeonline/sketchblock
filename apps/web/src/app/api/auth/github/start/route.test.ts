import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentOwner: vi.fn(),
  setOAuthStateCookie: vi.fn(),
}));

vi.mock("@/lib/server/auth/owner-session", () => ({
  getCurrentOwner: mocks.getCurrentOwner,
}));

vi.mock("@/lib/server/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/auth/session")>();
  return {
    ...actual,
    setOAuthStateCookie: mocks.setOAuthStateCookie,
  };
});

import { GET } from "./route";

describe("GitHub OAuth start route", () => {
  beforeEach(() => {
    mocks.getCurrentOwner.mockReset();
    mocks.getCurrentOwner.mockResolvedValue({ id: "dev-owner" });
    mocks.setOAuthStateCookie.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("redirects locally in dev auth mode without GitHub OAuth env", async () => {
    vi.stubEnv("APP_BASE_URL", "http://localhost:4512");
    vi.stubEnv("SKETCHBLOCK_AUTH_MODE", "dev");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("GITHUB_OAUTH_CLIENT_ID", "");
    vi.stubEnv("GITHUB_OAUTH_CLIENT_SECRET", "");

    const response = await GET(
      new NextRequest("http://localhost:4512/api/auth/github/start?returnTo=/sessions"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:4512/sessions");
  });

  it("starts an owner GitHub connection in dev auth mode", async () => {
    vi.stubEnv("APP_BASE_URL", "http://localhost:4512");
    vi.stubEnv("APP_AUTH_SECRET", "test-auth-secret-with-24-characters");
    vi.stubEnv("SKETCHBLOCK_AUTH_MODE", "dev");
    vi.stubEnv("SKETCHBLOCK_DEPLOYMENT_ENV", "local");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("GITHUB_OAUTH_CLIENT_ID", "test-client-id");
    vi.stubEnv("GITHUB_OAUTH_CLIENT_SECRET", "test-client-secret");

    const response = await GET(
      new NextRequest(
        "http://localhost:4512/api/auth/github/start?intent=owner_connect&returnTo=/repositories",
      ),
    );

    const location = new URL(response.headers.get("location") || "");
    expect(response.status).toBe(307);
    expect(location.origin + location.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(location.searchParams.get("scope")).toBe("read:user repo");
    expect(mocks.setOAuthStateCookie).toHaveBeenCalledWith(
      expect.objectContaining({ intent: "owner_connect", returnTo: "/repositories" }),
    );
  });
});
