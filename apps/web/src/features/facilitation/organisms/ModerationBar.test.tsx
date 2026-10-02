import { cleanup, fireEvent, render as rtlRender, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "../../../../messages/en.json";
import { DEFAULT_MODERATION, type ModerationState } from "../types";
import { ModerationBar } from "./ModerationBar";

function render(onUpdate = vi.fn(), moderation: ModerationState = DEFAULT_MODERATION) {
  rtlRender(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ModerationBar moderation={moderation} onUpdate={onUpdate} />
    </NextIntlClientProvider>,
  );
  return onUpdate;
}

describe("ModerationBar", () => {
  afterEach(cleanup);

  it("emits partial updates for toggles, timer and reset", () => {
    const onUpdate = render();
    fireEvent.click(screen.getByRole("switch", { name: "Everyone follows me" }));
    expect(onUpdate).toHaveBeenLastCalledWith({ followOwner: true });
    fireEvent.click(screen.getByRole("switch", { name: "Lock editing" }));
    expect(onUpdate).toHaveBeenLastCalledWith({ editingLocked: true });
    fireEvent.click(screen.getByRole("button", { name: "5 min" }));
    expect(onUpdate).toHaveBeenLastCalledWith({ timer: { durationSeconds: 300 } });
    fireEvent.click(screen.getByRole("button", { name: "Reset votes" }));
    expect(onUpdate).toHaveBeenLastCalledWith({ resetVotes: true });
  });

  it("starts voting with the chosen votes per person and ends it", () => {
    const onUpdate = render();
    fireEvent.change(screen.getByLabelText("Votes per person"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Start voting" }));
    expect(onUpdate).toHaveBeenLastCalledWith({ voting: { open: true, votesPerParticipant: 10 } });
    cleanup();
    const stop = render(vi.fn(), { ...DEFAULT_MODERATION, voting: { open: true, votesPerParticipant: 3 }, timer: { endsAt: new Date(Date.now() + 60_000).toISOString(), durationSeconds: 60 } });
    fireEvent.click(screen.getByRole("button", { name: "End voting" }));
    expect(stop).toHaveBeenLastCalledWith({ voting: { open: false } });
    fireEvent.click(screen.getByRole("button", { name: "Stop timer" }));
    expect(stop).toHaveBeenLastCalledWith({ timer: null });
  });
});
