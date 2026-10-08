import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSessionGrantCookie: vi.fn(),
  getCurrentAuthUser: vi.fn(),
  getCurrentSessionUser: vi.fn(),
  getSession: vi.fn(),
  recordSessionParticipant: vi.fn(),
  validateSessionInvite: vi.fn(),
}));

vi.mock("@/lib/server/auth/session-grant", () => ({
  createSessionGrantCookie: mocks.createSessionGrantCookie,
}));
vi.mock("@/lib/server/auth/session", () => ({
  getAppBaseUrl: () => "https://sketchblock.example.test",
  getCurrentAuthUser: mocks.getCurrentAuthUser,
  getLoginPath: (returnTo: string) => `/login?returnTo=${encodeURIComponent(returnTo)}`,
}));
vi.mock("@/lib/server/auth/session-user", () => ({ getCurrentSessionUser: mocks.getCurrentSessionUser }));
vi.mock("@/lib/server/database/session-store", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/server/database/session-invite-store", () => ({
  recordSessionParticipant: mocks.recordSessionParticipant,
  validateSessionInvite: mocks.validateSessionInvite,
}));

import { GET } from "./route";

describe("session claim route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getSession.mockResolvedValue({ id: "session-1" });
    mocks.validateSessionInvite.mockResolvedValue({ id: "invite-1", role: "collaborator" });
    mocks.getCurrentAuthUser.mockResolvedValue({ id: 42, login: "markus", name: "Markus", avatarUrl: null });
    mocks.getCurrentSessionUser.mockResolvedValue({ id: 42, login: "markus", name: "Markus", avatarUrl: null });
    mocks.createSessionGrantCookie.mockReturnValue({
      name: "sketchblock_session_test",
      value: "signed-grant",
      options: { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 3600 },
    });
  });

  it("claims an invite, sets the grant cookie and redirects to the clean join URL", async () => {
    const response = await GET(
      new NextRequest("https://sketchblock.example.test/api/sessions/session-1/claim?invite=raw-secret"),
      { params: Promise.resolve({ sessionId: "session-1" }) },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://sketchblock.example.test/join/session-1");
    expect(response.headers.get("location")).not.toContain("raw-secret");
    expect(response.headers.get("set-cookie")).toContain("sketchblock_session_test=signed-grant");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(mocks.recordSessionParticipant).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: "session-1",
      githubUserId: 42,
      role: "collaborator",
    }));
  });

  it("rejects a revoked or invalid invite without issuing a grant", async () => {
    mocks.validateSessionInvite.mockResolvedValue(null);

    const response = await GET(
      new NextRequest("https://sketchblock.example.test/api/sessions/session-1/claim?invite=invalid"),
      { params: Promise.resolve({ sessionId: "session-1" }) },
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(mocks.recordSessionParticipant).not.toHaveBeenCalled();
  });

  it("claims an invite with the persistent negative identity of a local account", async () => {
    mocks.getCurrentAuthUser.mockResolvedValue(null);
    mocks.getCurrentSessionUser.mockResolvedValue({
      id: -17, login: "local:user-b", name: "User B", avatarUrl: null,
      source: "local", localUserId: "user-b", mustChangePassword: false,
    });

    const response = await GET(
      new NextRequest("https://sketchblock.example.test/api/sessions/session-1/claim?invite=raw-secret"),
      { params: Promise.resolve({ sessionId: "session-1" }) },
    );

    expect(response.status).toBe(307);
    expect(mocks.recordSessionParticipant).toHaveBeenCalledWith(expect.objectContaining({
      githubUserId: -17,
      githubLogin: "local:user-b",
    }));
    expect(mocks.createSessionGrantCookie).toHaveBeenCalledWith(expect.objectContaining({ githubUserId: -17 }));
  });

  it("rejects a local account that still requires a password change", async () => {
    mocks.getCurrentAuthUser.mockResolvedValue(null);
    mocks.getCurrentSessionUser.mockResolvedValue({
      id: -17, login: "local:user-b", name: "User B", avatarUrl: null,
      source: "local", localUserId: "user-b", mustChangePassword: true,
    });

    const response = await GET(
      new NextRequest("https://sketchblock.example.test/api/sessions/session-1/claim?invite=raw-secret"),
      { params: Promise.resolve({ sessionId: "session-1" }) },
    );

    expect(response.status).toBe(423);
    expect(mocks.recordSessionParticipant).not.toHaveBeenCalled();
  });
});
