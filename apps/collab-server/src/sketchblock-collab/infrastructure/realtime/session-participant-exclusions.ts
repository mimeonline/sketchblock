import { Injectable } from "@nestjs/common";

/** In-memory per-session set of removed participants (actor = GitHub login) that may not rejoin. */
@Injectable()
export class SessionParticipantExclusions {
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
  }
}
