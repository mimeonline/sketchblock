import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  order: [] as string[],
}));

vi.mock("@/lib/server/audit/audit-service", () => ({ safeRecordAuditEvent: vi.fn() }));
vi.mock("@/lib/server/logging/server-logger", () => ({ getRequestId: () => "req" }));
vi.mock("@/lib/server/auth/owner-session", () => ({
  setOwnerAuthCookie: vi.fn(async () => { mocks.order.push("setOwner"); }),
}));
vi.mock("@/lib/server/auth/password", () => ({ verifyPassword: vi.fn(async () => true) }));
vi.mock("@/lib/server/auth/request-security", () => ({
  clearAuthAttempts: vi.fn(),
  consumeAuthAttempt: vi.fn(() => ({ allowed: true })),
  hasValidRequestOrigin: vi.fn(() => true),
}));
vi.mock("@/lib/server/database/user-store", () => ({
  getAppUserByUsername: vi.fn(async () => ({
    id: "user-b", username: "b", role: "member", status: "active", passwordHash: "x", mustChangePassword: false,
  })),
  markAppUserLogin: vi.fn(),
}));
vi.mock("@/lib/server/auth/session", () => ({
  clearGitHubAccessTokenCookie: vi.fn(async () => { mocks.order.push("clearGitHub"); }),
  clearParticipantAndOAuthCookies: vi.fn(async () => { mocks.order.push("clearParticipant"); }),
}));

import { POST } from "./route";

describe("local login route", () => {
  beforeEach(() => { mocks.order.length = 0; });

  it("clears the GitHub token and participant cookies before setting the owner cookie", async () => {
    const response = await POST(
      new NextRequest("http://localhost:4512/api/auth/local/login", {
        method: "POST",
        body: JSON.stringify({ username: "b", password: "pw" }),
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.order).toEqual(["clearGitHub", "clearParticipant", "setOwner"]);
  });
});
