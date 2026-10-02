import { NextRequest, NextResponse } from "next/server";
import { safeRecordAuditEvent } from "@/lib/server/audit/audit-service";
import { getRequestId } from "@/lib/server/logging/server-logger";

import { openDrawing } from "@/lib/server/application/drawing-use-cases";
import { requireOwnerApiAuth } from "@/lib/server/auth/owner-session";
import { requireActiveRepository } from "@/lib/server/database/repository-store";
import { requireGitHubForRepository } from "@/lib/server/workspace/github-requirement";
import { validateDrawingPath } from "@/lib/server/domain/validate-drawing-path";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const auth = await requireOwnerApiAuth();
    if (auth.response || !auth.owner) {
      return auth.response;
    }
    const path = request.nextUrl.searchParams.get("path");

    if (!path) {
      return NextResponse.json({ error: "Missing path" }, { status: 400 });
    }

    const repository = await requireActiveRepository(auth.owner.id);
    requireGitHubForRepository(auth.owner, repository);
    const drawing = await openDrawing(repository, validateDrawingPath(path));
    await safeRecordAuditEvent({ actorId: auth.owner.id, actorUsername: auth.owner.username, actorRole: auth.owner.role, action: "board.open", targetType: "drawing", targetId: path, outcome: "success", requestId });
    return NextResponse.json({ drawing });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
