import { afterEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import type { SessionStorePort } from "../../application/ports/session-store.port.js";
import type { StructuredLoggerService } from "../../../shared/infrastructure/logging/structured-logger.service.js";
import { YjsDocumentRegistry } from "./yjs-document.registry.js";

function encodedElementUpdate() {
  const doc = new Y.Doc();
  doc.getMap("elements").set("element-1", { id: "element-1", version: 1 });
  const update = Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64");
  doc.destroy();
  return update;
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
    const registry = new YjsDocumentRegistry(store, logger);
    const updateBase64 = encodedElementUpdate();

    await expect(
      registry.applyUpdate({ sessionId: "session-1", updateBase64, updatedBy: "client-1" }),
    ).resolves.toMatchObject({ updateBase64 });
    expect(store.upsertYjsState).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(250);

    expect(store.upsertYjsState).toHaveBeenCalledTimes(1);
  });
});
