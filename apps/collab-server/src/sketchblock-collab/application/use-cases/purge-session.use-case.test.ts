import { describe, expect, it } from "vitest";

import { PurgeSessionUseCase } from "./purge-session.use-case.js";

function setup(deleted: unknown) {
  const calls: string[] = [];
  const useCase = new PurgeSessionUseCase(
    { endSession: async (id: string, i: { closedBy: string }) => void calls.push(`end:${id}:${i.closedBy}`) } as never,
    { purgeDocument: async (id: string) => void calls.push(`purge:${id}`) } as never,
    { deleteSession: async (id: string) => (calls.push(`delete:${id}`), deleted) } as never,
  );
  return { useCase, calls };
}

describe("PurgeSessionUseCase", () => {
  it("ends the session, discards the document and only then deletes the row", async () => {
    const { useCase, calls } = setup({ sessionId: "s1" });
    await expect(useCase.execute("s1")).resolves.toEqual({ purged: true });
    expect(calls).toEqual(["end:s1:web-api", "purge:s1", "delete:s1"]);
  });

  it("reports purged false when the session does not exist", async () => {
    await expect(setup(null).useCase.execute("s1")).resolves.toEqual({ purged: false });
  });
});
