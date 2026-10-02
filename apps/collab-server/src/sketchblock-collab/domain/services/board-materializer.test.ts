import { materializeBoardContent } from "./board-materializer.js";

describe("materializeBoardContent", () => {
  it("keeps the checkpoint when the live document has no elements", () => {
    const checkpoint = { elements: [{ id: "a" }], appState: { gridSize: 20 } };
    expect(materializeBoardContent(checkpoint, [])).toBe(checkpoint);
  });

  it("uses live elements in fractional index order and keeps app state and files", () => {
    const checkpoint = { type: "excalidraw", elements: [{ id: "stale" }], appState: { gridSize: 20 }, files: { f1: { id: "f1" } } };
    const result = materializeBoardContent(checkpoint, [
      { id: "b", index: "a1" },
      { id: "a", index: "Zz" },
      { id: "c", index: "a0" },
    ]) as { elements: { id: string }[]; appState: unknown; files: unknown };

    expect(result.elements.map((element) => element.id)).toEqual(["a", "c", "b"]);
    expect(result.appState).toEqual({ gridSize: 20 });
    expect(result.files).toEqual({ f1: { id: "f1" } });
  });
});
