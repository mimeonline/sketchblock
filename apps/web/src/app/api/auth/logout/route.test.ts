import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({
  clearAuthCookie: vi.fn(),
  clearOwnerAuthCookie: vi.fn(),
  getCurrentOwner: vi.fn(),
}));

vi.mock("@/lib/server/auth/session", () => ({
  clearAuthCookie: sessionMocks.clearAuthCookie,
  getAppBaseUrl: () => "http://localhost:4512",
}));
vi.mock("@/lib/server/auth/owner-session", () => ({
  clearOwnerAuthCookie: sessionMocks.clearOwnerAuthCookie,
  getCurrentOwner: sessionMocks.getCurrentOwner,
}));

import { GET, POST } from "./route";

describe("logout route", () => {
  beforeEach(() => {
    sessionMocks.clearAuthCookie.mockReset();
    sessionMocks.clearOwnerAuthCookie.mockReset();
    sessionMocks.getCurrentOwner.mockReset();
    sessionMocks.getCurrentOwner.mockResolvedValue(null);
  });

  it.each([
    ["GET", GET],
    ["POST", POST],
  ])("clears auth cookies and redirects %s requests to login", async (_method, handler) => {
    const response = await handler();

    expect(sessionMocks.clearAuthCookie).toHaveBeenCalledOnce();
    expect(sessionMocks.clearOwnerAuthCookie).toHaveBeenCalledOnce();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:4512/login");
  });
});
