import { NextRequest, NextResponse } from "next/server";

import { safeRecordAuditEvent } from "@/lib/server/audit/audit-service";
import { requireOwnerApiAuth } from "@/lib/server/auth/owner-session";
import { rejectCrossOriginRequest } from "@/lib/server/auth/request-security";
import { restoreWorkspaceBoardVersion, revisionToSha } from "@/lib/server/database/workspace-board-store";
import { getRequestId } from "@/lib/server/logging/server-logger";
import { isBoardId, workspaceErrorResponse } from "@/lib/server/workspace/workspace-route";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ boardId: string; revision: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const originError = rejectCrossOriginRequest(request);
  if (originError) return originError;
  const requestId = getRequestId(request);
  try {
    const auth = await requireOwnerApiAuth();
    if (auth.response || !auth.owner) {
      return auth.response;
    }
    const { boardId, revision: revisionParam } = await context.params;
    const revision = Number(revisionParam);
    if (!isBoardId(boardId) || !Number.isInteger(revision) || revision < 1) {
      return NextResponse.json({ error: "Version not found.", code: "not_found" }, { status: 404 });
    }
    const restored = await restoreWorkspaceBoardVersion(auth.owner.id, boardId, revision, auth.owner.id);
    await safeRecordAuditEvent({
      actorId: auth.owner.id,
      actorUsername: auth.owner.username,
      actorRole: auth.owner.role,
      action: "workspace.board.restore",
      targetType: "workspace_board",
      targetId: boardId,
      outcome: "success",
      metadata: { restoredRevision: revision, newRevision: restored.revision },
      requestId,
    });
    return NextResponse.json({
      board: { id: boardId, path: restored.path, revision: restored.revision, sha: revisionToSha(restored.revision) },
    });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
