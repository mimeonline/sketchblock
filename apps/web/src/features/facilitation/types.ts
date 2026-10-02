export const REACTION_EMOJIS = ["👍", "❤️", "😂", "🎉", "❓", "👀"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export type ModerationState = {
  followOwner: boolean;
  editingLocked: boolean;
  timer: { endsAt: string; durationSeconds: number; label?: string } | null;
  voting: { open: boolean; votesPerParticipant: number };
};

export type ModerationUpdate = {
  followOwner?: boolean;
  editingLocked?: boolean;
  timer?: { durationSeconds: number; label?: string } | null;
  voting?: { open?: boolean; votesPerParticipant?: number };
  resetVotes?: true;
};

/** elementId -> actor ids that voted for it. */
export type VotesState = Record<string, string[]>;

export type RemoteViewport = { scrollX: number; scrollY: number; zoom: number; sequence: number };

export type IncomingReaction = {
  id: number;
  emoji: string;
  pointer?: { x: number; y: number };
  displayName?: string;
  socketId?: string;
};

export type FacilitationAck = { ok: boolean; error?: string };

export const DEFAULT_MODERATION: ModerationState = {
  followOwner: false,
  editingLocked: false,
  timer: null,
  voting: { open: false, votesPerParticipant: 3 },
};
