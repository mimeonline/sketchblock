export type ModerationTimer = {
  endsAt: string;
  durationSeconds: number;
  label?: string;
};

export type ModerationState = {
  followOwner: boolean;
  editingLocked: boolean;
  timer: ModerationTimer | null;
  voting: { open: boolean; votesPerParticipant: number };
};

/** Votes per element id; each entry lists the actor ids that voted for it. */
export type VotesState = Record<string, string[]>;

export type ModerationUpdate = {
  followOwner?: boolean;
  editingLocked?: boolean;
  timer?: { durationSeconds: number; label?: string } | null;
  voting?: { open?: boolean; votesPerParticipant?: number };
  resetVotes?: true;
};

export type ToggleVoteResult =
  | { ok: true; votes: VotesState }
  | { ok: false; error: "voting_closed" | "vote_limit_reached" };

export const timerDurationRange = { min: 10, max: 3600 } as const;
export const votesPerParticipantRange = { min: 1, max: 10 } as const;
export const timerLabelMaxLength = 60;
export const defaultVotesPerParticipant = 3;
export const reactionEmojis = ["👍", "❤️", "😂", "🎉", "❓", "👀"] as const;

export function defaultModerationState(): ModerationState {
  return {
    followOwner: false,
    editingLocked: false,
    timer: null,
    voting: { open: false, votesPerParticipant: defaultVotesPerParticipant },
  };
}

/** Pure state rules for facilitation; payload shape validation happens at the boundary. */
export class FacilitationState {
  /** Applies a partial update and reports whether the votes must be reset. */
  static applyUpdate(
    current: ModerationState,
    update: ModerationUpdate,
    now: Date,
  ): { moderation: ModerationState; votesReset: boolean } {
    const moderation: ModerationState = {
      followOwner: update.followOwner ?? current.followOwner,
      editingLocked: update.editingLocked ?? current.editingLocked,
      timer: current.timer,
      voting: { ...current.voting },
    };

    if (update.timer === null) {
      moderation.timer = null;
    } else if (update.timer) {
      const durationSeconds = Math.min(
        timerDurationRange.max,
        Math.max(timerDurationRange.min, Math.round(update.timer.durationSeconds)),
      );
      const label = update.timer.label?.trim().slice(0, timerLabelMaxLength);
      moderation.timer = {
        endsAt: new Date(now.getTime() + durationSeconds * 1000).toISOString(),
        durationSeconds,
        ...(label ? { label } : {}),
      };
    }

    if (update.voting) {
      if (update.voting.open !== undefined) {
        moderation.voting.open = update.voting.open;
      }
      if (update.voting.votesPerParticipant !== undefined) {
        moderation.voting.votesPerParticipant = Math.min(
          votesPerParticipantRange.max,
          Math.max(votesPerParticipantRange.min, Math.round(update.voting.votesPerParticipant)),
        );
      }
    }

    return { moderation, votesReset: update.resetVotes === true };
  }

  static emptyVotes(): VotesState {
    return {};
  }

  /** Sets or removes the actor's vote for an element; never mutates the input. */
  static toggleVote(
    moderation: ModerationState,
    votes: VotesState,
    actorId: string,
    elementId: string,
  ): ToggleVoteResult {
    if (!moderation.voting.open) {
      return { ok: false, error: "voting_closed" };
    }

    const voters = votes[elementId] ?? [];
    if (voters.includes(actorId)) {
      const remaining = voters.filter((voter) => voter !== actorId);
      const next = { ...votes };
      if (remaining.length > 0) {
        next[elementId] = remaining;
      } else {
        delete next[elementId];
      }
      return { ok: true, votes: next };
    }

    if (FacilitationState.votesUsed(votes, actorId) >= moderation.voting.votesPerParticipant) {
      return { ok: false, error: "vote_limit_reached" };
    }
    return { ok: true, votes: { ...votes, [elementId]: [...voters, actorId] } };
  }

  static votesUsed(votes: VotesState, actorId: string) {
    return Object.values(votes).filter((voters) => voters.includes(actorId)).length;
  }
}
