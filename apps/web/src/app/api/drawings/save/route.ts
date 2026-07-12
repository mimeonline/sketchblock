import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { safeRecordAuditEvent } from "@/lib/server/audit/audit-service";
import { getRequestId } from "@/lib/server/logging/server-logger";

import { saveDrawing } from "@/lib/server/application/drawing-use-cases";
import { requireLinkedOwnerGitHub, requireOwnerApiAuth } from "@/lib/server/auth/owner-session";
import { requireActiveRepository } from "@/lib/server/database/repository-store";
import { validateDrawingPath } from "@/lib/server/domain/validate-drawing-path";
import { GitHubApiError } from "@/lib/server/github/github-repository-adapter";

export const runtime = "nodejs";

const saveSchema = z.object({
  path: z.string().min(1),
  sha: z.string().min(1),
  content: z.unknown(),
  message: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const auth = await requireOwnerApiAuth();
    if (auth.response || !auth.owner) {
      return auth.response;
    }
    requireLinkedOwnerGitHub(auth.owner);

    const body = saveSchema.parse(await request.json());
    const repository = await requireActiveRepository(auth.owner.id);
    const result = await saveDrawing(repository, {
      ...body,
      path: validateDrawingPath(body.path),
    });
    await safeRecordAuditEvent({ actorId: auth.owner.id, actorUsername: auth.owner.username, actorRole: auth.owner.role, action: "board.save", targetType: "drawing", targetId: body.path, outcome: "success", metadata: { commitSha: result.commitSha }, requestId });

    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: error instanceof GitHubApiError && error.status === 409 ? 409 : 400 },
    );
  }
}
