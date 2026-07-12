import type { PresenceUser } from "../dtos/collab-schemas.js";

export abstract class PresenceStorePort {
  abstract getPresence(sessionId: string): PresenceUser[];
  abstract getSessionPresence(sessionId: string): Map<string, PresenceUser> | undefined;
  abstract addPresence(sessionId: string, user: PresenceUser): void;
  abstract removePresence(socketId: string): string[];
  abstract deleteSession(sessionId: string): void;
  abstract countActiveSessions(): number;
  abstract countConnectedClients(): number;
}
