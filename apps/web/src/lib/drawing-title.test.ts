import { describe, expect, it } from "vitest";

import { drawingTitle } from "./drawing-title";

describe("drawingTitle", () => {
  it("derives a capitalized title from the file name", () => {
    expect(drawingTitle("demo/getting-started.excalidraw")).toBe("Getting started");
    expect(drawingTitle("boards/team_plan.excalidraw")).toBe("Team plan");
  });

  it("falls back for empty names", () => {
    expect(drawingTitle(".excalidraw", "Untitled")).toBe("Untitled");
  });
});
