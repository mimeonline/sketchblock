import "server-only";

import { z } from "zod";

export class BoardUploadError extends Error {
  constructor(
    readonly code:
      | "too_large"
      | "invalid_json"
      | "invalid_board"
      | "too_many_elements"
      | "invalid_file",
    message: string
  ) {
    super(message);
    this.name = "BoardUploadError";
  }
}

export function getMaxUploadBytes(): number {
  const env = process.env.SKETCHBLOCK_MAX_UPLOAD_BYTES;
  if (env) {
    const value = parseInt(env, 10);
    if (!Number.isNaN(value) && value > 0) {
      return value;
    }
  }
  return 10_000_000;
}

export interface ExcalidrawBoard {
  type: "excalidraw";
  version?: number;
  source?: string;
  elements: Array<{ id: string; type: string; [key: string]: unknown }>;
  appState?: {
    viewBackgroundColor?: string;
    gridSize?: number;
    name?: string;
    currentItemStrokeColor?: string;
    currentItemBackgroundColor?: string;
    [key: string]: unknown;
  };
  files?: Record<
    string,
    {
      id: string;
      mimeType: string;
      dataURL: string;
      [key: string]: unknown;
    }
  >;
}

const appStateSchema = z
  .object({
    viewBackgroundColor: z.string().optional(),
    gridSize: z.number().optional(),
    name: z.string().optional(),
    currentItemStrokeColor: z.string().optional(),
    currentItemBackgroundColor: z.string().optional(),
  })
  .passthrough();

const fileSchema = z.object({
  id: z.string(),
  mimeType: z.enum([
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ]),
  dataURL: z.string(),
});

const boardSchema = z.object({
  type: z.literal("excalidraw"),
  version: z.number().optional(),
  source: z.string().optional(),
  elements: z.array(
    // Keep all Excalidraw element properties; only identity fields are checked here.
    z.looseObject({
      id: z.string().max(120),
      type: z.string(),
    })
  ),
  appState: appStateSchema.optional(),
  files: z.record(z.string(), fileSchema).optional(),
});

export function validateBoardUpload(raw: string): ExcalidrawBoard {
  // Check size first
  if (Buffer.byteLength(raw) > getMaxUploadBytes()) {
    throw new BoardUploadError("too_large", "Board upload exceeds maximum size");
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new BoardUploadError(
      "invalid_json",
      `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Validate against schema
  let validated: unknown;
  try {
    validated = boardSchema.parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message =
        error.issues && error.issues.length > 0
          ? error.issues[0].message
          : "unknown error";
      throw new BoardUploadError("invalid_board", `Invalid board structure: ${message}`);
    }
    throw new BoardUploadError("invalid_board", `Validation failed: ${String(error)}`);
  }

  // Ensure it's properly typed
  const board = validated as unknown as ExcalidrawBoard;

  // Check element count
  if (board.elements.length > 20_000) {
    throw new BoardUploadError(
      "too_many_elements",
      `Board has ${board.elements.length} elements, maximum is 20000`
    );
  }

  // Validate files dataURL format
  if (board.files) {
    for (const [, file] of Object.entries(board.files)) {
      const expectedPrefix = `data:${file.mimeType};base64,`;
      if (!file.dataURL.startsWith(expectedPrefix)) {
        throw new BoardUploadError(
          "invalid_file",
          `Invalid data URL format for file ${file.id}`
        );
      }
    }
  }

  // Filter appState to only allowed keys
  const filteredAppState = board.appState
    ? {
        ...(board.appState.viewBackgroundColor !== undefined && {
          viewBackgroundColor: board.appState.viewBackgroundColor,
        }),
        ...(board.appState.gridSize !== undefined && {
          gridSize: board.appState.gridSize,
        }),
        ...(board.appState.name !== undefined && { name: board.appState.name }),
        ...(board.appState.currentItemStrokeColor !== undefined && {
          currentItemStrokeColor: board.appState.currentItemStrokeColor,
        }),
        ...(board.appState.currentItemBackgroundColor !== undefined && {
          currentItemBackgroundColor: board.appState.currentItemBackgroundColor,
        }),
      }
    : undefined;

  // Only include appState if it has at least one key
  const hasAppState =
    filteredAppState && Object.keys(filteredAppState).length > 0;

  return {
    type: "excalidraw",
    ...(board.version !== undefined && { version: board.version }),
    source: "sketchblock-upload",
    elements: board.elements,
    ...(hasAppState && { appState: filteredAppState }),
    ...(board.files && { files: board.files }),
  };
}
