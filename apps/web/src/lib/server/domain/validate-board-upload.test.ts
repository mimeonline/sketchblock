import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  BoardUploadError,
  getMaxUploadBytes,
  validateBoardUpload,
} from "./validate-board-upload";

// Mock server-only for tests
vi.mock("server-only", () => ({}));

describe("validateBoardUpload", () => {
  beforeEach(() => {
    // Clear env var before each test
    delete process.env.SKETCHBLOCK_MAX_UPLOAD_BYTES;
  });

  describe("getMaxUploadBytes", () => {
    it("returns default 10_000_000 when env var is not set", () => {
      expect(getMaxUploadBytes()).toBe(10_000_000);
    });

    it("returns custom value from env var when valid positive integer", () => {
      process.env.SKETCHBLOCK_MAX_UPLOAD_BYTES = "5000000";
      expect(getMaxUploadBytes()).toBe(5_000_000);
    });

    it("returns default when env var is not a valid positive integer", () => {
      process.env.SKETCHBLOCK_MAX_UPLOAD_BYTES = "invalid";
      expect(getMaxUploadBytes()).toBe(10_000_000);

      process.env.SKETCHBLOCK_MAX_UPLOAD_BYTES = "-1000";
      expect(getMaxUploadBytes()).toBe(10_000_000);
    });
  });

  it("accepts valid minimal board", () => {
    const board = {
      type: "excalidraw",
      elements: [
        { id: "elem1", type: "rectangle" },
        { id: "elem2", type: "text" },
      ],
    };
    const result = validateBoardUpload(JSON.stringify(board));
    expect(result.type).toBe("excalidraw");
    expect(result.source).toBe("sketchblock-upload");
    expect(result.elements).toHaveLength(2);
  });

  it("accepts empty board with no elements", () => {
    const board = {
      type: "excalidraw",
      version: 2,
      source: "sketchblock",
      elements: [],
      appState: { viewBackgroundColor: "#ffffff" },
      files: {},
    };
    const result = validateBoardUpload(JSON.stringify(board));
    expect(result.type).toBe("excalidraw");
    expect(result.elements).toHaveLength(0);
    expect(result.appState?.viewBackgroundColor).toBe("#ffffff");
    expect(result.version).toBe(2);
  });

  it("accepts board with version and preserves it", () => {
    const board = {
      type: "excalidraw",
      version: 42,
      elements: [{ id: "elem1", type: "rectangle" }],
    };
    const result = validateBoardUpload(JSON.stringify(board));
    expect(result.version).toBe(42);
  });

  it("rejects board exceeding max upload size", () => {
    process.env.SKETCHBLOCK_MAX_UPLOAD_BYTES = "100";
    const board = {
      type: "excalidraw",
      elements: [{ id: "x".repeat(200), type: "rectangle" }],
    };
    const raw = JSON.stringify(board);
    expect(() => validateBoardUpload(raw)).toThrow(BoardUploadError);
    try {
      validateBoardUpload(raw);
    } catch (error) {
      if (error instanceof BoardUploadError) {
        expect(error.code).toBe("too_large");
      }
    }
  });

  it("rejects invalid JSON", () => {
    const invalidJson = '{type: "excalidraw"';
    expect(() => validateBoardUpload(invalidJson)).toThrow(BoardUploadError);
    try {
      validateBoardUpload(invalidJson);
    } catch (error) {
      if (error instanceof BoardUploadError) {
        expect(error.code).toBe("invalid_json");
      }
    }
  });

  it("rejects board with wrong type", () => {
    const board = {
      type: "not-excalidraw",
      elements: [{ id: "elem1", type: "rectangle" }],
    };
    expect(() => validateBoardUpload(JSON.stringify(board))).toThrow(BoardUploadError);
    try {
      validateBoardUpload(JSON.stringify(board));
    } catch (error) {
      if (error instanceof BoardUploadError) {
        expect(error.code).toBe("invalid_board");
      }
    }
  });

  it("rejects board with too many elements", () => {
    const elements = Array.from({ length: 20_001 }, (_, i) => ({
      id: `elem${i}`,
      type: "rectangle",
    }));
    const board = {
      type: "excalidraw",
      elements,
    };
    expect(() => validateBoardUpload(JSON.stringify(board))).toThrow(BoardUploadError);
    try {
      validateBoardUpload(JSON.stringify(board));
    } catch (error) {
      if (error instanceof BoardUploadError) {
        expect(error.code).toBe("too_many_elements");
      }
    }
  });

  it("rejects file with invalid mime type", () => {
    const board = {
      type: "excalidraw",
      elements: [{ id: "elem1", type: "rectangle" }],
      files: {
        file1: {
          id: "file1",
          mimeType: "application/pdf",
          dataURL: "data:application/pdf;base64,abc123",
        },
      },
    };
    expect(() => validateBoardUpload(JSON.stringify(board))).toThrow(BoardUploadError);
    try {
      validateBoardUpload(JSON.stringify(board));
    } catch (error) {
      if (error instanceof BoardUploadError) {
        expect(error.code).toBe("invalid_board");
      }
    }
  });

  it("rejects file with invalid dataURL format", () => {
    const board = {
      type: "excalidraw",
      elements: [{ id: "elem1", type: "rectangle" }],
      files: {
        file1: {
          id: "file1",
          mimeType: "image/png",
          dataURL: "not-a-data-url",
        },
      },
    };
    expect(() => validateBoardUpload(JSON.stringify(board))).toThrow(BoardUploadError);
    try {
      validateBoardUpload(JSON.stringify(board));
    } catch (error) {
      if (error instanceof BoardUploadError) {
        expect(error.code).toBe("invalid_file");
      }
    }
  });

  it("accepts file with correct mime type and dataURL", () => {
    const board = {
      type: "excalidraw",
      elements: [{ id: "elem1", type: "rectangle" }],
      files: {
        file1: {
          id: "file1",
          mimeType: "image/png",
          dataURL: "data:image/png;base64,iVBORw0KGgo=",
        },
      },
    };
    const result = validateBoardUpload(JSON.stringify(board));
    expect(result.files).toBeDefined();
    expect(result.files?.file1).toBeDefined();
  });

  it("strips unknown top-level keys", () => {
    const board = {
      type: "excalidraw",
      elements: [{ id: "elem1", type: "rectangle" }],
      unknownKey: "should be removed",
      anotherUnknown: 123,
    };
    const result = validateBoardUpload(JSON.stringify(board));
    expect(result).not.toHaveProperty("unknownKey");
    expect(result).not.toHaveProperty("anotherUnknown");
    expect(result.type).toBe("excalidraw");
  });

  it("filters appState to only allowed keys", () => {
    const board = {
      type: "excalidraw",
      elements: [{ id: "elem1", type: "rectangle" }],
      appState: {
        viewBackgroundColor: "#ffffff",
        gridSize: 20,
        name: "My Drawing",
        currentItemStrokeColor: "#000000",
        currentItemBackgroundColor: "#ffff00",
        unknownAppStateKey: "should be removed",
        scrollX: 100,
      },
    };
    const result = validateBoardUpload(JSON.stringify(board));
    expect(result.appState).toBeDefined();
    expect(result.appState?.viewBackgroundColor).toBe("#ffffff");
    expect(result.appState?.gridSize).toBe(20);
    expect(result.appState?.name).toBe("My Drawing");
    expect(result.appState?.currentItemStrokeColor).toBe("#000000");
    expect(result.appState?.currentItemBackgroundColor).toBe("#ffff00");
    expect(result.appState).not.toHaveProperty("unknownAppStateKey");
    expect(result.appState).not.toHaveProperty("scrollX");
  });

  it("omits appState if empty after filtering", () => {
    const board = {
      type: "excalidraw",
      elements: [{ id: "elem1", type: "rectangle" }],
      appState: {
        unknownKey: "value",
      },
    };
    const result = validateBoardUpload(JSON.stringify(board));
    expect(result.appState).toBeUndefined();
  });

  it("returns normalized result with source override", () => {
    const board = {
      type: "excalidraw",
      source: "original-source",
      version: 3,
      elements: [{ id: "elem1", type: "rectangle" }],
    };
    const result = validateBoardUpload(JSON.stringify(board));
    expect(result.source).toBe("sketchblock-upload");
    expect(result.version).toBe(3);
  });

  it("rejects element with id exceeding 120 chars", () => {
    const board = {
      type: "excalidraw",
      elements: [
        {
          id: "x".repeat(121),
          type: "rectangle",
        },
      ],
    };
    expect(() => validateBoardUpload(JSON.stringify(board))).toThrow(BoardUploadError);
    try {
      validateBoardUpload(JSON.stringify(board));
    } catch (error) {
      if (error instanceof BoardUploadError) {
        expect(error.code).toBe("invalid_board");
      }
    }
  });

  it("accepts element with id of exactly 120 chars", () => {
    const board = {
      type: "excalidraw",
      elements: [
        {
          id: "x".repeat(120),
          type: "rectangle",
        },
      ],
    };
    const result = validateBoardUpload(JSON.stringify(board));
    expect(result.elements[0].id).toHaveLength(120);
  });

  it("keeps all element properties needed to render the board", () => {
    const board = validateBoardUpload(JSON.stringify({
      type: "excalidraw",
      elements: [{ id: "t1", type: "text", x: 10, y: 20, text: "Hello", fontSize: 28, version: 3 }],
    }));
    expect(board.elements[0]).toMatchObject({ id: "t1", type: "text", x: 10, y: 20, text: "Hello", fontSize: 28, version: 3 });
  });
});
