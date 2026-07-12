import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import * as Y from "yjs";

import { useExcalidrawYjs } from "./useExcalidrawYjs";

const element = {
  id: "element-1",
  type: "rectangle",
  version: 1,
  versionNonce: 42,
  index: "a0",
} as const;

function encodeState(initialize: (doc: Y.Doc) => void) {
  const doc = new Y.Doc();
  initialize(doc);
  const update = Y.encodeStateAsUpdate(doc);
  let binary = "";

  for (const byte of update) {
    binary += String.fromCharCode(byte);
  }

  doc.destroy();
  return window.btoa(binary);
}

function renderYjsHook(initialStateBase64: string, onSendUpdate = vi.fn()) {
  const updateScene = vi.fn();
  const api = { updateScene } as unknown as ExcalidrawImperativeAPI;

  const hook = renderHook(() =>
    useExcalidrawYjs({
      sessionId: "session-1",
      clientId: "client-1",
      enabled: true,
      readOnly: false,
      canSeed: false,
      api,
      initialContent: { elements: [element] },
      initialStateBase64,
      onSendUpdate,
    }),
  );

  return { ...hook, onSendUpdate, updateScene };
}

describe("useExcalidrawYjs", () => {
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("keeps the loaded snapshot when Yjs contains metadata but no elements", () => {
    const initialState = encodeState((doc) => {
      doc.getMap("sketchblock").set("snapshot", { revision: 1 });
    });

    const { updateScene } = renderYjsHook(initialState);

    expect(updateScene).not.toHaveBeenCalled();
  });

  it("applies a populated Yjs element map", async () => {
    const initialState = encodeState((doc) => {
      doc.getMap("elements").set(element.id, element);
    });

    const { updateScene } = renderYjsHook(initialState);

    await waitFor(() => {
      expect(updateScene).toHaveBeenCalledWith({
        elements: [element],
        captureUpdate: "NEVER",
      });
    });
  });

  it("does not broadcast unchanged element versions", () => {
    const initialState = encodeState((doc) => {
      doc.getMap("elements").set(element.id, element);
    });
    const onSendUpdate = vi.fn();
    const { result } = renderYjsHook(initialState, onSendUpdate);

    act(() => {
      result.current.applyLocalScene([element] as never[]);
    });

    expect(onSendUpdate).not.toHaveBeenCalled();
  });

  it("broadcasts changed elements within the realtime batching window", async () => {
    vi.useFakeTimers();
    const initialState = encodeState((doc) => {
      doc.getMap("elements").set(element.id, element);
    });
    const onSendUpdate = vi.fn();
    const { result } = renderYjsHook(initialState, onSendUpdate);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120);
    });

    act(() => {
      result.current.applyLocalScene([{ ...element, version: 2 }] as never[]);
    });
    expect(onSendUpdate).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(onSendUpdate).toHaveBeenCalledTimes(1);
  });
});
