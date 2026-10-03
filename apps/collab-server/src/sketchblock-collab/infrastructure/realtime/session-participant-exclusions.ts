import { Injectable } from "@nestjs/common";
import type { SessionAuditEvent } from "../../application/dtos/collab-schemas.js";
import { isGuestTicket, type CollabTicketPayload } from "../auth/collab-ticket.verifier.js";

export type GuestAccessPolicy = { enabled: boolean; revokedBefore: number; revision: number };

/** In-memory per-session set of removed participants (actor = GitHub login) that may not rejoin. */
@Injectable()
export class SessionParticipantExclusions {
  private readonly guestPolicy = new Map<string, GuestAccessPolicy>();

  nextGuestPolicy(sessionId: string, enabled: boolean): GuestAccessPolicy {
    const previous = this.guestPolicy.get(sessionId);
    return { enabled, revokedBefore: enabled ? previous?.revokedBefore ?? 0 : Date.now(), revision: (previous?.revision ?? 0) + 1 };
  }

  applyGuestPolicy(sessionId: string, policy: GuestAccessPolicy) {
    this.guestPolicy.set(sessionId, { ...policy });
  }

  restoreGuestPolicy(sessionId: string, audit: SessionAuditEvent[]) {
    for (const event of audit) {
      const metadata = event.metadata;
      if (event.type !== "guest_access_changed" || typeof metadata?.enabled !== "boolean" ||
          typeof metadata.revokedBefore !== "number" || typeof metadata.revision !== "number") continue;
      if (metadata.revision > (this.guestPolicy.get(sessionId)?.revision ?? 0)) {
        this.applyGuestPolicy(sessionId, { enabled: metadata.enabled, revokedBefore: metadata.revokedBefore, revision: metadata.revision });
      }
    }
  }

  canAccessGuest(sessionId: string, auth: CollabTicketPayload | null) {
    if (!auth || !isGuestTicket(auth)) return true;
    const policy = this.guestPolicy.get(sessionId);
    if (!policy) return true;
    // Legacy web tickets have a five-minute lifetime and no issuedAt claim.
    const issuedAt = auth.issuedAt ?? auth.expiresAt - 5 * 60 * 1000;
    return policy.enabled && issuedAt > policy.revokedBefore;
  }

  private readonly excluded = new Map<string, Set<string>>();

  exclude(sessionId: string, actor: string) {
    const actors = this.excluded.get(sessionId) ?? new Set<string>();
    actors.add(actor);
    this.excluded.set(sessionId, actors);
  }

  isExcluded(sessionId: string, actor: string) {
    return this.excluded.get(sessionId)?.has(actor) ?? false;
  }

  clear(sessionId: string) {
    this.excluded.delete(sessionId);
    this.guestPolicy.delete(sessionId);
  }
}
