import { Injectable } from "@nestjs/common";

import {
  defaultModerationState,
  FacilitationState,
  type ModerationState,
  type ModerationUpdate,
  type ToggleVoteResult,
  type VotesState,
} from "../../domain/services/facilitation-state.js";

type SessionFacilitation = { moderation: ModerationState; votes: VotesState };

/** In-memory per-session moderation and vote state (lost on restart; cleared on session end/release). */
@Injectable()
export class FacilitationRegistry {
  private readonly sessions = new Map<string, SessionFacilitation>();

  getModeration(sessionId: string): ModerationState {
    return this.sessions.get(sessionId)?.moderation ?? defaultModerationState();
  }

  getVotes(sessionId: string): VotesState {
    return this.sessions.get(sessionId)?.votes ?? FacilitationState.emptyVotes();
  }

  update(sessionId: string, update: ModerationUpdate, now = new Date()) {
    const current = this.sessions.get(sessionId);
    const { moderation, votesReset } = FacilitationState.applyUpdate(
      current?.moderation ?? defaultModerationState(),
      update,
      now,
    );
    const votes = votesReset ? FacilitationState.emptyVotes() : (current?.votes ?? FacilitationState.emptyVotes());
    this.sessions.set(sessionId, { moderation, votes });
    return { moderation, votes, votesReset };
  }

  toggleVote(sessionId: string, actorId: string, elementId: string): ToggleVoteResult {
    const moderation = this.getModeration(sessionId);
    const result = FacilitationState.toggleVote(moderation, this.getVotes(sessionId), actorId, elementId);
    if (result.ok) {
      this.sessions.set(sessionId, { moderation, votes: result.votes });
    }
    return result;
  }

  clear(sessionId: string) {
    this.sessions.delete(sessionId);
  }
}
