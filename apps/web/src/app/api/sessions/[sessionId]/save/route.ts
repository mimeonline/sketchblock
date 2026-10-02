import { NextResponse } from "next/server";
import { rejectCrossOriginRequest } from "@/lib/server/auth/request-security";
import { safeRecordAuditEvent } from "@/lib/server/audit/audit-service";
import { getRequestId } from "@/lib/server/logging/server-logger";

import { openDrawing, saveDrawing } from "@/lib/server/application/drawing-use-cases";
import { requireLinkedOwnerGitHub, requireOwnerApiAuth } from "@/lib/server/auth/owner-session";
import { getCollabSessionSnapshot, updateCollabSessionStatus } from "@/lib/server/collab/collab-server-client";
import { getOwnedSession, updateSessionBaseSha, updateSessionStatus, upsertSessionSnapshot } from "@/lib/server/database/session-store";
import { requireOwnedRepositoryById, requireRepositoryById } from "@/lib/server/database/repository-store";
import { GitHubApiError } from "@/lib/server/github/github-repository-adapter";

export const runtime = "nodejs";

type SessionSaveRouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

export async function POST(request: Request, { params }: SessionSaveRouteContext) {
  const originError = rejectCrossOriginRequest(request);
  if (originError) return originError;
  const requestId = getRequestId(request);
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
    // Use the sha recorded at session start so GitHub's optimistic locking detects
    // changes committed meanwhile; only legacy sessions fall back to the current sha.
    const baseSha = session.baseSha ?? (await openDrawing(repository, session.drawingPath)).sha;
    const result = await saveDrawing(repository, {
      path: session.drawingPath,
      sha: baseSha,
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
    await updateSessionBaseSha(sessionId, result.contentSha, userId);
    await updateSessionStatus(sessionId, "saved", userId);
    await safeRecordAuditEvent({ actorId: auth.owner.id, actorUsername: auth.owner.username, actorRole: auth.owner.role, action: "board.save", targetType: "drawing", targetId: session.drawingPath, outcome: "success", metadata: { commitSha: result.commitSha, sessionId }, requestId, sessionId });

    return NextResponse.json({
      result: {
        ...result,
        snapshotRevision: collabState.snapshot.revision,
      },
    });
  } catch (error) {
    if (error instanceof GitHubApiError && (error.status === 409 || error.status === 422)) {
      return NextResponse.json(
        {
          error: "The board was changed in GitHub after this session started. Reload the board in a new session or save the session content manually.",
          code: "github_conflict",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: error instanceof GitHubApiError && error.status === 409 ? 409 : 400 },
    );
  }
}
