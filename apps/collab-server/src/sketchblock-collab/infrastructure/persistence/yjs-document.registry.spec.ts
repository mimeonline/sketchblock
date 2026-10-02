import { afterEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import type { SessionStorePort } from "../../application/ports/session-store.port.js";
import type { StructuredLoggerService } from "../../../shared/infrastructure/logging/structured-logger.service.js";
import { YjsDocumentTooLarge } from "../../application/dtos/yjs-document-too-large.js";
import { YjsDocumentRegistry } from "./yjs-document.registry.js";

function encodedElementUpdate() {
  const doc = new Y.Doc();
  doc.getMap("elements").set("element-1", { id: "element-1", version: 1 });
  const update = Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64");
  doc.destroy();
  return update;
}

function limits(maxYjsDocumentBytes = 25_000_000) {
  return { maxYjsDocumentBytes };
}

describe("YjsDocumentRegistry", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the in-memory update before persisting the debounced full state", async () => {
    vi.useFakeTimers();
    const store = {
      getSession: vi.fn().mockResolvedValue(null),
      upsertYjsState: vi.fn().mockResolvedValue({}),
    } as unknown as SessionStorePort;
    const logger = {
      errorEvent: vi.fn(),
    } as unknown as StructuredLoggerService;
    const registry = new YjsDocumentRegistry(store, logger, limits());
    const updateBase64 = encodedElementUpdate();

    await expect(
      registry.applyUpdate({ sessionId: "session-1", updateBase64, updatedBy: "client-1" }),
    ).resolves.toMatchObject({ updateBase64 });
    expect(store.upsertYjsState).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(250);

    expect(store.upsertYjsState).toHaveBeenCalledTimes(1);
  });

  it("shares one document across simultaneous first updates and persists both clients", async () => {
    vi.useFakeTimers();
    let resolveLoad!: (value: null) => void;
    const store = {
      getSession: vi.fn(() => new Promise<null>((resolve) => { resolveLoad = resolve; })),
      upsertYjsState: vi.fn().mockResolvedValue({}),
    } as unknown as SessionStorePort;
    const registry = new YjsDocumentRegistry(store, { errorEvent: vi.fn() } as unknown as StructuredLoggerService, limits());
    const first = new Y.Doc();
    const second = new Y.Doc();
    first.getMap("elements").set("first", { id: "first" });
    second.getMap("elements").set("second", { id: "second" });
    const requests = [first, second].map((doc, index) => registry.applyUpdate({
      sessionId: "concurrent", updatedBy: `client-${index}`,
      updateBase64: Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64"),
    }));
    expect(store.getSession).toHaveBeenCalledTimes(1);
    resolveLoad(null);
    await Promise.all(requests);
    await vi.advanceTimersByTimeAsync(250);
    const recovered = new Y.Doc();
    const persisted = vi.mocked(store.upsertYjsState).mock.calls[0][0];
    Y.applyUpdate(recovered, Buffer.from(persisted.stateBase64, "base64"));
    expect([...recovered.getMap("elements").keys()].sort()).toEqual(["first", "second"]);
    first.destroy(); second.destroy(); recovered.destroy();
    registry.deleteDocument("concurrent");
  });

  it("does not mirror an older snapshot when persistence completes out of order", async () => {
    const store = {
      getSession: vi.fn().mockResolvedValue(null),
      upsertYjsState: vi.fn().mockResolvedValue({}),
    } as unknown as SessionStorePort;
    const registry = new YjsDocumentRegistry(store, { errorEvent: vi.fn() } as unknown as StructuredLoggerService, limits());
    await registry.mirrorSnapshot({ sessionId: "ordered", snapshot: { revision: 2, content: "latest" }, updatedBy: "a" });
    await registry.mirrorSnapshot({ sessionId: "ordered", snapshot: { revision: 1, content: "stale" }, updatedBy: "b" });
    const doc = await registry.getDocument("ordered");
    expect(doc.getMap("sketchblock").get("snapshot")).toEqual({ revision: 2, content: "latest" });
    expect(store.upsertYjsState).toHaveBeenCalledTimes(1);
    registry.deleteDocument("ordered");
  });

  it("rejects updates that would push the document beyond the byte limit and leaves it unchanged", async () => {
    const store = { getSession: vi.fn().mockResolvedValue(null), upsertYjsState: vi.fn().mockResolvedValue({}) } as unknown as SessionStorePort;
    const registry = new YjsDocumentRegistry(store, { errorEvent: vi.fn() } as unknown as StructuredLoggerService, limits(1_000));
    const big = new Y.Doc();
    big.getMap("elements").set("blob", "x".repeat(5_000));
    const updateBase64 = Buffer.from(Y.encodeStateAsUpdate(big)).toString("base64");

    await expect(registry.applyUpdate({ sessionId: "big", updateBase64, updatedBy: "c" })).rejects.toBeInstanceOf(YjsDocumentTooLarge);
    const doc = (await registry.getDocument("big")) as Y.Doc;
    expect(doc.getMap("elements").size).toBe(0);
    await registry.releaseDocument("big");
  });

  it("accepts updates within the byte limit", async () => {
    const store = { getSession: vi.fn().mockResolvedValue(null), upsertYjsState: vi.fn().mockResolvedValue({}) } as unknown as SessionStorePort;
    const registry = new YjsDocumentRegistry(store, { errorEvent: vi.fn() } as unknown as StructuredLoggerService, limits(1_000));
    await expect(registry.applyUpdate({ sessionId: "ok", updateBase64: encodedElementUpdate(), updatedBy: "c" })).resolves.toBeDefined();
    await registry.releaseDocument("ok");
  });
});
