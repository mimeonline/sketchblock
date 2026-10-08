import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import de from "../../../../messages/de.json";
import en from "../../../../messages/en.json";
import type { DrawingFile } from "@/types/sketchblock";
import { DrawingTable, DrawingsView, saveStatusCopy, shouldShowGitHubReconnect, updateDrawingAfterSave } from "./HomeTemplate";

vi.mock("@/features/home/organisms/ExcalidrawEditor", () => ({ ExcalidrawEditor: () => null }));
vi.mock("@/features/home/organisms/BoardGallery", () => ({ BoardGallery: () => null }));

const statuses: DrawingFile["status"][] = ["indexed", "dirty", "saved", "stale", "conflict"];
const drawings = statuses.map((status) => ({
  path: `examples/a-long-folder-for-path-truncation/${status}.excalidraw`,
  sha: "1234567890",
  lastCommit: "remote",
  status,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("drawing list", () => {
  it.each([["de", de], ["en", en]] as const)("uses badge translations in the %s status filter", async (locale, messages) => {
    render(<NextIntlClientProvider locale={locale} messages={messages}><DrawingsView drawings={drawings} sessions={[]} selectedPath="" /></NextIntlClientProvider>);
    fireEvent.click(screen.getByRole("combobox"));
    for (const status of statuses) {
      expect(await screen.findByRole("option", { name: messages.Common.status[status] })).toBeInTheDocument();
    }
  });

  it("keeps zebra rows, selection, responsive columns and full path tooltips", async () => {
    const { container } = render(<NextIntlClientProvider locale="de" messages={de}><DrawingTable drawings={drawings} selectedPath={drawings[2].path} showActions /></NextIntlClientProvider>);
    const rows = screen.getAllByRole("row");
    expect(rows[0].parentElement).toHaveClass("bg-slate-200");
    expect(rows[1]).toHaveClass("bg-white");
    expect(rows[2]).toHaveClass("bg-slate-50");
    expect(rows[3]).toHaveAttribute("aria-selected", "true");
    expect(rows[3]).toHaveClass("bg-primary/10");
    expect(screen.getByRole("columnheader", { name: de.Workspace.lastCommit })).toHaveClass("hidden", "md:table-cell");
    const path = screen.getByText(drawings[0].path);
    expect(path).toHaveClass("truncate");
    expect(path).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(document.body, { key: "Tab" });
    act(() => path.focus());
    await waitFor(() => expect(document.querySelector('[data-slot="tooltip-content"]')).toHaveTextContent(drawings[0].path));
    expect(container.querySelector('[data-slot="table"]')?.parentElement?.parentElement).toHaveClass("bg-white");
    expect(screen.getAllByRole("link", { name: de.Workspace.edit })[0]).toHaveAttribute("href", `/editor?path=${encodeURIComponent(drawings[0].path)}`);
  });
});

describe("GitHub reconnect banner", () => {
  it("only requires reconnect for a disconnected GitHub repository", () => {
    const base = { loaded: true, demoMode: false, githubConnected: false };

    expect(shouldShowGitHubReconnect({ ...base, repository: { provider: "github" } })).toBe(true);
    expect(shouldShowGitHubReconnect({ ...base, repository: { provider: "instance" } })).toBe(false);
    expect(shouldShowGitHubReconnect({ ...base, repository: null })).toBe(false);
  });
});

describe("saved drawing state", () => {
  it("keeps instance board metadata for the version history panel", () => {
    const drawing = {
      path: "qa-private-history.excalidraw",
      sha: "revision-1",
      content: { elements: [] },
      boardId: "board-123",
      title: "QA private history",
    };
    const content = { elements: [{ id: "updated" }] };

    expect(updateDrawingAfterSave(drawing, content, "revision-2")).toEqual({
      ...drawing,
      sha: "revision-2",
      content,
    });
  });
});

describe("save status copy", () => {
  it("uses instance workspace wording while saving and after saving", () => {
    expect(saveStatusCopy("saving", false, "instance")).toEqual({ namespace: "instance", key: "versionSaving" });
    expect(saveStatusCopy("saved", false, "instance")).toEqual({ namespace: "instance", key: "versionSaved" });
  });

  it("keeps demo and GitHub workspace wording on their existing paths", () => {
    expect(saveStatusCopy("saving", true, "instance")).toEqual({ namespace: "workspace", key: "demoBoardSaving" });
    expect(saveStatusCopy("saved", true, "github")).toEqual({ namespace: "workspace", key: "demoBoardSaved" });
    expect(saveStatusCopy("saving", false, "github")).toEqual({ namespace: "workspace", key: "boardSaving" });
    expect(saveStatusCopy("saved", false, "github")).toEqual({ namespace: "workspace", key: "boardSaved" });
  });
});
