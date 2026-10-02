import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { safeRecordAuditEvent } from "@/lib/server/audit/audit-service";
import { requireOwnerApiAuth } from "@/lib/server/auth/owner-session";
import { rejectCrossOriginRequest } from "@/lib/server/auth/request-security";
import { updateCollabSessionStatus } from "@/lib/server/collab/collab-server-client";
import { deleteSession, listSessions } from "@/lib/server/database/session-store";
import {
  deleteWorkspaceBoard,
  getWorkspaceBoardById,
  renameWorkspaceBoard,
  revisionToSha,
} from "@/lib/server/database/workspace-board-store";
import { getRequestId } from "@/lib/server/logging/server-logger";
import { instanceRepositoryId } from "@/lib/server/workspace/instance-repository";
import { isBoardId, workspaceErrorResponse } from "@/lib/server/workspace/workspace-route";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ boardId: string }> };

const renameSchema = z.object({ title: z.string().trim().min(1).max(120) });

async function sessionsForBoard(userId: string, path: string) {
  const sessions = await listSessions(userId, instanceRepositoryId(userId));
  return sessions.filter((session) => session.drawingPath === path);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const originError = rejectCrossOriginRequest(request);
  if (originError) return originError;
  const requestId = getRequestId(request);
  try {
    const auth = await requireOwnerApiAuth();
    if (auth.response || !auth.owner) {
      return auth.response;
    }
    const { boardId } = await context.params;
    if (!isBoardId(boardId)) return NextResponse.json({ error: "Board not found.", code: "not_found" }, { status: 404 });
    const { title } = renameSchema.parse(await request.json().catch(() => null));
    const current = await getWorkspaceBoardById(auth.owner.id, boardId);
    // Renaming changes the board path, which live sessions refer to.
    if ((await sessionsForBoard(auth.owner.id, current.path)).length > 0) {
      return NextResponse.json(
        { error: "End the sessions of this board before renaming it.", code: "board_has_sessions" },
        { status: 409 },
      );
    }
    const board = await renameWorkspaceBoard(auth.owner.id, boardId, { title });
    await safeRecordAuditEvent({
      actorId: auth.owner.id,
      actorUsername: auth.owner.username,
      actorRole: auth.owner.role,
      action: "workspace.board.rename",
      targetType: "workspace_board",
      targetId: boardId,
      outcome: "success",
      requestId,
    });
    return NextResponse.json({
      board: { id: board.id, path: board.path, title: board.title, revision: board.revision, sha: revisionToSha(board.revision) },
    });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const originError = rejectCrossOriginRequest(request);
  if (originError) return originError;
  const requestId = getRequestId(request);
  try {
    const auth = await requireOwnerApiAuth();
    if (auth.response || !auth.owner) {
      return auth.response;
    }
    const { boardId } = await context.params;
    if (!isBoardId(boardId)) return NextResponse.json({ error: "Board not found.", code: "not_found" }, { status: 404 });
    const current = await getWorkspaceBoardById(auth.owner.id, boardId);
    // End the sessions of the board first.
    for (const session of await sessionsForBoard(auth.owner.id, current.path)) {
      try {
        await updateCollabSessionStatus({ sessionId: session.id, status: "closed", updatedBy: "web-api" });
      } catch {
        // The collab server being unreachable must not block deleting the board.
      }
      await deleteSession(session.id, auth.owner.id);
    }
    await deleteWorkspaceBoard(auth.owner.id, boardId);
    await safeRecordAuditEvent({
      actorId: auth.owner.id,
      actorUsername: auth.owner.username,
      actorRole: auth.owner.role,
      action: "workspace.board.delete",
      targetType: "workspace_board",
      targetId: boardId,
      outcome: "success",
      metadata: { path: current.path },
      requestId,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
