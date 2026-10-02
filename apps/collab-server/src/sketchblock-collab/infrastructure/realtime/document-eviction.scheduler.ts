import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";

import { PresenceStorePort } from "../../application/ports/presence-store.port.js";
import { YjsDocumentRegistryPort } from "../../application/ports/yjs-document-registry.port.js";
import { FacilitationRegistry } from "./facilitation.registry.js";
import { StructuredLoggerService } from "../../../shared/infrastructure/logging/structured-logger.service.js";

export const DOCUMENT_EVICTION_GRACE_MS = 60_000;

/** Releases a session's in-memory Yjs document once nobody has been present for a grace period. */
@Injectable()
export class DocumentEvictionScheduler implements OnModuleDestroy {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    @Inject(YjsDocumentRegistryPort) private readonly documents: YjsDocumentRegistryPort,
    @Inject(PresenceStorePort) private readonly presence: PresenceStorePort,
    @Inject(StructuredLoggerService) private readonly logger: StructuredLoggerService,
    @Inject(FacilitationRegistry) private readonly facilitation: FacilitationRegistry,
  ) {}

  /** Schedules eviction if the session currently has no presence; keeps an existing timer. */
  scheduleIfEmpty(sessionId: string) {
    if ((this.presence.getSessionPresence(sessionId)?.size ?? 0) > 0 || this.timers.has(sessionId)) {
      return;
    }

    const timer = setTimeout(() => {
      this.timers.delete(sessionId);
      if ((this.presence.getSessionPresence(sessionId)?.size ?? 0) > 0) {
        return;
      }
      void this.documents
        .releaseDocument(sessionId)
        .then((released) => {
          if (!released) {
            this.scheduleIfEmpty(sessionId);
            return;
          }
          this.facilitation.clear(sessionId);
        })
        .catch((error: unknown) => {
          this.logger.errorEvent("yjs.document.release.failed", { sessionId, error });
        });
    }, DOCUMENT_EVICTION_GRACE_MS);
    timer.unref?.();
    this.timers.set(sessionId, timer);
  }

  cancel(sessionId: string) {
    const timer = this.timers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(sessionId);
    }
  }

  onModuleDestroy() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}
