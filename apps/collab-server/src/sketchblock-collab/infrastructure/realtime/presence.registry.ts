import { Injectable } from "@nestjs/common";

import type { PresenceUser } from "../../application/dtos/collab-schemas.js";
import { PresenceStorePort } from "../../application/ports/presence-store.port.js";

@Injectable()
export class PresenceRegistry extends PresenceStorePort {
  private readonly presenceBySession = new Map<string, Map<string, PresenceUser>>();

  constructor() {
    super();
  }

  getPresence(sessionId: string): PresenceUser[] {
    return Array.from(this.presenceBySession.get(sessionId)?.values() || []);
  }

  addPresence(sessionId: string, user: PresenceUser) {
    const sessionPresence = this.presenceBySession.get(sessionId) || new Map<string, PresenceUser>();
    sessionPresence.set(user.socketId, user);
    this.presenceBySession.set(sessionId, sessionPresence);
  }

  removePresence(socketId: string): string[] {
    const changedSessions: string[] = [];

    for (const [sessionId, sessionPresence] of this.presenceBySession) {
      if (sessionPresence.delete(socketId)) {
        changedSessions.push(sessionId);
      }

      if (sessionPresence.size === 0) {
        this.presenceBySession.delete(sessionId);
      }
    }

    return changedSessions;
  }

  getSessionPresence(sessionId: string) {
    return this.presenceBySession.get(sessionId);
  }

  deleteSession(sessionId: string) {
    this.presenceBySession.delete(sessionId);
  }

  countActiveSessions() {
    return this.presenceBySession.size;
  }

  countConnectedClients() {
    return Array.from(this.presenceBySession.values()).reduce((total, sessionPresence) => total + sessionPresence.size, 0);
  }
}
