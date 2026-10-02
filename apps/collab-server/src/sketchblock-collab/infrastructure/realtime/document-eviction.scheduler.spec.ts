import { afterEach, describe, expect, it, vi } from "vitest";

import type { PresenceStorePort } from "../../application/ports/presence-store.port.js";
import type { YjsDocumentRegistryPort } from "../../application/ports/yjs-document-registry.port.js";
import type { StructuredLoggerService } from "../../../shared/infrastructure/logging/structured-logger.service.js";
import type { FacilitationRegistry } from "./facilitation.registry.js";
import { DOCUMENT_EVICTION_GRACE_MS, DocumentEvictionScheduler } from "./document-eviction.scheduler.js";

function setup() {
  const present = new Set<string>();
  const documents = { releaseDocument: vi.fn().mockResolvedValue(true) };
  const presence = {
    getSessionPresence: (id: string) => (present.has(id) ? new Map([["s", {}]]) : undefined),
  };
  const facilitation = { clear: vi.fn() };
  const scheduler = new DocumentEvictionScheduler(
    documents as unknown as YjsDocumentRegistryPort,
    presence as unknown as PresenceStorePort,
    { errorEvent: vi.fn() } as unknown as StructuredLoggerService,
    facilitation as unknown as FacilitationRegistry,
  );
  return { scheduler, documents, present, facilitation };
}

describe("DocumentEvictionScheduler", () => {
  afterEach(() => vi.useRealTimers());

  it("releases the document after the grace period when the session stays empty", async () => {
    vi.useFakeTimers();
    const { scheduler, documents, facilitation } = setup();
    scheduler.scheduleIfEmpty("a");
    await vi.advanceTimersByTimeAsync(DOCUMENT_EVICTION_GRACE_MS - 1);
    expect(documents.releaseDocument).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(documents.releaseDocument).toHaveBeenCalledWith("a");
    expect(facilitation.clear).toHaveBeenCalledWith("a");
  });

  it("does not release when cancelled by a rejoin", async () => {
    vi.useFakeTimers();
    const { scheduler, documents } = setup();
    scheduler.scheduleIfEmpty("a");
    scheduler.cancel("a");
    await vi.advanceTimersByTimeAsync(DOCUMENT_EVICTION_GRACE_MS * 2);
    expect(documents.releaseDocument).not.toHaveBeenCalled();
  });

  it("does not schedule while presence exists or release if someone returned", async () => {
    vi.useFakeTimers();
    const { scheduler, documents, present } = setup();
    present.add("busy");
    scheduler.scheduleIfEmpty("busy");
    scheduler.scheduleIfEmpty("late");
    present.add("late");
    await vi.advanceTimersByTimeAsync(DOCUMENT_EVICTION_GRACE_MS * 2);
    expect(documents.releaseDocument).not.toHaveBeenCalled();
  });
});
