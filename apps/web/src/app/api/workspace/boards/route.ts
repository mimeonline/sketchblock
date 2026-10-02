import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { safeRecordAuditEvent } from "@/lib/server/audit/audit-service";
import { requireOwnerApiAuth } from "@/lib/server/auth/owner-session";
import { rejectCrossOriginRequest } from "@/lib/server/auth/request-security";
import { createWorkspaceBoard, revisionToSha } from "@/lib/server/database/workspace-board-store";
import { validateBoardUpload } from "@/lib/server/domain/validate-board-upload";
import { getRequestId } from "@/lib/server/logging/server-logger";
import { workspaceErrorResponse } from "@/lib/server/workspace/workspace-route";

export const runtime = "nodejs";

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  // Raw board JSON text (same contract as the ad-hoc upload).
  board: z.string().optional(),
});

const EMPTY_BOARD = {
  type: "excalidraw",
  version: 2,
  source: "sketchblock",
  elements: [],
  appState: {},
  files: {},
};

export async function POST(request: NextRequest) {
  const originError = rejectCrossOriginRequest(request);
  if (originError) return originError;
  const requestId = getRequestId(request);
  try {
    const auth = await requireOwnerApiAuth();
    if (auth.response || !auth.owner) {
      return auth.response;
    }
    const body = createSchema.parse(await request.json().catch(() => null));
    const content = body.board === undefined ? EMPTY_BOARD : validateBoardUpload(body.board);
    const board = await createWorkspaceBoard(auth.owner.id, {
      title: body.title,
      content,
      createdBy: auth.owner.id,
      message: body.board === undefined ? "Created" : "Uploaded",
    });
    await safeRecordAuditEvent({
      actorId: auth.owner.id,
      actorUsername: auth.owner.username,
      actorRole: auth.owner.role,
      action: "workspace.board.create",
      targetType: "workspace_board",
      targetId: board.id,
      outcome: "success",
      metadata: { path: board.path, uploaded: body.board !== undefined },
      requestId,
    });
    return NextResponse.json(
      { board: { id: board.id, path: board.path, title: board.title, revision: board.revision, sha: revisionToSha(board.revision) } },
      { status: 201 },
    );
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
