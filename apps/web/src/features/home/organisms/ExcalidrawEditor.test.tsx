import { useEffect, useState } from "react";
import { cleanup, fireEvent, render as rtlRender, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiCallbackCalls: 0,
}));

vi.mock("next/dynamic", () => ({
  default: () =>
    function MockExcalidraw({
      excalidrawAPI,
      onChange,
    }: {
      excalidrawAPI: (api: object) => void;
      onChange?: (elements: unknown[], appState: object, files: object) => void;
    }) {
      useEffect(() => {
        mocks.apiCallbackCalls += 1;
        excalidrawAPI({
          addFiles: vi.fn(),
          getSceneElements: () => [],
          updateScene: vi.fn(),
        });
      }, [excalidrawAPI]);

      return (
        <button type="button" onClick={() => onChange?.([], {}, {})}>
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
});
