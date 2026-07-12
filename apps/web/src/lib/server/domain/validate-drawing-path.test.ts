import { describe, expect, it } from "vitest";

import { validateDrawingPath } from "./validate-drawing-path";

describe("validateDrawingPath", () => {
  it("accepts relative Excalidraw files", () => {
    expect(validateDrawingPath("boards/workshop.excalidraw")).toBe("boards/workshop.excalidraw");
  });

  it("rejects unsupported file types", () => {
    expect(() => validateDrawingPath("boards/workshop.md")).toThrow("Only .excalidraw files are supported");
  });

  it("rejects absolute paths and traversal", () => {
    expect(() => validateDrawingPath("/tmp/workshop.excalidraw")).toThrow("Invalid drawing path");
    expect(() => validateDrawingPath("../workshop.excalidraw")).toThrow("Invalid drawing path");
  });
});
