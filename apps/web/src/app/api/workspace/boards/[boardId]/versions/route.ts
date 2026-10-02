import { NextResponse } from "next/server";

import { requireOwnerApiAuth } from "@/lib/server/auth/owner-session";
import {
  getWorkspaceBoardById,
  listWorkspaceBoardVersions,
} from "@/lib/server/database/workspace-board-store";
import { isBoardId, workspaceErrorResponse } from "@/lib/server/workspace/workspace-route";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ boardId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const auth = await requireOwnerApiAuth();
    if (auth.response || !auth.owner) {
      return auth.response;
    }
    const { boardId } = await context.params;
    if (!isBoardId(boardId)) return NextResponse.json({ error: "Board not found.", code: "not_found" }, { status: 404 });
    const board = await getWorkspaceBoardById(auth.owner.id, boardId);
    const versions = await listWorkspaceBoardVersions(auth.owner.id, boardId);
    return NextResponse.json({ currentRevision: board.revision, versions });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
