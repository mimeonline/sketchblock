import { Inject, Injectable } from "@nestjs/common";

import { SessionStorePort } from "../ports/session-store.port.js";
import { YjsDocumentRegistryPort } from "../ports/yjs-document-registry.port.js";

@Injectable()
export class GetSessionStateUseCase {
  constructor(
    @Inject(SessionStorePort) private readonly store: SessionStorePort,
    @Inject(YjsDocumentRegistryPort) private readonly yjsDocuments: YjsDocumentRegistryPort,
  ) {}

  async execute(sessionId: string) {
    const session = await this.store.getSession(sessionId);
    const yjsStateBase64 = await this.yjsDocuments.getEncodedState(sessionId);

    return {
      sessionId,
      exists: Boolean(session),
      status: session?.status || "active",
      drawingPath: session?.drawingPath || null,
      snapshot: session?.snapshot || null,
      snapshotRevision: session?.snapshot?.revision || 0,
      snapshotUpdatedAt: session?.snapshot?.updatedAt || null,
      snapshotUpdatedBy: session?.snapshot?.updatedBy || null,
      yjsRevision: session?.yjsRevision || 0,
      yjsStateBase64,
      yjsUpdatedAt: session?.yjsUpdatedAt || null,
      yjsUpdatedBy: session?.yjsUpdatedBy || null,
      audit: session?.audit || [],
    };
  }
}
