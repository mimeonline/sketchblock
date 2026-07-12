import { fireEvent, render as rtlRender, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RepositoryPickerDialog } from "./RepositoryPickerDialog";
import messages from "../../../../messages/de.json";

function render(ui: React.ReactNode) {
  return rtlRender(<NextIntlClientProvider locale="de" messages={messages}>{ui}</NextIntlClientProvider>);
}

const availableRepository = {
  githubRepositoryId: 101,
  owner: "mimeonline",
  name: "sketchblock",
  fullName: "mimeonline/sketchblock",
  branch: "main",
  htmlUrl: "https://github.com/mimeonline/sketchblock",
  apiUrl: "https://api.github.com/repos/mimeonline/sketchblock",
  private: true,
};

describe("RepositoryPickerDialog", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads writable repositories and selects one for scanning", async () => {
    const selectedRepository = {
      id: "github-101",
      ...availableRepository,
      status: "ready" as const,
      drawingCount: 1,
      lastScanAt: "2026-07-09T20:00:00.000Z",
    };
    const drawings = [
      {
        path: "docs/system.excalidraw",
        sha: "drawing-sha",
        lastCommit: "remote",
        status: "indexed" as const,
        repositoryId: "github-101",
      },
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ repositories: [availableRepository] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ repository: selectedRepository, drawings }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const onSelected = vi.fn();

    render(<RepositoryPickerDialog onSelected={onSelected} />);
    fireEvent.click(screen.getByRole("button", { name: "Repository hinzufügen" }));
    fireEvent.click(await screen.findByRole("button", { name: /mimeonline\/sketchblock/ }));

    await waitFor(() => {
      expect(onSelected).toHaveBeenCalledWith(selectedRepository, drawings);
    });
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/repositories/available", {
      cache: "no-store",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/repositories",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ githubRepositoryId: 101 }),
      }),
    );
  });
});
