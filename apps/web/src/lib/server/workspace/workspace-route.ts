import "server-only";

import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { StorageConflictError } from "@/lib/server/application/storage-errors";
import { BoardUploadError } from "@/lib/server/domain/validate-board-upload";
import {
  WorkspaceBoardExistsError,
  WorkspaceBoardNotFoundError,
} from "@/lib/server/database/workspace-board-store";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isBoardId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function workspaceErrorResponse(error: unknown): NextResponse {
  if (error instanceof BoardUploadError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
  }
  if (error instanceof WorkspaceBoardNotFoundError) {
    return NextResponse.json({ error: error.message, code: "not_found" }, { status: 404 });
  }
  if (error instanceof WorkspaceBoardExistsError) {
    return NextResponse.json({ error: error.message, code: "exists" }, { status: 409 });
  }
  if (error instanceof StorageConflictError) {
    return NextResponse.json({ error: error.message, code: "storage_conflict" }, { status: 409 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Invalid request body.", code: "invalid_request" }, { status: 400 });
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Unknown error" },
    { status: 500 },
  );
}
