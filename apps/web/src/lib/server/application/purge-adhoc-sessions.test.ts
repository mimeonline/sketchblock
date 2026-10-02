import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  del: vi.fn(),
  mark: vi.fn(),
  purge: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/lib/server/audit/audit-service", () => ({ safeRecordAuditEvent: mocks.audit }));
vi.mock("@/lib/server/collab/collab-server-client", () => ({ purgeCollabSession: mocks.purge }));
vi.mock("@/lib/server/database/session-store", () => ({
  listPurgeableAdhocSessions: mocks.list,
  deleteSessionsByIds: mocks.del,
  markExpiredAdhocSessionsForPurge: mocks.mark,
}));

import { purgeExpiredAdhocSessions, resetPurgeThrottleForTests } from "./purge-adhoc-sessions";

describe("purgeExpiredAdhocSessions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetPurgeThrottleForTests();
    mocks.mark.mockResolvedValue(0);
  });

  it("deletes successfully purged ids and skips unreachable ones", async () => {
    mocks.list.mockResolvedValue(["a", "b"]);
    mocks.purge.mockImplementation(async (id: string) => (id === "a" ? { ok: true, purged: true } : { ok: false, purged: false }));
    const result = await purgeExpiredAdhocSessions({});
    expect(result.purged).toEqual(["a"]);
    expect(result.failed).toEqual(["b"]);
    expect(mocks.del).toHaveBeenCalledWith(["a"]);
    expect(mocks.audit).toHaveBeenCalledTimes(1);
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "session.purge", targetId: "a", actorRole: "system" }));
    expect(mocks.mark).toHaveBeenCalled();
  });

  it("throttles unless forced", async () => {
    mocks.list.mockResolvedValue([]);
    await purgeExpiredAdhocSessions({});
    const second = await purgeExpiredAdhocSessions({});
    expect(second.skipped).toBe(true);
    expect(mocks.list).toHaveBeenCalledTimes(1);
    await purgeExpiredAdhocSessions({ force: true });
    expect(mocks.list).toHaveBeenCalledTimes(2);
  });
});
