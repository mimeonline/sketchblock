import type { SessionRole } from "../types/session-role.js";

export type SessionAuthContext = {
  sessionId: string;
  role: SessionRole;
} | null;

export class SessionAccessPolicy {
  static canAccess(auth: SessionAuthContext, sessionId: string, authRequired: boolean) {
    if (!auth) {
      return !authRequired;
    }

    return auth.role === "server" || auth.sessionId === sessionId;
  }

  static canEdit(auth: SessionAuthContext, sessionId: string, authRequired: boolean) {
    if (!this.canAccess(auth, sessionId, authRequired)) {
      return false;
    }

    return !auth || auth.role === "server" || auth.role === "owner" || auth.role === "collaborator";
  }

  static canAdmin(auth: SessionAuthContext, sessionId: string, authRequired: boolean) {
    if (!this.canAccess(auth, sessionId, authRequired)) {
      return false;
    }

    return !auth || auth.role === "server" || auth.role === "owner";
  }

  /** Only the web server and the session owner may seed initial board content. */
  static canSeedContent(auth: SessionAuthContext, authRequired: boolean) {
    if (!auth) {
      return !authRequired;
    }

    return auth.role === "server" || auth.role === "owner";
  }
}
