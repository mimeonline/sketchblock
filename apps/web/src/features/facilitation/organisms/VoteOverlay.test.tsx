import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@excalidraw/excalidraw", () => ({
  sceneCoordsToViewportCoords: ({ sceneX, sceneY }: { sceneX: number; sceneY: number }) => ({ x: sceneX + 10, y: sceneY + 20 }),
}));

import messages from "../../../../messages/en.json";
import { VoteOverlay, VoteSummary } from "./VoteOverlay";

const elements = [
  { id: "a", type: "rectangle", x: 0, y: 0, width: 100, height: 50, isDeleted: false },
  { id: "b", type: "rectangle", x: 200, y: 0, width: 40, height: 40, isDeleted: false },
  { id: "t", type: "text", x: 0, y: 0, width: 1, height: 1, isDeleted: false, text: "Idea B", containerId: "b" },
];
function makeApi(selected: Record<string, boolean> = {}) {
  return {
    getSceneElements: () => elements,
    getAppState: () => ({ offsetLeft: 0, offsetTop: 0, scrollX: 0, scrollY: 0, zoom: { value: 1 }, selectedElementIds: selected }),
    onChange: () => () => {},
    onScrollChange: () => () => {},
  } as never;
}
const wrap = (node: React.ReactNode) => rtlRender(<NextIntlClientProvider locale="en" messages={messages}>{node}</NextIntlClientProvider>);

describe("VoteOverlay", () => {
  afterEach(cleanup);

  it("renders counts at the element's top-right, highlights own votes and toggles on click", async () => {
    const onToggle = vi.fn().mockResolvedValue({ ok: true });
    wrap(<VoteOverlay api={makeApi()} votes={{ a: ["me", "x"], b: ["x"] }} voting={{ open: true, votesPerParticipant: 3 }} actorIds={["me"]} onToggleVote={onToggle} />);
    const badges = await screen.findAllByTestId("vote-badge");
    expect(badges.map((b) => b.textContent)).toEqual(["2", "1"]);
    expect(badges[0]).toHaveStyle({ left: "110px", top: "20px" });
    expect(badges[0]).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("2 votes left")).toBeInTheDocument();
    fireEvent.click(badges[1]);
    expect(onToggle).toHaveBeenCalledWith("b");
  });

  it("votes for the selected element via the panel", async () => {
    const onToggle = vi.fn().mockResolvedValue({ ok: false, error: "vote_limit_reached" });
    wrap(<VoteOverlay api={makeApi({ b: true })} votes={{}} voting={{ open: true, votesPerParticipant: 3 }} actorIds={["me"]} onToggleVote={onToggle} />);
    fireEvent.click(screen.getByRole("button", { name: "Vote" }));
    expect(onToggle).toHaveBeenCalledWith("b");
    await waitFor(() => expect(screen.getByText("You have used all your votes.")).toBeInTheDocument());
  });

  it("summarises top elements with their text", () => {
    wrap(<VoteSummary api={makeApi()} votes={{ a: ["x"], b: ["x", "y"] }} />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Idea B");
    expect(items[0]).toHaveTextContent("2 votes");
  });
});
