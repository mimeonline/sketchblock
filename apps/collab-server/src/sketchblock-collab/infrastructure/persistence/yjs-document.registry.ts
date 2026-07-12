import { Inject, Injectable } from "@nestjs/common";
import * as Y from "yjs";

import { SessionStorePort } from "../../application/ports/session-store.port.js";
import { YjsDocumentRegistryPort } from "../../application/ports/yjs-document-registry.port.js";
import { StructuredLoggerService } from "../../../shared/infrastructure/logging/structured-logger.service.js";

const PERSISTENCE_DEBOUNCE_MS = 250;

type PendingPersistence = {
  sessionId: string;
  stateBase64: string;
  updatedBy: string;
};

@Injectable()
export class YjsDocumentRegistry extends YjsDocumentRegistryPort {
  private readonly docs = new Map<string, Y.Doc>();
  private readonly pendingPersistence = new Map<string, PendingPersistence>();
  private readonly persistenceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly persistenceQueues = new Map<string, Promise<void>>();

  constructor(
    @Inject(SessionStorePort) private readonly store: SessionStorePort,
    @Inject(StructuredLoggerService) private readonly logger: StructuredLoggerService,
  ) {
    super();
  }

  async getDocument(sessionId: string): Promise<Y.Doc> {
    const existing = this.docs.get(sessionId);
    if (existing) {
      return existing;
    }

    const doc = new Y.Doc();
    const session = await this.store.getSession(sessionId);
    if (session?.yjsStateBase64) {
      Y.applyUpdate(doc, Buffer.from(session.yjsStateBase64, "base64"), "store");
    }

    this.docs.set(sessionId, doc);
    return doc;
  }

  async applyUpdate(input: { sessionId: string; updateBase64: string; updatedBy: string }) {
    const doc = await this.getDocument(input.sessionId);
    const update = Buffer.from(input.updateBase64, "base64");
    Y.applyUpdate(doc, update, input.updatedBy);

    const stateBase64 = this.encodeState(doc);
    this.schedulePersistence({
      sessionId: input.sessionId,
      stateBase64,
      updatedBy: input.updatedBy,
    });

    return {
      updateBase64: input.updateBase64,
      stateBase64,
    };
  }

  async mirrorSnapshot(input: { sessionId: string; snapshot: unknown; updatedBy: string }) {
    const doc = await this.getDocument(input.sessionId);
    const map = doc.getMap("sketchblock");

    doc.transact(() => {
      map.set("snapshot", input.snapshot);
      map.set("updatedAt", new Date().toISOString());
      map.set("updatedBy", input.updatedBy);
    }, input.updatedBy);

    const stateBase64 = this.encodeState(doc);
    this.cancelScheduledPersistence(input.sessionId);
    await this.enqueuePersistence({
      sessionId: input.sessionId,
      stateBase64,
      updatedBy: input.updatedBy,
    });

    return {
      stateBase64,
    };
  }

  async getEncodedState(sessionId: string): Promise<string> {
    const doc = await this.getDocument(sessionId);
    return this.encodeState(doc);
  }

  deleteDocument(sessionId: string) {
    this.cancelScheduledPersistence(sessionId);
    this.persistenceQueues.delete(sessionId);
    const doc = this.docs.get(sessionId);
    doc?.destroy();
    this.docs.delete(sessionId);
  }

  private schedulePersistence(input: PendingPersistence) {
    this.pendingPersistence.set(input.sessionId, input);
    if (this.persistenceTimers.has(input.sessionId)) {
      return;
    }

    const timer = setTimeout(() => {
      this.persistenceTimers.delete(input.sessionId);
      const latest = this.pendingPersistence.get(input.sessionId);
      this.pendingPersistence.delete(input.sessionId);
      if (!latest) {
        return;
      }

      void this.enqueuePersistence(latest).catch((error: unknown) => {
        this.logger.errorEvent("yjs.persistence.failed", {
          sessionId: latest.sessionId,
          error,
        });
      });
    }, PERSISTENCE_DEBOUNCE_MS);

    this.persistenceTimers.set(input.sessionId, timer);
  }

  private enqueuePersistence(input: PendingPersistence) {
    const previous = this.persistenceQueues.get(input.sessionId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(async () => {
      await this.store.upsertYjsState(input);
    });
    this.persistenceQueues.set(input.sessionId, next);
    return next;
  }

  private cancelScheduledPersistence(sessionId: string) {
    const timer = this.persistenceTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.persistenceTimers.delete(sessionId);
    }
    this.pendingPersistence.delete(sessionId);
  }

  private encodeState(doc: Y.Doc): string {
    return Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64");
  }
}
