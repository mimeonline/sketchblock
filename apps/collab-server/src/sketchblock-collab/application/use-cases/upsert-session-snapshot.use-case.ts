import { Inject, Injectable } from "@nestjs/common";

import type { CanvasUpdatePayload } from "../dtos/collab-schemas.js";
import { SessionStorePort } from "../ports/session-store.port.js";
import { YjsDocumentRegistryPort } from "../ports/yjs-document-registry.port.js";

@Injectable()
export class UpsertSessionSnapshotUseCase {
  constructor(
    @Inject(SessionStorePort) private readonly store: SessionStorePort,
    @Inject(YjsDocumentRegistryPort) private readonly yjsDocuments: YjsDocumentRegistryPort,
  ) {}

  async execute(input: CanvasUpdatePayload) {
    const session = await this.store.getSession(input.sessionId);
    const snapshot = await this.store.upsertSnapshot(input, session?.drawingPath || null);
    const yjsState = await this.yjsDocuments.mirrorSnapshot({
      sessionId: input.sessionId,
      snapshot,
      updatedBy: input.updatedBy,
    });

    return {
      snapshot,
      yjsStateBase64: yjsState.stateBase64,
    };
  }
}
