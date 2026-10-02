import { describe, expect, it } from "vitest";

import { defaultModerationState, FacilitationState } from "./facilitation-state.js";

const now = new Date("2026-10-02T10:00:00.000Z");

describe("FacilitationState", () => {
  it("starts with everything off and three votes", () => {
    expect(defaultModerationState()).toEqual({
      followOwner: false,
      editingLocked: false,
      timer: null,
      voting: { open: false, votesPerParticipant: 3 },
    });
  });

  it("applies partial updates without touching other fields", () => {
    const { moderation, votesReset } = FacilitationState.applyUpdate(
      defaultModerationState(),
      { editingLocked: true, voting: { open: true } },
      now,
    );
    expect(moderation).toMatchObject({ followOwner: false, editingLocked: true, voting: { open: true, votesPerParticipant: 3 } });
    expect(votesReset).toBe(false);
  });

  it("starts and stops a timer and trims the label", () => {
    const started = FacilitationState.applyUpdate(
      defaultModerationState(),
      { timer: { durationSeconds: 60, label: "  Think  " } },
      now,
    ).moderation;
    expect(started.timer).toEqual({ endsAt: "2026-10-02T10:01:00.000Z", durationSeconds: 60, label: "Think" });
    expect(FacilitationState.applyUpdate(started, { timer: null }, now).moderation.timer).toBeNull();
    expect(FacilitationState.applyUpdate(started, { followOwner: true }, now).moderation.timer).toEqual(started.timer);
  });

  it("reports resetVotes", () => {
    expect(FacilitationState.applyUpdate(defaultModerationState(), { resetVotes: true }, now).votesReset).toBe(true);
  });

  it("rejects votes while voting is closed", () => {
    expect(FacilitationState.toggleVote(defaultModerationState(), {}, "a", "e1")).toEqual({ ok: false, error: "voting_closed" });
  });

  it("toggles votes and enforces the per-participant limit", () => {
    const open = FacilitationState.applyUpdate(defaultModerationState(), { voting: { open: true, votesPerParticipant: 2 } }, now).moderation;
    let votes = {};
    for (const id of ["e1", "e2"]) {
      const result = FacilitationState.toggleVote(open, votes, "a", id);
      expect(result.ok).toBe(true);
      if (result.ok) votes = result.votes;
    }
    expect(FacilitationState.toggleVote(open, votes, "a", "e3")).toEqual({ ok: false, error: "vote_limit_reached" });
    const other = FacilitationState.toggleVote(open, votes, "b", "e1");
    expect(other).toEqual({ ok: true, votes: { e1: ["a", "b"], e2: ["a"] } });
    const removed = FacilitationState.toggleVote(open, votes, "a", "e1");
    expect(removed).toEqual({ ok: true, votes: { e2: ["a"] } });
    expect(votes).toEqual({ e1: ["a"], e2: ["a"] });
  });
});
