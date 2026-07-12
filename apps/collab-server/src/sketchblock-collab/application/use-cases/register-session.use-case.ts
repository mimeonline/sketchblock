import { Inject, Injectable } from "@nestjs/common";

import type { JoinSessionPayload } from "../dtos/collab-schemas.js";
import { SessionStorePort } from "../ports/session-store.port.js";
import { YjsDocumentRegistryPort } from "../ports/yjs-document-registry.port.js";

@Injectable()
export class RegisterSessionUseCase {
  constructor(
    @Inject(SessionStorePort) private readonly store: SessionStorePort,
    @Inject(YjsDocumentRegistryPort) private readonly yjsDocuments: YjsDocumentRegistryPort,
  ) {}

  async execute(input: JoinSessionPayload) {
    const session = await this.store.getOrCreateSession(input);

    if (input.initialContent !== undefined && session.snapshot && !session.yjsRevision) {
      await this.yjsDocuments.mirrorSnapshot({
        sessionId: input.sessionId,
        snapshot: session.snapshot,
        updatedBy: "github",
      });
    }

    return session;
  }
}
