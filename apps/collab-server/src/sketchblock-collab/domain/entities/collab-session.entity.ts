import type { SessionLifecycleStatus } from "../types/session-lifecycle-status.js";

export class CollabSessionEntity {
  constructor(
    readonly sessionId: string,
    readonly drawingPath: string | null,
    readonly status: SessionLifecycleStatus,
  ) {}

  canTransitionTo(nextStatus: SessionLifecycleStatus) {
    if (this.status === "closed" && nextStatus !== "closed") {
      return false;
    }

    return true;
  }
}
