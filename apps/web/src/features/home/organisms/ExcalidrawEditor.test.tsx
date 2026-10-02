import { useEffect, useState } from "react";
import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiCallbackCalls: 0,
  scrollToContent: vi.fn(),
  updateScene: vi.fn(),
}));

vi.mock("@excalidraw/excalidraw", () => ({ restoreElements: (elements: unknown[]) => elements }));

vi.mock("next/dynamic", () => ({
  default: () =>
    function MockExcalidraw({
      excalidrawAPI,
      onChange,
      viewModeEnabled,
    }: {
      excalidrawAPI: (api: object) => void;
      onChange?: (elements: unknown[], appState: object, files: object) => void;
      viewModeEnabled?: boolean;
    }) {
      useEffect(() => {
        mocks.apiCallbackCalls += 1;
        excalidrawAPI({
          addFiles: vi.fn(),
          getSceneElements: () => [],
          updateScene: mocks.updateScene,
          scrollToContent: mocks.scrollToContent,
        });
      }, [excalidrawAPI]);

      return (
        <button type="button" data-read-only={viewModeEnabled} onClick={() => onChange?.([], {}, {})}>
          Mock Excalidraw
        </button>
      );
    },
}));

vi.mock("@/features/home/hooks/useExcalidrawYjs", () => ({
  useExcalidrawYjs: () => ({
    applyLocalScene: vi.fn(),
    isApplyingRemoteRef: { current: false },
  }),
}));

import { ExcalidrawEditor } from "./ExcalidrawEditor";
import messages from "../../../../messages/de.json";

function render(ui: React.ReactNode) {
  return rtlRender(<NextIntlClientProvider locale="de" messages={messages}>{ui}</NextIntlClientProvider>);
}

describe("ExcalidrawEditor", () => {
  afterEach(() => {
    cleanup();
    mocks.apiCallbackCalls = 0;
    vi.clearAllMocks();
  });

  it("keeps the Excalidraw API callback stable across its state update", () => {
    render(<ExcalidrawEditor initialContent={{ elements: [] }} />);

    expect(screen.getByText("Mock Excalidraw")).toBeInTheDocument();
    expect(mocks.apiCallbackCalls).toBe(1);
  });

  it("reports dirty only once across parent rerenders", () => {
    const onDirty = vi.fn();

    function EditorHarness() {
      const [, setRenderCount] = useState(0);

      return (
        <ExcalidrawEditor
          onDirty={() => {
            onDirty();
            setRenderCount((current) => current + 1);
          }}
        />
      );
    }

    render(<EditorHarness />);
    const canvas = screen.getByText("Mock Excalidraw");
    fireEvent.pointerDown(canvas);
    fireEvent.click(canvas);
    fireEvent.click(canvas);

    expect(onDirty).toHaveBeenCalledTimes(1);
  });

  it("fits an existing board on load and provides an explicit fit action", async () => {
    render(<ExcalidrawEditor initialContent={{ elements: [{ id: "shape" }] }} />);
    await waitFor(() => expect(mocks.scrollToContent).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: messages.Editor.fitBoard }));
    expect(mocks.scrollToContent).toHaveBeenCalledTimes(2);
    expect(mocks.scrollToContent).toHaveBeenLastCalledWith(undefined, { fitToContent: true, maxZoom: 1, animate: false });
  });

  it("isolates fullscreen, closes with Escape and restores keyboard focus", () => {
    render(<><button>Outside</button><ExcalidrawEditor /></>);
    const toggle = screen.getByRole("button", { name: messages.Editor.enterFullscreen });
    toggle.focus();
    fireEvent.click(toggle);
    expect(screen.getByRole("dialog", { name: messages.Editor.fullscreenBoard })).toBeInTheDocument();
    expect(screen.getByText("Outside")).toHaveAttribute("inert");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Outside")).not.toHaveAttribute("inert");
    expect(toggle).toHaveFocus();
  });

  it("labels demo saves honestly and keeps failed saves visible", async () => {
    const save = vi.fn().mockRejectedValue(new Error("offline"));
    render(<ExcalidrawEditor demoMode onSave={save} />);
    expect(screen.queryByRole("button", { name: messages.Editor.saveGitHub })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: messages.Editor.saveDemo }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(messages.Editor.saveFailed));
    expect(screen.getByRole("button", { name: messages.Editor.saveDemo })).toBeEnabled();
  });

  it("never exposes owner saving to a viewer", () => {
    render(<ExcalidrawEditor mode="guest" readOnly onSave={vi.fn()} />);
    expect(screen.queryByRole("button", { name: messages.Editor.saveGitHub })).not.toBeInTheDocument();
    expect(screen.getByText(messages.Editor.viewerHint)).toBeInTheDocument();
    expect(screen.getByText("Mock Excalidraw")).toHaveAttribute("data-read-only", "true");
  });

  it("does not replace a live Yjs document with a checkpoint snapshot", () => {
    render(<ExcalidrawEditor remoteContent={{ elements: [{ id: "stale" }] }} remoteRevision={2} yjsSync={{ sessionId: "s", clientId: "c", enabled: true, canSeed: false, onSendUpdate: vi.fn() }} />);
    expect(mocks.updateScene.mock.calls.some(([scene]) => "elements" in scene)).toBe(false);
  });
});
