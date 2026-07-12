import type {
  CanvasUpdatePayload,
  JoinSessionPayload,
  SessionAuditEvent,
  SessionSnapshot,
  StoredSession,
} from "../dtos/collab-schemas.js";
import type { SessionLifecycleStatus } from "../../domain/types/session-lifecycle-status.js";

export abstract class SessionStorePort {
  abstract getOrCreateSession(input: JoinSessionPayload): Promise<StoredSession>;
  abstract upsertSnapshot(input: CanvasUpdatePayload, drawingPath: string | null): Promise<SessionSnapshot>;
  abstract upsertYjsState(input: { sessionId: string; stateBase64: string; updatedBy: string }): Promise<StoredSession>;
  abstract updateSessionStatus(input: {
    sessionId: string;
    status: SessionLifecycleStatus;
    updatedBy: string;
    message?: string;
  }): Promise<StoredSession | null>;
  abstract appendSessionAudit(
    sessionId: string,
    event: Omit<SessionAuditEvent, "id" | "at">,
  ): Promise<StoredSession | null>;
  abstract getSession(sessionId: string): Promise<StoredSession | null>;
  abstract countSessions(): Promise<number>;
  abstract deleteSession(sessionId: string): Promise<StoredSession | null>;
}
