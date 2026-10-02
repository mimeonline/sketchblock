import { Inject, Injectable } from "@nestjs/common";

import { SessionConnectionsPort } from "../ports/session-connections.port.js";
import { SessionStorePort } from "../ports/session-store.port.js";
import { YjsDocumentRegistryPort } from "../ports/yjs-document-registry.port.js";

/** Deletes a session completely: sockets, live document, persisted row and audit events. */
@Injectable()
export class PurgeSessionUseCase {
  constructor(
    @Inject(SessionConnectionsPort) private readonly connections: SessionConnectionsPort,
    @Inject(YjsDocumentRegistryPort) private readonly yjsDocuments: YjsDocumentRegistryPort,
    @Inject(SessionStorePort) private readonly store: SessionStorePort,
  ) {}

  async execute(sessionId: string): Promise<{ purged: boolean }> {
    await this.connections.endSession(sessionId, { closedBy: "web-api" });
    // Block any pending or late persistence before the row is deleted so it cannot be re-created.
    await this.yjsDocuments.purgeDocument(sessionId);
    const deleted = await this.store.deleteSession(sessionId);
    return { purged: deleted !== null };
  }
}
