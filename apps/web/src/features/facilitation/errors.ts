const KEYS: Record<string, string> = {
  editing_locked: "editingLocked",
  voting_closed: "votingClosed",
  vote_limit_reached: "voteLimitReached",
  reaction_rate_limited: "reactionRateLimited",
};

/** Maps a server error code to a Facilitation message key. */
export function facilitationErrorKey(error?: string) {
  return (error && KEYS[error]) || "actionFailed";
}
