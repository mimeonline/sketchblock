import { describe, expect, it } from "vitest";
import { resolveBoardPath } from "./board-selection";

describe("board selection within repository context", () => {
  it("keeps a requested board when it belongs to the loaded repository", () => {
    expect(resolveBoardPath([{ path: "first.excalidraw" }, { path: "second.excalidraw" }], "second.excalidraw")).toBe("second.excalidraw");
  });
  it("leaves an explicitly requested missing board unselected", () => {
    expect(resolveBoardPath([{ path: "new-repository.excalidraw" }], "old-repository.excalidraw")).toBe("");
  });
  it("defaults to the first board after the repository switch deliberately clears selection", () => {
    expect(resolveBoardPath([{ path: "new-repository.excalidraw" }], "")).toBe("new-repository.excalidraw");
  });
  it("clears selection when the new context contains no boards", () => {
    expect(resolveBoardPath([], "old-repository.excalidraw")).toBe("");
  });
});
