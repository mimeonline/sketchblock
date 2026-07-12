import { NextResponse } from "next/server";
import { safeRecordAuditEvent } from "@/lib/server/audit/audit-service";
import { getRequestId } from "@/lib/server/logging/server-logger";

import { openDrawing, saveDrawing } from "@/lib/server/application/drawing-use-cases";
import { requireLinkedOwnerGitHub, requireOwnerApiAuth } from "@/lib/server/auth/owner-session";
import { getCollabSessionSnapshot, updateCollabSessionStatus } from "@/lib/server/collab/collab-server-client";
import { getOwnedSession, updateSessionStatus, upsertSessionSnapshot } from "@/lib/server/database/session-store";
import { requireOwnedRepositoryById, requireRepositoryById } from "@/lib/server/database/repository-store";
import { GitHubApiError } from "@/lib/server/github/github-repository-adapter";

export const runtime = "nodejs";

type SessionSaveRouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

export async function POST(_request: Request, { params }: SessionSaveRouteContext) {
  const requestId = getRequestId(_request);
  try {
    const auth = await requireOwnerApiAuth();
    if (auth.response || !auth.owner) {
      return auth.response;
    }
    requireLinkedOwnerGitHub(auth.owner);

    const { sessionId } = await params;
    const userId = auth.owner.id === "dev-owner" ? null : auth.owner.id;
    const session = await getOwnedSession(sessionId, userId);

    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const collabState = await getCollabSessionSnapshot(sessionId);
    if (!collabState.snapshot) {
      return NextResponse.json({ error: "Session has no snapshot to save." }, { status: 400 });
    }

    const repository = userId
      ? await requireOwnedRepositoryById(session.repositoryId, userId)
      : await requireRepositoryById(session.repositoryId);
    const currentDrawing = await openDrawing(repository, session.drawingPath);
    const result = await saveDrawing(repository, {
      path: session.drawingPath,
      sha: currentDrawing.sha,
      content: collabState.snapshot.content,
      message: `Save ${session.drawingPath} from Sketchblock session ${session.id}`,
    });
    await updateCollabSessionStatus({
      sessionId,
      status: "saved",
      updatedBy: "web-api",
    });
    await upsertSessionSnapshot({
      sessionId,
      drawingPath: session.drawingPath,
      content: collabState.snapshot.content,
      revision: collabState.snapshot.revision,
      updatedBy: "web-api",
    });
    await updateSessionStatus(sessionId, "saved", userId);
    await safeRecordAuditEvent({ actorId: auth.owner.id, actorUsername: auth.owner.username, actorRole: auth.owner.role, action: "board.save", targetType: "drawing", targetId: session.drawingPath, outcome: "success", metadata: { commitSha: result.commitSha, sessionId }, requestId, sessionId });

    return NextResponse.json({
      result: {
        ...result,
        snapshotRevision: collabState.snapshot.revision,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: error instanceof GitHubApiError && error.status === 409 ? 409 : 400 },
    );
  }
}
