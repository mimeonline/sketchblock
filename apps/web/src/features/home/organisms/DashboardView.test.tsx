import { cleanup, render as rtlRender, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DrawingFile, RepositoryRecord } from "@/types/sketchblock";
import messages from "../../../../messages/de.json";
import { DashboardView } from "./DashboardView";

vi.mock("@excalidraw/excalidraw", () => ({
  restore: (content: { elements: unknown[] }) => ({ ...content, appState: {}, files: {} }),
  getNonDeletedElements: (elements: unknown[]) => elements,
  exportToSvg: vi.fn(async () => document.createElementNS("http://www.w3.org/2000/svg", "svg")),
}));

function render(ui: React.ReactNode) {
  return rtlRender(<NextIntlClientProvider locale="de" messages={messages}>{ui}</NextIntlClientProvider>);
}

const drawing: DrawingFile = {
  path: "boards/architecture-map.excalidraw",
  sha: "1234567890abcdef",
  lastCommit: "local",
  status: "saved",
};

const repository: RepositoryRecord = {
  id: "repository-1",
  provider: "github",
  githubRepositoryId: 123,
  owner: "michael",
  name: "sketchblock",
  branch: "main",
  status: "ready",
  htmlUrl: "https://github.com/michael/sketchblock",
  apiUrl: "https://api.github.com/repos/michael/sketchblock",
  private: true,
  lastScanAt: "2026-10-08T10:00:00.000Z",
};

describe("DashboardView", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("keeps an instance workspace ready without a GitHub connection", () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));

    render(
      <DashboardView
        collabServerStatus={null}
        drawings={[drawing]}
        githubConnected={false}
        loaded
        repository={{ ...repository, provider: "instance", githubRepositoryId: 0, owner: "local", name: "Workspace" }}
        sessions={[]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Architecture map" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Board öffnen" })).toHaveAttribute(
      "href",
      `/editor?path=${encodeURIComponent(drawing.path)}`,
    );
    expect(screen.queryByText("GitHub-Verbindung erforderlich")).not.toBeInTheDocument();
    const boardsStatus = screen.getByRole("link", { name: /^Boards 1 / });
    expect(within(boardsStatus).getByText("1")).toBeInTheDocument();
  });

  it("keeps the demo workspace ready without a GitHub connection", () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));

    render(
      <DashboardView
        collabServerStatus={null}
        drawings={[drawing]}
        githubConnected={false}
        loaded
        repository={{ ...repository, provider: "demo", githubRepositoryId: -1, owner: "sketchblock", name: "demo-workspace" }}
        sessions={[]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Architecture map" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Board öffnen" })).toHaveAttribute(
      "href",
      `/editor?path=${encodeURIComponent(drawing.path)}`,
    );
    expect(screen.queryByText("GitHub-Verbindung erforderlich")).not.toBeInTheDocument();
    const boardsStatus = screen.getByRole("link", { name: /^Boards 1 / });
    expect(within(boardsStatus).getByText("1")).toBeInTheDocument();
  });

  it("keeps a disconnected GitHub repository on the reconnect path", () => {
    render(
      <DashboardView
        collabServerStatus={null}
        drawings={[drawing]}
        githubConnected={false}
        loaded
        repository={repository}
        sessions={[]}
      />,
    );

    expect(screen.getByRole("heading", { name: "GitHub erneut verbinden" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mit GitHub neu verbinden" })).toHaveAttribute(
      "href",
      "/api/auth/github/start?intent=owner_connect&returnTo=%2F",
    );
    const boardsStatus = screen.getByRole("link", { name: /^Boards – / });
    expect(within(boardsStatus).getByText("–")).toBeInTheDocument();
  });
});
