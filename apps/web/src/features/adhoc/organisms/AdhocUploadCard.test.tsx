import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdhocUploadCard } from "./AdhocUploadCard";
import messages from "../../../../messages/en.json";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function render() {
  return rtlRender(<NextIntlClientProvider locale="en" messages={messages}><AdhocUploadCard /></NextIntlClientProvider>);
}

function upload(file: File) {
  fireEvent.change(screen.getByTestId("adhoc-file-input"), { target: { files: [file] } });
}

describe("AdhocUploadCard", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    push.mockReset();
  });

  it("posts a valid json file and navigates to the room", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: "/join/abc?owner=1" }) });
    vi.stubGlobal("fetch", fetchMock);
    render();
    upload(new File(['{"type":"excalidraw","elements":[]}'], "a.excalidraw", { type: "application/json" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/join/abc?owner=1"));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/adhoc-sessions");
    expect(JSON.parse(init.body)).toEqual({ fileName: "a.excalidraw", board: '{"type":"excalidraw","elements":[]}' });
  });

  it("shows a friendly message for oversized files without calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render();
    const big = new File(["x"], "big.json");
    Object.defineProperty(big, "size", { value: 11 * 1024 * 1024 });
    upload(big);
    expect(await screen.findByRole("alert")).toHaveTextContent("larger than 10 MB");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps server error codes to messages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ code: "rate_limited" }) }));
    render();
    upload(new File(["{}"], "a.json"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many rooms");
    expect(push).not.toHaveBeenCalled();
  });

  it("opens the file dialog from the keyboard-accessible button", () => {
    render();
    const click = vi.spyOn(screen.getByTestId("adhoc-file-input"), "click");
    const button = screen.getByRole("button", { name: "Choose file" });
    button.focus();
    expect(button).toHaveFocus();
    fireEvent.click(button);
    expect(click).toHaveBeenCalled();
  });

  it("starts an empty room with a default name when no room name is provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: "/join/empty123?owner=1" }) });
    vi.stubGlobal("fetch", fetchMock);
    render();
    const button = screen.getByTestId("adhoc-start-room-button");
    fireEvent.click(button);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/join/empty123?owner=1"));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/adhoc-sessions");
    const body = JSON.parse(init.body);
    expect(body.fileName).toBe("New board.excalidraw");
    expect(JSON.parse(body.board)).toEqual({
      type: "excalidraw",
      version: 2,
      source: "sketchblock",
      elements: [],
      appState: { viewBackgroundColor: "#ffffff" },
      files: {},
    });
  });

  it("starts an empty room with a custom room name", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: "/join/empty456?owner=1" }) });
    vi.stubGlobal("fetch", fetchMock);
    render();
    const input = screen.getByPlaceholderText("New board") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "My Brainstorm" } });
    const button = screen.getByTestId("adhoc-start-room-button");
    fireEvent.click(button);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/join/empty456?owner=1"));
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.fileName).toBe("My Brainstorm.excalidraw");
  });

  it("starts an empty room on Enter key in the room name input", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: "/join/empty789?owner=1" }) });
    vi.stubGlobal("fetch", fetchMock);
    render();
    const input = screen.getByPlaceholderText("New board") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Quick Sketch" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/join/empty789?owner=1"));
  });
});
