import { act, cleanup, render as rtlRender, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CollaborationSession, DrawingFile } from "@/types/sketchblock";
import { BoardGallery } from "./BoardGallery";
import messages from "../../../../messages/de.json";

function render(ui: React.ReactNode) {
  return rtlRender(<NextIntlClientProvider locale="de" messages={messages}>{ui}</NextIntlClientProvider>);
}

const drawing: DrawingFile = {
  path: "examples/drawings/system-map.excalidraw",
  sha: "1234567890abcdef",
  lastCommit: "remote",
  status: "indexed",
};

const activeSession: CollaborationSession = {
  id: "session-live",
  repositoryId: "repository-1",
  drawingPath: drawing.path,
  status: "active",
  createdAt: "2026-07-09T10:00:00.000Z",
  updatedAt: "2026-07-09T10:00:00.000Z",
  collab: {
    status: "registered",
    serverUrl: "http://localhost:4513",
    sessionStatus: "active",
    presenceCount: 2,
    presence: [
      { socketId: "socket-1", userId: "ada", displayName: "Ada Lovelace", joinedAt: "2026-07-09T10:00:00.000Z" },
      { socketId: "socket-2", userId: "grace", displayName: "Grace Hopper", joinedAt: "2026-07-09T10:01:00.000Z" },
    ],
    lastCheckedAt: "2026-07-09T10:02:00.000Z",
  },
};

describe("BoardGallery", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("shows an actionable empty state", () => {
    render(<BoardGallery drawings={[]} />);

    expect(screen.getByText("Noch keine Boards")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Repository einrichten" })).toHaveAttribute(
      "href",
      "/repositories",
    );
  });

  it("keeps board navigation available while the preview loads", () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));

    render(<BoardGallery drawings={[drawing]} />);

    expect(screen.getByText("System map")).toBeInTheDocument();
    expect(screen.getByText(drawing.path)).toBeInTheDocument();
    expect(screen.getByText(`SHA ${drawing.sha.slice(0, 7)}`)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "System map im Editor öffnen" })).toHaveAttribute(
      "href",
      `/editor?path=${encodeURIComponent(drawing.path)}`,
    );
  });

  it("highlights live boards with their current participants", () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));

    render(<BoardGallery drawings={[drawing]} sessions={[activeSession]} />);

    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText("2 Personen arbeiten gerade")).toBeInTheDocument();
    expect(screen.getByLabelText("Arbeiten gerade: Ada Lovelace, Grace Hopper")).toBeInTheDocument();
    expect(screen.getByTitle("Ada Lovelace")).toHaveTextContent("AL");
  });

  it("keeps missing and empty presence data neutral", () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));

    render(<BoardGallery drawings={[drawing]} sessions={[{ ...activeSession, collab: undefined }]} />);

    expect(screen.queryByText("Live")).not.toBeInTheDocument();
    expect(screen.getByText("Indiziert")).toBeInTheDocument();
  });

  it("defers rendering for very large boards", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          drawing: {
            path: drawing.path,
            sha: drawing.sha,
            content: {
              elements: Array.from({ length: 601 }, (_, index) => ({ id: `element-${index}` })),
            },
          },
        }),
      }),
    );

    render(<BoardGallery drawings={[drawing]} />);
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText("Großes Board")).toBeInTheDocument();
    expect(screen.getByText("Im Editor ansehen")).toBeInTheDocument();
  });

  it("supports a standalone gallery without a self-link or board limit", () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    const drawings = Array.from({ length: 7 }, (_, index) => ({
      ...drawing,
      path: `boards/board-${index + 1}.excalidraw`,
      sha: `${index + 1}`.repeat(16),
    }));

    render(
      <BoardGallery
        description="Alle Arbeitsflächen auf einen Blick."
        drawings={drawings}
        limit={null}
        showAllLink={false}
        title="Board-Bibliothek"
      />,
    );

    expect(screen.getByRole("heading", { name: "Board-Bibliothek" })).toBeInTheDocument();
    expect(screen.getByText("Alle Arbeitsflächen auf einen Blick.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Alle Boards" })).not.toBeInTheDocument();
    expect(screen.getByText("Board 7")).toBeInTheDocument();
    expect(screen.queryByText(/von 7 Boards werden angezeigt/)).not.toBeInTheDocument();
  });

  it("keeps live boards at the front of the scan order", () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    const quietDrawing = {
      ...drawing,
      path: "boards/quiet-board.excalidraw",
      sha: "abcdef1234567890",
    };

    render(<BoardGallery drawings={[quietDrawing, drawing]} sessions={[activeSession]} />);

    const boardLinks = screen.getAllByRole("link").filter((link) =>
      link.getAttribute("href")?.startsWith("/editor?path="),
    );
    expect(boardLinks[0]).toHaveAccessibleName("System map im Editor öffnen");
    expect(screen.getByText("1 Live-Board")).toBeInTheDocument();
  });

  it("keeps a preview failure actionable", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Preview failed" }),
      }),
    );

    render(<BoardGallery drawings={[drawing]} />);
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText("Vorschau nicht verfügbar")).toBeInTheDocument();
    expect(screen.getByText("Board direkt öffnen")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "System map im Editor öffnen" })).toBeInTheDocument();
  });
});
