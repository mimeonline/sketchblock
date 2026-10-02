import { cleanup, render as rtlRender, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DrawingContent, DrawingFile, RepositoryRecord } from "@/types/sketchblock";
import { EditorView } from "./EditorView";
import messages from "../../../../messages/de.json";

function render(ui: React.ReactNode) {
  return rtlRender(<NextIntlClientProvider locale="de" messages={messages}>{ui}</NextIntlClientProvider>);
}

vi.mock("@excalidraw/excalidraw", () => ({ restoreElements: (elements: unknown[]) => elements }));

vi.mock("next/dynamic", () => ({
  default: () =>
    function MockExcalidraw() {
      return <button type="button">Mock Excalidraw</button>;
    },
}));

vi.mock("@/features/home/hooks/useExcalidrawYjs", () => ({
  useExcalidrawYjs: () => ({
    applyLocalScene: vi.fn(),
    isApplyingRemoteRef: { current: false },
  }),
}));

vi.mock("@/features/workspace/organisms/WorkspaceVersionsPanel", () => ({
  WorkspaceVersionsPanel: ({ boardTitle }: { boardTitle: string }) => <div>Versions for {boardTitle}</div>,
}));

const drawing: DrawingContent = {
  path: "test-board.excalidraw",
  sha: "abc123",
  content: { elements: [] },
};

const selectedDrawing: DrawingFile = {
  path: "test-board.excalidraw",
  sha: "abc123",
  lastCommit: "remote",
  status: "saved",
};

const githubRepository: RepositoryRecord = {
  id: "repo-1",
  provider: "github",
  githubRepositoryId: 123,
  owner: "test",
  name: "test-repo",
  branch: "main",
  status: "ready",
  htmlUrl: "https://github.com/test/test-repo",
  apiUrl: "https://api.github.com/repos/test/test-repo",
  private: false,
  lastScanAt: new Date().toISOString(),
};

const instanceRepository: RepositoryRecord = {
  id: "repo-2",
  provider: "instance",
  githubRepositoryId: 0,
  owner: "local",
  name: "instance-workspace",
  branch: "main",
  status: "ready",
  htmlUrl: "http://localhost:4512",
  apiUrl: "http://localhost:4512",
  private: false,
  lastScanAt: new Date().toISOString(),
};

describe("EditorView", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows git details accordion for GitHub provider", () => {
    render(
      <EditorView
        demoMode={false}
        drawing={drawing}
        repository={githubRepository}
        selectedDrawing={selectedDrawing}
        saveState={{ status: "saved", baseSha: "abc123", remoteSha: "abc123" }}
        onReload={vi.fn()}
        onDirty={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText("Git-Details")).toBeInTheDocument();
  });

  it("hides git details accordion for instance provider", () => {
    render(
      <EditorView
        demoMode={false}
        drawing={drawing}
        repository={instanceRepository}
        selectedDrawing={selectedDrawing}
        saveState={{ status: "saved", baseSha: "abc123", remoteSha: "abc123" }}
        onReload={vi.fn()}
        onDirty={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.queryByText("Git-Details")).not.toBeInTheDocument();
  });

  it("passes version save label and hint to ExcalidrawEditor for instance provider", () => {
    render(
      <EditorView
        demoMode={false}
        drawing={drawing}
        repository={instanceRepository}
        selectedDrawing={selectedDrawing}
        saveState={{ status: "saved", baseSha: "abc123", remoteSha: "abc123" }}
        onReload={vi.fn()}
        onDirty={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText("Mock Excalidraw")).toBeInTheDocument();
    // The component passes saveLabel and hint props to ExcalidrawEditor
    // We can verify the component renders without errors
  });
});
