import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import de from "../../../../messages/de.json";
import en from "../../../../messages/en.json";
import type { DrawingFile } from "@/types/sketchblock";
import { DrawingTable, DrawingsView } from "./HomeTemplate";

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
