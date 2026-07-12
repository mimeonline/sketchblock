import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SessionShareDialog, copyText } from "./SessionShareDialog";
import messages from "../../../../messages/de.json";

function render(ui: React.ReactNode) {
  return rtlRender(<NextIntlClientProvider locale="de" messages={messages}>{ui}</NextIntlClientProvider>);
}

const collaboratorHref = "/join/session-123?invite=collaborator-token";
const viewerHref = "/join/session-123?invite=viewer-token";

describe("SessionShareDialog", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("offers distinct QR codes for collaborator and viewer without owner sharing", async () => {
    render(
      <SessionShareDialog
        collaboratorHref={collaboratorHref}
        viewerHref={viewerHref}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Einladen" }));

    expect(await screen.findByTitle("QR-Code für Collaborator-Session")).toBeInTheDocument();
    expect(screen.queryByText("Owner", { exact: true })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Viewer" }));

    expect(await screen.findByTitle("QR-Code für Viewer-Session")).toBeInTheDocument();
  });

  it("copies the correct URL for both roles with visible feedback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(
      <SessionShareDialog
        collaboratorHref={collaboratorHref}
        viewerHref={viewerHref}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Einladen" }));
    const copyButtons = await screen.findAllByRole("button", { name: "Link kopieren" });
    fireEvent.click(copyButtons[0]);

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}${collaboratorHref}`));
    expect(screen.getByRole("button", { name: "Kopiert" })).toBeInTheDocument();

    fireEvent.click(copyButtons[1]);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}${viewerHref}`));
  });

  it("returns false when no clipboard mechanism is available", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: undefined,
    });

    await expect(copyText(`${window.location.origin}${viewerHref}`)).resolves.toBe(false);
  });
});
