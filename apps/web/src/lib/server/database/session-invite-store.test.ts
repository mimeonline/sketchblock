import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  clientQuery: vi.fn(),
  release: vi.fn(),
  poolQuery: vi.fn(),
}));

vi.mock("@/lib/server/database/postgres", () => ({
  getAppPostgresPool: () => ({
    query: mocks.poolQuery,
    connect: async () => ({ query: mocks.clientQuery, release: mocks.release }),
  }),
}));
vi.mock("@/lib/server/auth/crypto", () => ({
  encryptSecret: (value: string) => `enc:${value}`,
  decryptSecret: (value: string) => value.replace(/^enc:/, ""),
}));

import { isParticipantRemoved, rotateSessionInvite } from "./session-invite-store";

describe("rotateSessionInvite", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("revokes the active invite and creates a new one in one transaction", async () => {
    mocks.clientQuery.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql.includes("INSERT INTO app_session_invites")) {
        return {
          rows: [{
            id: "invite-2",
            session_id: "s1",
            role: "viewer",
            token_hash: values?.[3],
            token_ciphertext: values?.[4],
            expires_at: null,
            revoked_at: null,
            created_at: new Date(),
          }],
        };
      }
      return { rows: [], rowCount: 1 };
    });

    const invite = await rotateSessionInvite("s1", "viewer", "owner-1");

    const statements = mocks.clientQuery.mock.calls.map(([sql]) => String(sql).trim().split(/\s+/)[0]);
    expect(statements).toEqual(["BEGIN", "UPDATE", "INSERT", "COMMIT"]);
    expect(mocks.clientQuery.mock.calls[1][1]).toEqual(["s1", "viewer"]);
    expect(String(mocks.clientQuery.mock.calls[1][0])).toContain("revoked_at = now()");
    expect(invite.token).toBeTruthy();
    expect(invite.id).toBe("invite-2");
    expect(mocks.release).toHaveBeenCalled();
    expect(mocks.poolQuery).not.toHaveBeenCalled();
  });

  it("rolls back when the replacement cannot be created", async () => {
    mocks.clientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("INSERT INTO")) throw new Error("boom");
      return { rows: [], rowCount: 0 };
    });

    await expect(rotateSessionInvite("s1", "collaborator", null)).rejects.toThrow("boom");
    expect(mocks.clientQuery.mock.calls.map(([sql]) => String(sql).trim())).toContain("ROLLBACK");
    expect(mocks.release).toHaveBeenCalled();
  });
});

describe("isParticipantRemoved", () => {
  beforeEach(() => vi.resetAllMocks());

  it("is true only when removed_at is set", async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [{ removed_at: new Date() }] });
    await expect(isParticipantRemoved("s1", 42)).resolves.toBe(true);
    mocks.poolQuery.mockResolvedValueOnce({ rows: [{ removed_at: null }] });
    await expect(isParticipantRemoved("s1", 42)).resolves.toBe(false);
    mocks.poolQuery.mockResolvedValueOnce({ rows: [] });
    await expect(isParticipantRemoved("s1", 43)).resolves.toBe(false);
  });
});
