import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const sessionMocks = vi.hoisted(() => ({
  clearAuthCookie: vi.fn(),
  clearOwnerAuthCookie: vi.fn(),
  clearSessionGrantCookies: vi.fn(),
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
vi.mock("@/lib/server/auth/session-grant", () => ({
  clearSessionGrantCookies: sessionMocks.clearSessionGrantCookies,
}));

import { GET, POST } from "./route";

describe("logout route", () => {
  beforeEach(() => {
    sessionMocks.clearAuthCookie.mockReset();
    sessionMocks.clearOwnerAuthCookie.mockReset();
    sessionMocks.clearSessionGrantCookies.mockReset();
    sessionMocks.getCurrentOwner.mockReset();
    sessionMocks.getCurrentOwner.mockResolvedValue(null);
  });

  it("POST clears auth cookies and redirects to login", async () => {
    const request = new NextRequest("http://localhost:4512/api/auth/logout", {
      method: "POST",
      headers: { origin: "http://localhost:4512" },
    });
    const response = await POST(request);

    expect(sessionMocks.clearAuthCookie).toHaveBeenCalledOnce();
    expect(sessionMocks.clearOwnerAuthCookie).toHaveBeenCalledOnce();
    expect(sessionMocks.clearSessionGrantCookies).toHaveBeenCalledOnce();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:4512/login");
  });

  it("GET redirects to login without clearing cookies", async () => {
    const response = await GET();

    expect(sessionMocks.clearAuthCookie).not.toHaveBeenCalled();
    expect(sessionMocks.clearOwnerAuthCookie).not.toHaveBeenCalled();
    expect(sessionMocks.clearSessionGrantCookies).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:4512/login");
  });

  it("POST rejects requests without Origin header", async () => {
    const request = new NextRequest("http://localhost:4512/api/auth/logout", {
      method: "POST",
    });
    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(sessionMocks.clearAuthCookie).not.toHaveBeenCalled();
  });
});
