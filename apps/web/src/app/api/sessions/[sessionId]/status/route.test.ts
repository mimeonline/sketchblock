import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOwnedSession: vi.fn(),
  updateSessionStatus: vi.fn(),
  setSessionPurgeAfter: vi.fn(),
}));

vi.mock("@/lib/server/audit/audit-service", () => ({ safeRecordAuditEvent: vi.fn() }));
vi.mock("@/lib/server/logging/server-logger", () => ({ getRequestId: () => "req" }));
vi.mock("@/lib/server/auth/request-security", () => ({ rejectCrossOriginRequest: () => null }));
vi.mock("@/lib/server/auth/owner-session", () => ({
  requireOwnerApiAuth: async () => ({ owner: { id: "u1", username: "o", role: "owner" }, response: null }),
}));
vi.mock("@/lib/server/collab/collab-server-client", () => ({
  updateCollabSessionStatus: async () => ({ status: "ok" }),
}));
vi.mock("@/lib/server/database/session-invite-store", () => ({ revokeSessionInvites: async () => 2 }));
vi.mock("@/lib/server/database/session-store", () => ({
  getOwnedSession: mocks.getOwnedSession,
  updateSessionStatus: mocks.updateSessionStatus,
  setSessionPurgeAfter: mocks.setSessionPurgeAfter,
}));

import { PATCH } from "./route";

const context = { params: Promise.resolve({ sessionId: "s1" }) };
const req = (status: string) =>
  new Request("http://localhost:4512/api/sessions/s1/status", { method: "PATCH", body: JSON.stringify({ status }) });

describe("session status route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.SKETCHBLOCK_ADHOC_RETENTION_HOURS;
  });

  it("sets purge_after to now + default retention when an ad-hoc session closes", async () => {
    mocks.getOwnedSession.mockResolvedValue({ id: "s1", sourceKind: "adhoc", repositoryId: null });
    const before = Date.now();
    const response = await PATCH(req("closed") as never, context);
    expect(response.status).toBe(200);
    const purgeAfter = Date.parse(mocks.setSessionPurgeAfter.mock.calls[0][1]);
    expect(mocks.setSessionPurgeAfter.mock.calls[0][0]).toBe("s1");
    expect(purgeAfter).toBeGreaterThanOrEqual(before + 24 * 3_600_000);
    expect(purgeAfter).toBeLessThanOrEqual(Date.now() + 24 * 3_600_000);
  });

  it("honours SKETCHBLOCK_ADHOC_RETENTION_HOURS", async () => {
    process.env.SKETCHBLOCK_ADHOC_RETENTION_HOURS = "2";
    mocks.getOwnedSession.mockResolvedValue({ id: "s1", sourceKind: "adhoc", repositoryId: null });
    await PATCH(req("closed") as never, context);
    const delta = Date.parse(mocks.setSessionPurgeAfter.mock.calls[0][1]) - Date.now();
    expect(delta).toBeGreaterThan(1.9 * 3_600_000);
    expect(delta).toBeLessThanOrEqual(2 * 3_600_000);
  });

  it("does not set purge_after for repository sessions or non-closing changes", async () => {
    mocks.getOwnedSession.mockResolvedValue({ id: "s1", sourceKind: "repository", repositoryId: "r1" });
    await PATCH(req("closed") as never, context);
    mocks.getOwnedSession.mockResolvedValue({ id: "s1", sourceKind: "adhoc", repositoryId: null });
    await PATCH(req("saved") as never, context);
    expect(mocks.setSessionPurgeAfter).not.toHaveBeenCalled();
  });
});
