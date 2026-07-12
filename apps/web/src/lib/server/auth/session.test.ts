import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieMocks = vi.hoisted(() => ({
  delete: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    delete: cookieMocks.delete,
  })),
}));

import { clearAuthCookie, getLoginPath, sanitizeReturnTo } from "./session";

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
