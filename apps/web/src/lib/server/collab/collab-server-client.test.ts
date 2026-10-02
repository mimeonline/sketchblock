import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth/collab-ticket", () => ({ createServerCollabTicket: () => "server-ticket" }));

import { CollabSnapshotConflictError, upsertCollabSessionSnapshot } from "./collab-server-client";

describe("collab snapshot conflict mapping", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("preserves the latest snapshot from HTTP 409", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ error: "snapshot_conflict", snapshot: { revision: 9 } }, { status: 409 }));
    await expect(upsertCollabSessionSnapshot({ sessionId: "s1", drawingPath: "board.excalidraw", content: {}, updatedBy: "guest", baseRevision: 8 })).rejects.toMatchObject({ snapshot: { revision: 9 }, message: "snapshot_conflict" });
  });

  it("maps a legacy conflict acknowledgement to the same typed error", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ ok: false, error: "snapshot_conflict", snapshot: null }));
    await expect(upsertCollabSessionSnapshot({ sessionId: "s1", drawingPath: "board.excalidraw", content: {}, updatedBy: "guest", baseRevision: 8 })).rejects.toBeInstanceOf(CollabSnapshotConflictError);
  });
});
