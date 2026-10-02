import { randomUUID } from "node:crypto";
import * as Y from "yjs";
import { CollabConfigService } from "../../../shared/infrastructure/config/collab-config.service.js";
import type { StructuredLoggerService } from "../../../shared/infrastructure/logging/structured-logger.service.js";
import { SnapshotConflict } from "../../application/dtos/snapshot-conflict.js";
import { PostgresSessionStore } from "./postgres-session.store.js";

// Opt in with a migrated, isolated database. No production URL fallback.
describe.skipIf(!process.env.SKETCHBLOCK_TEST_DATABASE_URL)("PostgreSQL concurrent collaboration", () => {
  let store: PostgresSessionStore;
  const sessionId = `concurrency-${randomUUID()}`;
  beforeAll(() => {
    store = new PostgresSessionStore({ databaseUrl: process.env.SKETCHBLOCK_TEST_DATABASE_URL!, databasePoolMax: 5 } as CollabConfigService,
      { errorEvent() {} } as unknown as StructuredLoggerService);
  });
  afterAll(async () => {
    await store.deleteSession(sessionId);
    await store.onModuleDestroy();
  });

  it("accepts exactly one same-base write, then advances legacy revisions without collisions", async () => {
    await Promise.all(Array.from({ length: 3 }, (_, index) => store.getOrCreateSession({ sessionId, userId: `join-${index}` })));
    const results = await Promise.allSettled(["first", "second"].map((content) => store.upsertSnapshot({ sessionId, content, updatedBy: content, baseRevision: 0 }, null)));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason).toBeInstanceOf(SnapshotConflict);
    const writes = await Promise.all(Array.from({ length: 12 }, (_, index) => store.upsertSnapshot({ sessionId, content: index, updatedBy: `legacy-${index}` }, null)));
    expect(writes.map((snapshot) => snapshot.revision).sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, index) => index + 2));
    expect((await store.getSession(sessionId))?.snapshot?.revision).toBe(13);
  });

  it("merges concurrently persisted full Yjs states from independent clients", async () => {
    const docs = [new Y.Doc(), new Y.Doc()];
    docs.forEach((doc, index) => doc.getMap("elements").set(`client-${index}`, index));
    await Promise.all(docs.map((doc, index) => store.upsertYjsState({ sessionId, stateBase64: Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64"), updatedBy: `client-${index}` })));
    const saved = await store.getSession(sessionId);
    const recovered = new Y.Doc();
    Y.applyUpdate(recovered, Buffer.from(saved!.yjsStateBase64!, "base64"));
    expect([...recovered.getMap("elements").keys()].sort()).toEqual(["client-0", "client-1"]);
    expect(saved?.yjsRevision).toBe(2);
    docs.forEach((doc) => doc.destroy()); recovered.destroy();
  });
});
