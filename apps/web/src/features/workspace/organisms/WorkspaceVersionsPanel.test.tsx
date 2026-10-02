import { cleanup, render as rtlRender, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkspaceVersionsPanel } from "./WorkspaceVersionsPanel";
import messages from "../../../../messages/en.json";

function render(props: Parameters<typeof WorkspaceVersionsPanel>[0]) {
  return rtlRender(
    <NextIntlClientProvider locale="en" messages={messages}>
      <WorkspaceVersionsPanel {...props} />
    </NextIntlClientProvider>
  );
}

describe("WorkspaceVersionsPanel", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("loads and displays versions on mount", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        versions: [
          { revision: 2, createdAt: "2025-01-01T10:00:00Z", message: "Update" },
          { revision: 1, createdAt: "2025-01-01T09:00:00Z", message: null },
        ],
        currentRevision: 2,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render({ boardId: "board-123", boardTitle: "Test Board", onRestored: vi.fn() });

    await waitFor(() => {
      expect(screen.getByText(/Revision 2/)).toBeInTheDocument();
      expect(screen.getByText(/Revision 1/)).toBeInTheDocument();
    });
  });

  it("reloads versions when refreshKey prop changes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        versions: [{ revision: 1, createdAt: "2025-01-01T09:00:00Z", message: null }],
        currentRevision: 1,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const onRestored = vi.fn();
    const { rerender } = rtlRender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <WorkspaceVersionsPanel boardId="board-123" boardTitle="Test Board" onRestored={onRestored} refreshKey="sha-v1" />
      </NextIntlClientProvider>
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(`/api/workspace/boards/board-123/versions`, {
      cache: "no-store",
    });

    // Change refreshKey to trigger a reload
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <WorkspaceVersionsPanel boardId="board-123" boardTitle="Test Board" onRestored={onRestored} refreshKey="sha-v2" />
      </NextIntlClientProvider>
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
