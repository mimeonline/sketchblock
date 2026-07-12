import { Inject, Injectable } from "@nestjs/common";

import type { SessionLifecycleStatus } from "../../domain/types/session-lifecycle-status.js";
import { CollabSessionEntity } from "../../domain/entities/collab-session.entity.js";
import { SessionStorePort } from "../ports/session-store.port.js";

@Injectable()
export class UpdateSessionStatusUseCase {
  constructor(@Inject(SessionStorePort) private readonly store: SessionStorePort) {}

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

    return {
      ok: true as const,
      session: updated,
    };
  }
}
