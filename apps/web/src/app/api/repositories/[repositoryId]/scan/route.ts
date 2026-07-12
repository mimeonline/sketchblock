import { NextRequest, NextResponse } from "next/server";

import { safeRecordAuditEvent } from "@/lib/server/audit/audit-service";
import { requireOwnerApiAuth } from "@/lib/server/auth/owner-session";
import {
  requireOwnedRepositoryById,
  updateOwnedRepositoryScan,
} from "@/lib/server/database/repository-store";
import { getWritableGitHubRepository, scanGitHubRepository } from "@/lib/server/github/github-repository-adapter";
import { getRequestId, withRequestId } from "@/lib/server/logging/server-logger";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ repositoryId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request);
  try {
    const auth = await requireOwnerApiAuth();
    if (auth.response) {
      return withRequestId(auth.response, requestId);
    }
    if (!auth.owner) {
      return withRequestId(NextResponse.json({ error: "Login required." }, { status: 401 }), requestId);
    }
    const { repositoryId } = await context.params;
    const connectedRepository = await requireOwnedRepositoryById(repositoryId, auth.owner.id);
    const githubRepository = await getWritableGitHubRepository(connectedRepository.githubRepositoryId);
    const result = await scanGitHubRepository(githubRepository);
    const repository = await updateOwnedRepositoryScan(auth.owner.id, result.repository);
    await safeRecordAuditEvent({
      actorId: auth.owner.id,
      actorUsername: auth.owner.username,
      actorRole: auth.owner.role,
      action: "repository.scan",
      targetType: "repository",
      targetId: repository.id,
      outcome: "success",
      metadata: { drawingCount: result.drawings.length },
      requestId,
    });
    return withRequestId(NextResponse.json({ repository, drawings: result.drawings }), requestId);
  } catch (error) {
    return withRequestId(
      NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 }),
      requestId,
    );
  }
}
