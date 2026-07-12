import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { safeRecordAuditEvent } from "@/lib/server/audit/audit-service";

import { requireLinkedOwnerGitHub, requireOwnerApiAuth } from "@/lib/server/auth/owner-session";
import { isDemoAuthMode } from "@/lib/server/auth/auth-mode";
import { ensureDemoWorkspace } from "@/lib/server/demo/demo-store";
import { getGitHubAccessToken } from "@/lib/server/auth/session";
import {
  getActiveRepository,
  listOwnedRepositories,
  saveActiveRepository,
} from "@/lib/server/database/repository-store";
import {
  getWritableGitHubRepository,
  scanGitHubRepository,
} from "@/lib/server/github/github-repository-adapter";
import {
  getRequestId,
  logServerError,
  withRequestId,
} from "@/lib/server/logging/server-logger";

export const runtime = "nodejs";

const selectionSchema = z.object({
  githubRepositoryId: z.number().int().positive(),
});

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const auth = await requireOwnerApiAuth();
    if (auth.response) {
      return withRequestId(auth.response, requestId);
    }
    if (!auth.owner) {
      return withRequestId(
        NextResponse.json({ error: "Instance owner login required." }, { status: 401 }),
        requestId,
      );
    }

    if (isDemoAuthMode()) await ensureDemoWorkspace();
    const githubAccessReady = Boolean(await getGitHubAccessToken());
    if (!auth.owner.githubUserId) {
      return withRequestId(
        NextResponse.json({ repositories: [], activeRepository: null, githubConnected: false }),
        requestId,
      );
    }
    const activeRepository = await getActiveRepository(auth.owner.id);
    const repositories = await listOwnedRepositories(auth.owner.id);
    return withRequestId(
      NextResponse.json({
        repositories,
        activeRepository,
        githubConnected: githubAccessReady,
        githubIdentityLinked: true,
        demoMode: isDemoAuthMode(),
      }),
      requestId,
    );
  } catch (error) {
    logServerError("web.repositories.read.failed", error, {
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      statusCode: 500,
    });
    return withRequestId(
      NextResponse.json(
        { error: error instanceof Error ? error.message : "Unknown error", requestId },
        { status: 500 },
      ),
      requestId,
    );
  }
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const auth = await requireOwnerApiAuth();
    if (auth.response) {
      return withRequestId(auth.response, requestId);
    }
    if (!auth.owner) {
      return withRequestId(
        NextResponse.json({ error: "Instance owner login required." }, { status: 401 }),
        requestId,
      );
    }

    const github = requireLinkedOwnerGitHub(auth.owner);
    const input = selectionSchema.parse(await request.json());
    const selectedRepository = await getWritableGitHubRepository(input.githubRepositoryId);
    const result = await scanGitHubRepository(selectedRepository);
    await saveActiveRepository({
      userId: auth.owner.id,
      githubUserId: github.id,
      login: github.login,
      name: github.name,
      avatarUrl: github.avatarUrl,
    }, result.repository);
    await safeRecordAuditEvent({ actorId: auth.owner.id, actorUsername: auth.owner.username, actorRole: auth.owner.role, action: "repository.connect", targetType: "repository", targetId: result.repository.id, outcome: "success", requestId });
    await safeRecordAuditEvent({ actorId: auth.owner.id, actorUsername: auth.owner.username, actorRole: auth.owner.role, action: "repository.scan", targetType: "repository", targetId: result.repository.id, outcome: "success", metadata: { drawingCount: result.drawings.length }, requestId });

    return withRequestId(NextResponse.json(result), requestId);
  } catch (error) {
    logServerError("web.repositories.select.failed", error, {
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      statusCode: 400,
    });
    return withRequestId(
      NextResponse.json(
        { error: error instanceof Error ? error.message : "Unknown error", requestId },
        { status: 400 },
      ),
      requestId,
    );
  }
}
