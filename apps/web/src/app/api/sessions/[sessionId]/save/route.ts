import { NextResponse } from "next/server";
import { rejectCrossOriginRequest } from "@/lib/server/auth/request-security";
import { safeRecordAuditEvent } from "@/lib/server/audit/audit-service";
import { getRequestId } from "@/lib/server/logging/server-logger";

import { openDrawing, saveDrawing } from "@/lib/server/application/drawing-use-cases";
import { requireOwnerApiAuth } from "@/lib/server/auth/owner-session";
import { getCollabSessionSnapshot, updateCollabSessionStatus } from "@/lib/server/collab/collab-server-client";
import { getOwnedSession, updateSessionBaseSha, updateSessionStatus, upsertSessionSnapshot } from "@/lib/server/database/session-store";
import { requireOwnedRepositoryById, requireRepositoryById } from "@/lib/server/database/repository-store";
import { StorageConflictError } from "@/lib/server/application/storage-errors";

import { requireGitHubForRepository } from "@/lib/server/workspace/github-requirement";
import { isRepositorySession } from "@/lib/server/domain/session-lifecycle";

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
    const { sessionId } = await params;
    const userId = auth.owner.id === "dev-owner" ? null : auth.owner.id;
    const session = await getOwnedSession(sessionId, userId);

    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    if (!isRepositorySession(session)) {
      return NextResponse.json(
        { error: "Ad-hoc rooms are not saved to GitHub. Download the board instead.", code: "adhoc_not_persisted" },
        { status: 409 },
      );
    }

    const collabState = await getCollabSessionSnapshot(sessionId);
    if (!collabState.snapshot) {
      return NextResponse.json({ error: "Session has no snapshot to save." }, { status: 400 });
    }
    // The live collaborative document is authoritative for elements; the checkpoint
    // contributes app state and binary files.
    const boardContent = collabState.materializedContent ?? collabState.snapshot.content;

    const repository = userId
      ? await requireOwnedRepositoryById(session.repositoryId, userId)
      : await requireRepositoryById(session.repositoryId);
    requireGitHubForRepository(auth.owner, repository);
    // Use the sha recorded at session start so GitHub's optimistic locking detects
    // changes committed meanwhile; only legacy sessions fall back to the current sha.
    const baseSha = session.baseSha ?? (await openDrawing(repository, session.drawingPath)).sha;
    const result = await saveDrawing(repository, {
      path: session.drawingPath,
      sha: baseSha,
      content: boardContent,
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
      content: boardContent,
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
    if (error instanceof StorageConflictError) {
      return NextResponse.json(
        {
          error: "The board was changed after this session started. Reload the board in a new session or save the session content manually.",
          code: "storage_conflict",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 },
    );
  }
}
