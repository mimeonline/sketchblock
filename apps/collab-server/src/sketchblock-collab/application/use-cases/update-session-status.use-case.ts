import { Inject, Injectable } from "@nestjs/common";

import type { SessionLifecycleStatus } from "../../domain/types/session-lifecycle-status.js";
import { CollabSessionEntity } from "../../domain/entities/collab-session.entity.js";
import { SessionConnectionsPort } from "../ports/session-connections.port.js";
import { SessionStorePort } from "../ports/session-store.port.js";

@Injectable()
export class UpdateSessionStatusUseCase {
  constructor(
    @Inject(SessionStorePort) private readonly store: SessionStorePort,
    @Inject(SessionConnectionsPort) private readonly connections: SessionConnectionsPort,
  ) {}

  async execute(input: { sessionId: string; status: SessionLifecycleStatus; updatedBy: string; message?: string }) {
    const current = await this.store.getSession(input.sessionId);

    if (current) {
      const session = new CollabSessionEntity(current.sessionId, current.drawingPath, current.status);
      if (!session.canTransitionTo(input.status)) {
        return {
          ok: false as const,
          error: "invalid_session_status_transition",
        };
      }
    }

    const updated = await this.store.updateSessionStatus(input);
    if (!updated) {
      return {
        ok: false as const,
        error: "session_not_found",
      };
    }

    if (updated.status === "closed") {
      // Ending a session ends live collaboration; the last snapshot stays persisted.
      await this.connections.endSession(input.sessionId, { closedBy: input.updatedBy });
    }

    return {
      ok: true as const,
      session: updated,
    };
  }
}
