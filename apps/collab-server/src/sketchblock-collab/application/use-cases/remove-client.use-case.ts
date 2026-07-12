import { Inject, Injectable } from "@nestjs/common";

import { PresenceStorePort } from "../ports/presence-store.port.js";
import { SessionStorePort } from "../ports/session-store.port.js";

@Injectable()
export class RemoveClientUseCase {
  constructor(
    @Inject(PresenceStorePort) private readonly presence: PresenceStorePort,
    @Inject(SessionStorePort) private readonly store: SessionStorePort,
  ) {}

  async execute(input: { sessionId: string; socketId: string; removedBy: string }) {
    const sessionPresence = this.presence.getSessionPresence(input.sessionId);
    const targetPresence = sessionPresence?.get(input.socketId);

    if (!targetPresence) {
      return {
        ok: false as const,
        error: "client_not_found",
      };
    }

    this.presence.removePresence(input.socketId);
    await this.store.appendSessionAudit(input.sessionId, {
      type: "client_kicked",
      actor: input.removedBy,
      message: `${targetPresence.displayName} was removed from the session.`,
      metadata: {
        socketId: input.socketId,
        userId: targetPresence.userId,
        displayName: targetPresence.displayName,
      },
    });

    return {
      ok: true as const,
      presence: targetPresence,
    };
  }
}
