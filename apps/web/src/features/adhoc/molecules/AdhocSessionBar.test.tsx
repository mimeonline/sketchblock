import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdhocSessionBar } from "./AdhocSessionBar";
import messages from "../../../../messages/en.json";

function render(props: Partial<React.ComponentProps<typeof AdhocSessionBar>>) {
  return rtlRender(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AdhocSessionBar sessionId="s1" isOwner={false} expiresAt="2026-10-03T10:00:00Z" {...props} />
    </NextIntlClientProvider>,
  );
}

describe("AdhocSessionBar", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows the switch and download menu to the owner and patches settings", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    render({ isOwner: true });
    expect(screen.getByText("Ad-hoc room")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: "Participants may download" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/sessions/s1/settings");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ participantDownload: true });
  });

  it("hides download for participants without permission", () => {
    render({ participantDownload: false });
    expect(screen.queryByRole("button", { name: "Download" })).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("shows download for participants when allowed", () => {
    render({ participantDownload: true });
    expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
  });
});
